using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using HueSTD.Application.DTOs.AI;
using HueSTD.Application.DTOs.Auth;
using HueSTD.Application.DTOs.Document;
using HueSTD.Application.Exceptions;
using HueSTD.Application.Interfaces;
using HueSTD.Domain.Entities;
using Microsoft.Extensions.Logging;
using Supabase;

namespace HueSTD.Infrastructure.Services;

public sealed class PersistentAssistantRealtimeService : IAssistantRealtimeService
{
    private const int MaxHistoryTurns = 12;
    private const int MaxMessagesReturned = 40;
    private const int SummaryTriggerTurns = 24;
    private const int MaxDocumentContextItems = 5;
    private const int MaxStructuredDocumentResults = 3;
    private static readonly TimeSpan SessionCacheTtl = TimeSpan.FromHours(6);

    private static readonly ConcurrentDictionary<string, AssistantState> Sessions = new();

    private static readonly string[] SensitiveKeywords =
    [
        "email", "số điện thoại", "so dien thoai", "địa chỉ", "dia chi", "cccd", "cmnd",
        "mật khẩu", "mat khau", "ngày sinh", "ngay sinh", "thông tin cá nhân", "thong tin ca nhan",
        "hồ sơ", "ho so", "profile", "dữ liệu người dùng", "du lieu nguoi dung", "token", "jwt", "api key"
    ];

    private static readonly string[] OutOfScopeKeywords =
    [
        "thời tiết", "thoi tiet", "giá vàng", "gia vang", "bitcoin", "chứng khoán", "chung khoan",
        "tin thế giới", "tin the gioi", "bóng đá", "bong da", "chính trị", "chinh tri", "google giúp"
    ];

    private static readonly string[] IdentityKeywords =
    [
        "nguồn gốc", "nguon goc", "model", "mô hình", "mo hinh", "gemini", "openai",
        "google deepmind", "deepmind", "bạn là ai", "ban la ai", "ai tạo ra", "ai tao ra"
    ];

    private static readonly string[] DefaultQuickReplies =
    [
        "Tóm tắt ngắn trang này",
        "Giải thích chức năng này",
        "Tôi nên làm gì tiếp theo?"
    ];

    private static readonly string[] DocumentQuickReplies =
    [
        "Tài liệu nào mới nhất?",
        "Tài liệu nào được xem nhiều nhất?",
        "Gợi ý tài liệu phù hợp"
    ];

    private static readonly string[] ChatQuickReplies =
    [
        "Viết ngắn hơn",
        "Tóm tắt ý chính",
        "Cho tôi 3 bước tiếp theo"
    ];

    private readonly IAuthService _authService;
    private readonly IAiService _aiService;
    private readonly IDocumentReadGateway _documentReadGateway;
    private readonly Client _supabaseClient;
    private readonly ILogger<PersistentAssistantRealtimeService> _logger;

    public PersistentAssistantRealtimeService(
        IAuthService authService,
        IAiService aiService,
        IDocumentReadGateway documentReadGateway,
        Client supabaseClient,
        ILogger<PersistentAssistantRealtimeService> logger)
    {
        _authService = authService;
        _aiService = aiService;
        _documentReadGateway = documentReadGateway;
        _supabaseClient = supabaseClient;
        _logger = logger;
    }

    public async Task<AssistantSessionJoinedDto> JoinSessionAsync(
        string userId,
        string? email,
        string role,
        AssistantSessionJoinRequest request,
        CancellationToken cancellationToken = default)
    {
        CleanupInactiveSessions();

        var user = await RequireUserAsync(userId, email, role);
        var userGuid = ParseUserGuid(user.Id);
        var sessionKey = NormalizeSessionKey(request.SessionId, user.Id);
        var state = Sessions.GetOrAdd(sessionKey, _ => new AssistantState(sessionKey, user.Id!, user.FullName ?? user.Email ?? "Người dùng"));

        await EnsureHydratedAsync(state, userGuid, cancellationToken);

        state.UserName = user.FullName ?? user.Email ?? state.UserName;
        state.PageContext = BuildPageContext(request.PagePath, request.PageTitle, request.Module, request.ContextSummary);
        state.Module = NormalizeModule(request.Module) ?? state.Module;
        state.Locale = NormalizeLocale(request.Locale) ?? state.Locale;
        state.Persona = NormalizePersona(request.Persona) ?? state.Persona;
        MergeMetadata(state.Metadata, request.Metadata);
        state.LastActivityAt = DateTime.UtcNow;

        await PersistSessionAsync(state, userGuid, cancellationToken);

        return new AssistantSessionJoinedDto
        {
            SessionId = state.SessionKey,
            UserId = user.Id!,
            UserName = state.UserName,
            WelcomeMessage = BuildWelcomeMessage(user, request),
            Capabilities =
            [
                "tra_cuu_thong_tin_trong_huestd",
                "huong_dan_su_dung_chuc_nang",
                "goi_y_tai_lieu",
                "ghi_nho_lich_su_theo_session",
                "quick_replies",
                "conversation_search",
                "markdown_rich_messages",
                "persistent_sessions"
            ],
            Locale = state.Locale,
            Persona = state.Persona,
            SessionSummary = state.Summary,
            HumanHandoverAvailable = true,
            FeatureFlags = BuildFeatureFlags(),
            SuggestedReplies = BuildSuggestedReplies(state.Module),
            Messages = state.Messages.TakeLast(MaxMessagesReturned).Select(CloneMessage).ToList()
        };
    }

    public async Task<AssistantChatMessageDto> SendMessageAsync(
        string userId,
        string? email,
        string role,
        AssistantSendMessageRequest request,
        CancellationToken cancellationToken = default)
    {
        CleanupInactiveSessions();

        var user = await RequireUserAsync(userId, email, role);
        var userGuid = ParseUserGuid(user.Id);
        var sessionKey = NormalizeSessionKey(request.SessionId, user.Id);
        var state = Sessions.GetOrAdd(sessionKey, _ => new AssistantState(sessionKey, user.Id!, user.FullName ?? user.Email ?? "Người dùng"));

        await EnsureHydratedAsync(state, userGuid, cancellationToken);

        state.UserName = user.FullName ?? user.Email ?? state.UserName;
        if (!string.IsNullOrWhiteSpace(request.PagePath) ||
            !string.IsNullOrWhiteSpace(request.PageTitle) ||
            !string.IsNullOrWhiteSpace(request.Module) ||
            !string.IsNullOrWhiteSpace(request.ContextSummary))
        {
            state.PageContext = BuildPageContext(request.PagePath, request.PageTitle, request.Module, request.ContextSummary);
        }

        state.Locale = NormalizeLocale(request.Locale) ?? state.Locale;
        state.Persona = NormalizePersona(request.Persona) ?? state.Persona;
        state.Module = NormalizeModule(request.Module) ?? state.Module;
        MergeMetadata(state.Metadata, request.Metadata);
        state.LastActivityAt = DateTime.UtcNow;

        var trimmedMessage = request.Message.Trim();
        if (string.IsNullOrWhiteSpace(trimmedMessage))
        {
            throw new BadRequestException("Tin nhắn không được để trống.");
        }

        var userMessage = new AssistantChatMessageDto
        {
            Id = Guid.NewGuid().ToString("N"),
            SessionId = state.SessionKey,
            Role = "user",
            Content = trimmedMessage,
            Timestamp = DateTime.UtcNow
        };

        AddMessage(state, userMessage);
        await PersistMessageAsync(userGuid, userMessage, cancellationToken);

        var quickReplies = BuildSuggestedReplies(state.Module);
        if (AssistantProjectFaqCatalog.TryMatch(trimmedMessage, state.Module, out var faqResponse))
        {
            var faqMessage = CreateAssistantMessage(state.SessionKey, faqResponse, quickReplies);
            AddMessage(state, faqMessage);
            await PersistMessageAsync(userGuid, faqMessage, cancellationToken);
            await PersistSessionAsync(state, userGuid, cancellationToken);
            return faqMessage;
        }

        if (TryBuildRestrictedResponse(trimmedMessage, out var restrictedResponse))
        {
            var restrictedMessage = CreateAssistantMessage(state.SessionKey, restrictedResponse, quickReplies);
            AddMessage(state, restrictedMessage);
            await PersistMessageAsync(userGuid, restrictedMessage, cancellationToken);
            await PersistSessionAsync(state, userGuid, cancellationToken);
            return restrictedMessage;
        }

        var structuredDocumentResponse = await TryBuildStructuredDocumentResponseAsync(trimmedMessage, user);
        if (!string.IsNullOrWhiteSpace(structuredDocumentResponse))
        {
            var documentMessage = CreateAssistantMessage(state.SessionKey, structuredDocumentResponse, quickReplies);
            AddMessage(state, documentMessage);
            await PersistMessageAsync(userGuid, documentMessage, cancellationToken);
            await PersistSessionAsync(state, userGuid, cancellationToken);
            return documentMessage;
        }

        var documentContext = await BuildRelevantDocumentContextAsync(trimmedMessage, request.Metadata, user, state);
        var aiResponse = await _aiService.ChatAsync(new ChatRequest
        {
            Message = BuildPromptedUserMessage(trimmedMessage),
            Context = BuildAssistantContext(user, state, documentContext),
            IsSystemPrompt = false,
            UserId = user.Id
        }, user.Id);

        if (!aiResponse.Success)
        {
            throw new InvalidOperationException(aiResponse.Error ?? "Không thể xử lý yêu cầu AI lúc này.");
        }

        var assistantMessage = CreateAssistantMessage(
            state.SessionKey,
            NormalizeAssistantResponse(aiResponse.Content),
            quickReplies);

        AddMessage(state, assistantMessage);
        await PersistMessageAsync(userGuid, assistantMessage, cancellationToken);
        await PersistSessionAsync(state, userGuid, cancellationToken);
        return assistantMessage;
    }

    private async Task<UserDto> RequireUserAsync(string userId, string? email, string role)
    {
        var user = await _authService.GetCurrentUserAsync(userId, email);
        if (user == null || string.IsNullOrWhiteSpace(user.Id))
        {
            throw new UnauthorizedException("Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
        }

        if (!string.IsNullOrWhiteSpace(role))
        {
            user.Role = role;
        }

        return user;
    }

    private async Task EnsureHydratedAsync(AssistantState state, Guid userGuid, CancellationToken cancellationToken)
    {
        if (state.IsHydrated)
        {
            return;
        }

        await state.SyncRoot.WaitAsync(cancellationToken);
        try
        {
            if (state.IsHydrated)
            {
                return;
            }

            try
            {
                var sessionResult = await _supabaseClient
                    .From<AssistantSession>()
                    .Where(x => x.SessionKey == state.SessionKey && x.UserId == userGuid)
                    .Get(cancellationToken: cancellationToken);

                var existingSession = sessionResult.Models.FirstOrDefault();
                if (existingSession != null)
                {
                    state.UserName = existingSession.UserName;
                    state.PageContext = existingSession.PageContext ?? state.PageContext;
                    state.Module = existingSession.Module ?? state.Module;
                    state.Locale = existingSession.Locale ?? state.Locale;
                    state.Persona = existingSession.Persona ?? state.Persona;
                    state.Summary = existingSession.Summary;
                    state.Metadata = DeserializeMetadata(existingSession.MetadataJson);
                    state.LastActivityAt = existingSession.LastActivityAt;
                }

                var messagesResult = await _supabaseClient
                    .From<AssistantMessage>()
                    .Where(x => x.SessionKey == state.SessionKey && x.UserId == userGuid)
                    .Order("created_at", Supabase.Postgrest.Constants.Ordering.Descending)
                    .Limit(MaxMessagesReturned)
                    .Get(cancellationToken: cancellationToken);

                if (state.Messages.Count == 0)
                {
                    state.Messages.AddRange(messagesResult.Models
                        .OrderBy(x => x.CreatedAt)
                        .Select(x => new AssistantChatMessageDto
                        {
                            Id = x.Id.ToString("N"),
                            SessionId = x.SessionKey,
                            Role = x.Role,
                            Content = x.Content,
                            Timestamp = x.CreatedAt,
                            QuickReplies = DeserializeQuickReplies(x.QuickRepliesJson)
                        }));
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[AssistantRealtime] Failed to hydrate assistant session {SessionKey}", state.SessionKey);
            }

            state.IsHydrated = true;
        }
        finally
        {
            state.SyncRoot.Release();
        }
    }

    private async Task PersistSessionAsync(AssistantState state, Guid userGuid, CancellationToken cancellationToken)
    {
        try
        {
            var existingResult = await _supabaseClient
                .From<AssistantSession>()
                .Where(x => x.SessionKey == state.SessionKey && x.UserId == userGuid)
                .Get(cancellationToken: cancellationToken);

            var entity = existingResult.Models.FirstOrDefault() ?? new AssistantSession
            {
                Id = Guid.NewGuid(),
                SessionKey = state.SessionKey,
                UserId = userGuid,
                CreatedAt = DateTime.UtcNow
            };

            entity.UserName = state.UserName;
            entity.PageContext = state.PageContext;
            entity.Module = state.Module;
            entity.Locale = state.Locale;
            entity.Persona = state.Persona;
            entity.Summary = state.Summary;
            entity.MetadataJson = SerializeMetadata(state.Metadata);
            entity.LastActivityAt = state.LastActivityAt;
            entity.UpdatedAt = DateTime.UtcNow;

            await _supabaseClient.From<AssistantSession>().Upsert(entity, cancellationToken: cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[AssistantRealtime] Failed to persist assistant session {SessionKey}", state.SessionKey);
        }
    }

    private async Task PersistMessageAsync(Guid userGuid, AssistantChatMessageDto message, CancellationToken cancellationToken)
    {
        try
        {
            await _supabaseClient.From<AssistantMessage>().Insert(new AssistantMessage
            {
                Id = Guid.TryParse(message.Id, out var parsedId) ? parsedId : Guid.NewGuid(),
                SessionKey = message.SessionId,
                UserId = userGuid,
                Role = message.Role,
                Content = message.Content,
                QuickRepliesJson = SerializeQuickReplies(message.QuickReplies),
                CreatedAt = message.Timestamp == default ? DateTime.UtcNow : message.Timestamp
            }, cancellationToken: cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[AssistantRealtime] Failed to persist assistant message for {SessionKey}", message.SessionId);
        }
    }

    private void AddMessage(AssistantState state, AssistantChatMessageDto message)
    {
        state.Messages.Add(message);
        TrimHistory(state.Messages);
        RebuildSummaryIfNeeded(state);
        state.LastActivityAt = DateTime.UtcNow;
    }

    private async Task<string?> BuildRelevantDocumentContextAsync(
        string userMessage,
        Dictionary<string, string>? metadata,
        UserDto user,
        AssistantState state)
    {
        try
        {
            if (TryGetDocumentId(metadata, out var documentId))
            {
                var document = await _documentReadGateway.GetDocumentByIdAsync(documentId);
                if (document != null)
                {
                    return FormatDocumentContext([document], "Tài liệu hiện tại của trang");
                }
            }

            var shouldSearchDocuments =
                state.PageContext.Contains("documents", StringComparison.OrdinalIgnoreCase) ||
                state.PageContext.Contains("tài liệu", StringComparison.OrdinalIgnoreCase) ||
                userMessage.Contains("tài liệu", StringComparison.OrdinalIgnoreCase) ||
                userMessage.Contains("đề thi", StringComparison.OrdinalIgnoreCase) ||
                userMessage.Contains("đề cương", StringComparison.OrdinalIgnoreCase) ||
                userMessage.Contains("mới nhất", StringComparison.OrdinalIgnoreCase) ||
                userMessage.Contains("lượt xem", StringComparison.OrdinalIgnoreCase) ||
                userMessage.Contains("lượt tải", StringComparison.OrdinalIgnoreCase);

            if (!shouldSearchDocuments)
            {
                return null;
            }

            IReadOnlyList<DocumentDto> results;
            if (userMessage.Contains("được xem nhiều nhất", StringComparison.OrdinalIgnoreCase) ||
                userMessage.Contains("lượt xem cao nhất", StringComparison.OrdinalIgnoreCase))
            {
                results = await _documentReadGateway.GetTopViewedDocumentsAsync(MaxDocumentContextItems);
            }
            else if (userMessage.Contains("tải nhiều nhất", StringComparison.OrdinalIgnoreCase) ||
                     userMessage.Contains("lượt tải cao nhất", StringComparison.OrdinalIgnoreCase))
            {
                results = await _documentReadGateway.GetTopDownloadedDocumentsAsync(MaxDocumentContextItems);
            }
            else if (userMessage.Contains("mới nhất", StringComparison.OrdinalIgnoreCase))
            {
                results = await _documentReadGateway.GetNewestDocumentsAsync(MaxDocumentContextItems);
            }
            else
            {
                results = await _documentReadGateway.SearchDocumentsAsync(userMessage, user.School, MaxDocumentContextItems);
            }

            return results.Count == 0
                ? "Chưa tìm thấy tài liệu phù hợp trong cơ sở dữ liệu HueSTD."
                : FormatDocumentContext(results, "Các tài liệu liên quan nhất");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[AssistantRealtime] Failed to build document context");
            return null;
        }
    }

    private async Task<string?> TryBuildStructuredDocumentResponseAsync(string userMessage, UserDto user)
    {
        if (!LooksLikeDocumentQuery(userMessage))
        {
            return null;
        }

        var query = ParseDocumentQuery(userMessage, user);
        if (query == null)
        {
            return null;
        }

        var result = await _documentReadGateway.QueryDocumentsAsync(query);
        if (result.TotalCount == 0)
        {
            return BuildNoDocumentMatchResponse(query);
        }

        if (IsCountIntent(userMessage))
        {
            return BuildCountResponse(query, result.TotalCount);
        }

        return BuildDocumentListResponse(query, result);
    }

    private static bool LooksLikeDocumentQuery(string message)
    {
        return ContainsNormalized(message,
            "tai lieu",
            "de thi",
            "de cuong",
            "giao trinh",
            "slide",
            "bai giang",
            "bao nhieu",
            "luot xem",
            "luot tai",
            "moi nhat");
    }

    private static bool IsCountIntent(string message)
    {
        return ContainsNormalized(message, "bao nhieu", "so luong", "tong so");
    }

    private static DocumentQueryRequest? ParseDocumentQuery(string message, UserDto user)
    {
        var normalized = NormalizeForIntent(message);
        var request = new DocumentQueryRequest
        {
            Query = message,
            Limit = MaxStructuredDocumentResults,
            SortBy = "relevance"
        };

        if (normalized.Contains("luot xem cao nhat") || normalized.Contains("duoc xem nhieu nhat"))
        {
            request.SortBy = "views";
        }
        else if (normalized.Contains("luot tai cao nhat") || normalized.Contains("tai nhieu nhat"))
        {
            request.SortBy = "downloads";
        }
        else if (normalized.Contains("moi nhat"))
        {
            request.SortBy = "newest";
        }

        request.School = ExtractBetween(normalized, "truong ", [" mon ", " nam ", " loai ", ",", ".", "?"], message)
            ?? ExtractBetween(normalized, "cua truong ", [" mon ", " nam ", " loai ", ",", ".", "?"], message)
            ?? ExtractBetween(normalized, "cua ", [" mon ", " nam ", " loai ", ",", ".", "?"], message);

        request.Subject = ExtractBetween(normalized, "mon ", [" truong ", " nam ", " loai ", ",", ".", "?"], message);
        request.Type = ExtractKnownType(normalized);
        request.Year = ExtractYear(normalized);

        if (string.IsNullOrWhiteSpace(request.School) && string.IsNullOrWhiteSpace(request.Subject))
        {
            request.School = user.School;
        }

        if (string.IsNullOrWhiteSpace(request.Query) &&
            string.IsNullOrWhiteSpace(request.School) &&
            string.IsNullOrWhiteSpace(request.Subject) &&
            string.IsNullOrWhiteSpace(request.Type) &&
            string.IsNullOrWhiteSpace(request.Year))
        {
            return null;
        }

        return request;
    }

    private static string BuildCountResponse(DocumentQueryRequest query, int count)
    {
        var filters = BuildFilterSummary(query);
        return filters.Count == 0
            ? $"**Hiện có {count} tài liệu phù hợp.**"
            : $"**Hiện có {count} tài liệu phù hợp.**\n\n{string.Join('\n', filters)}";
    }

    private static string BuildNoDocumentMatchResponse(DocumentQueryRequest query)
    {
        var filters = BuildFilterSummary(query);
        return filters.Count == 0
            ? "Chưa tìm thấy tài liệu phù hợp."
            : $"Chưa tìm thấy tài liệu phù hợp.\n\n{string.Join('\n', filters)}";
    }

    private static string BuildDocumentListResponse(DocumentQueryRequest query, DocumentQueryResultDto result)
    {
        var builder = new StringBuilder();
        var visibleCount = Math.Min(result.Documents.Count, MaxStructuredDocumentResults);
        builder.AppendLine($"**Tìm thấy {result.TotalCount} tài liệu phù hợp.**");

        var filters = BuildFilterSummary(query);
        if (filters.Count > 0)
        {
            builder.AppendLine();
            builder.AppendLine(string.Join('\n', filters));
        }

        builder.AppendLine();
        builder.AppendLine($"**Top {visibleCount} kết quả:**");

        foreach (var document in result.Documents.Take(MaxStructuredDocumentResults))
        {
            builder.AppendLine($"- **{EscapeMarkdownInline(document.Title ?? "Không rõ")}**");
            builder.AppendLine($"  - Môn: {EscapeMarkdownInline(document.Subject ?? "Không rõ")}");
            builder.AppendLine($"  - Trường: {EscapeMarkdownInline(document.School ?? "Không rõ")}");
            builder.AppendLine($"  - Lượt xem: {document.Views} | Lượt tải: {document.Downloads}");
        }

        return builder.ToString().Trim();
    }

    private static List<string> BuildFilterSummary(DocumentQueryRequest query)
    {
        var filters = new List<string>();
        if (!string.IsNullOrWhiteSpace(query.School)) filters.Add($"- Trường: **{EscapeMarkdownInline(query.School)}**");
        if (!string.IsNullOrWhiteSpace(query.Subject)) filters.Add($"- Môn: **{EscapeMarkdownInline(query.Subject)}**");
        if (!string.IsNullOrWhiteSpace(query.Type)) filters.Add($"- Loại: **{EscapeMarkdownInline(query.Type)}**");
        if (!string.IsNullOrWhiteSpace(query.Year)) filters.Add($"- Năm: **{EscapeMarkdownInline(query.Year)}**");
        return filters;
    }

    private static string EscapeMarkdownInline(string value)
    {
        return value.Replace("|", "\\|", StringComparison.Ordinal).Trim();
    }

    private static bool ContainsNormalized(string value, params string[] tokens)
    {
        var normalized = NormalizeForIntent(value);
        return tokens.Any(normalized.Contains);
    }

    private static string NormalizeForIntent(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var normalized = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);

        foreach (var character in normalized)
        {
            if (character == 'đ')
            {
                builder.Append('d');
                continue;
            }

            if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(character) != System.Globalization.UnicodeCategory.NonSpacingMark)
            {
                builder.Append(character);
            }
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }

    private static string? ExtractBetween(string normalized, string startToken, string[] endTokens, string original)
    {
        var startIndex = normalized.IndexOf(startToken, StringComparison.Ordinal);
        if (startIndex < 0)
        {
            return null;
        }

        startIndex += startToken.Length;
        var endIndex = normalized.Length;

        foreach (var endToken in endTokens)
        {
            var found = normalized.IndexOf(endToken, startIndex, StringComparison.Ordinal);
            if (found >= 0 && found < endIndex)
            {
                endIndex = found;
            }
        }

        if (endIndex <= startIndex)
        {
            return null;
        }

        return original.Substring(startIndex, endIndex - startIndex).Trim(' ', ',', '.', '?');
    }

    private static string? ExtractKnownType(string normalized)
    {
        var knownTypes = new[]
        {
            "đề thi", "de thi",
            "đề cương", "de cuong",
            "giáo trình", "giao trinh",
            "bài giảng", "bai giang",
            "slide"
        };

        var match = knownTypes.FirstOrDefault(type => normalized.Contains(NormalizeForIntent(type), StringComparison.Ordinal));
        return match switch
        {
            "de thi" => "Đề thi",
            "đề thi" => "Đề thi",
            "de cuong" => "Đề cương",
            "đề cương" => "Đề cương",
            "giao trinh" => "Giáo trình",
            "giáo trình" => "Giáo trình",
            "bai giang" => "Bài giảng",
            "đề" => "Đề",
            _ => match
        };
    }

    private static string? ExtractYear(string normalized)
    {
        var match = System.Text.RegularExpressions.Regex.Match(normalized, @"\b(19|20)\d{2}\b");
        return match.Success ? match.Value : null;
    }

    private static bool TryGetDocumentId(Dictionary<string, string>? metadata, out Guid documentId)
    {
        documentId = Guid.Empty;
        return metadata != null &&
               metadata.TryGetValue("documentId", out var rawDocumentId) &&
               Guid.TryParse(rawDocumentId, out documentId);
    }

    private static string FormatDocumentContext(IReadOnlyList<DocumentDto> documents, string header)
    {
        var builder = new StringBuilder();
        builder.AppendLine(header + ":");
        foreach (var document in documents.Take(MaxDocumentContextItems))
        {
            builder.AppendLine($"- Tiêu đề: {document.Title ?? "Không rõ"}");
            builder.AppendLine($"  Môn học: {document.Subject ?? "Không rõ"}");
            builder.AppendLine($"  Trường: {document.School ?? "Không rõ"}");
            builder.AppendLine($"  Loại: {document.Type ?? "Không rõ"}");
            builder.AppendLine($"  Năm: {document.Year ?? "Không rõ"}");
            builder.AppendLine($"  Lượt xem: {document.Views}");
            builder.AppendLine($"  Lượt tải: {document.Downloads}");
            if (!string.IsNullOrWhiteSpace(document.Description))
            {
                builder.AppendLine($"  Mô tả: {Truncate(document.Description, 220)}");
            }
        }

        return builder.ToString().Trim();
    }

    private static string BuildPageContext(string? pagePath, string? pageTitle, string? module, string? contextSummary)
    {
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(pagePath)) parts.Add($"Đường dẫn hiện tại: {pagePath.Trim()}");
        if (!string.IsNullOrWhiteSpace(pageTitle)) parts.Add($"Tiêu đề hiện tại: {pageTitle.Trim()}");
        if (!string.IsNullOrWhiteSpace(module)) parts.Add($"Module đang sử dụng: {module.Trim()}");
        if (!string.IsNullOrWhiteSpace(contextSummary)) parts.Add($"Ngữ cảnh bổ sung: {contextSummary.Trim()}");
        return string.Join('\n', parts);
    }

    private static string BuildWelcomeMessage(UserDto user, AssistantSessionJoinRequest request)
    {
        var name = user.FullName ?? user.Email ?? "bạn";
        var module = string.IsNullOrWhiteSpace(request.Module) ? "hệ thống HueSTD" : request.Module.Trim();
        return $"Xin chào {name}. Tôi là trợ lý HueSTD và có thể hỗ trợ bạn trong phạm vi của {module}.";
    }

    private static string BuildAssistantContext(UserDto user, AssistantState state, string? documentContext)
    {
        var builder = new StringBuilder();
        builder.AppendLine("Bạn là trợ lý HueSTD.");
        builder.AppendLine("Chỉ trả lời trong phạm vi dữ liệu HueSTD được backend cung cấp.");
        builder.AppendLine("Không nhắc tới model, hãng AI, nguồn gốc kỹ thuật hoặc dữ liệu nội bộ.");
        builder.AppendLine("Không tiết lộ dữ liệu cá nhân hoặc dữ liệu nhạy cảm của bất kỳ người dùng nào.");
        builder.AppendLine("Nếu bị hỏi thông tin nhạy cảm, trả lời đúng câu: Liên hệ Admin HueSTD để biết thêm chi tiết.");
        builder.AppendLine("Luôn trả lời bằng tiếng Việt có dấu, ngắn gọn, đúng trọng tâm, ưu tiên tối đa 3 câu hoặc 3 gạch đầu dòng.");
        builder.AppendLine();

        if (!string.IsNullOrWhiteSpace(state.PageContext))
        {
            builder.AppendLine("Ngữ cảnh trang hiện tại:");
            builder.AppendLine(state.PageContext);
            builder.AppendLine();
        }

        if (state.Metadata.Count > 0)
        {
            builder.AppendLine("Metadata từ client:");
            foreach (var entry in state.Metadata.OrderBy(x => x.Key))
            {
                builder.AppendLine($"- {entry.Key}: {entry.Value}");
            }

            builder.AppendLine();
        }

        if (!string.IsNullOrWhiteSpace(state.Summary))
        {
            builder.AppendLine("Tóm tắt hội thoại trước đó:");
            builder.AppendLine(state.Summary);
            builder.AppendLine();
        }

        if (!string.IsNullOrWhiteSpace(documentContext))
        {
            builder.AppendLine(documentContext);
            builder.AppendLine();
        }

        if (state.Messages.Count > 0)
        {
            builder.AppendLine("Lịch sử hội thoại gần đây:");
            foreach (var message in state.Messages.TakeLast(MaxHistoryTurns))
            {
                builder.AppendLine($"- {message.Role}: {message.Content}");
            }
        }

        return builder.ToString().Trim();
    }

    private static bool TryBuildRestrictedResponse(string message, out string response)
    {
        if (SensitiveKeywords.Any(x => message.Contains(x, StringComparison.OrdinalIgnoreCase)))
        {
            response = "Liên hệ Admin HueSTD để biết thêm chi tiết.";
            return true;
        }

        if (IdentityKeywords.Any(x => message.Contains(x, StringComparison.OrdinalIgnoreCase)))
        {
            response = "Tôi là trợ lý HueSTD. Tôi hỗ trợ tra cứu thông tin và hướng dẫn thao tác trong hệ thống HueSTD.";
            return true;
        }

        if (OutOfScopeKeywords.Any(x => message.Contains(x, StringComparison.OrdinalIgnoreCase)))
        {
            response = "Tôi là trợ lý HueSTD và chỉ hỗ trợ thông tin, chức năng, tài liệu trong hệ thống HueSTD.";
            return true;
        }

        if (message.Contains("chỉnh sửa", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("chinh sua", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("xóa", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("xoa", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("duyệt", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("duyet", StringComparison.OrdinalIgnoreCase))
        {
            response = "Tôi chỉ có quyền đọc thông tin trong HueSTD và không có quyền chỉnh sửa dữ liệu.";
            return true;
        }

        response = string.Empty;
        return false;
    }

    private static void TrimHistory(List<AssistantChatMessageDto> messages)
    {
        while (messages.Count > SummaryTriggerTurns)
        {
            messages.RemoveAt(0);
        }
    }

    private static void RebuildSummaryIfNeeded(AssistantState state)
    {
        if (state.Messages.Count < SummaryTriggerTurns)
        {
            return;
        }

        var olderMessages = state.Messages.Take(Math.Max(0, state.Messages.Count - MaxHistoryTurns)).ToList();
        if (olderMessages.Count == 0)
        {
            return;
        }

        state.Summary = string.Join('\n', olderMessages.Select(x => $"{x.Role}: {x.Content}").Take(12));
        state.Messages.RemoveRange(0, Math.Max(0, state.Messages.Count - MaxHistoryTurns));
    }

    private static string NormalizeSessionKey(string? sessionId, string? userId)
    {
        var safeSessionId = string.IsNullOrWhiteSpace(sessionId) ? Guid.NewGuid().ToString("N") : sessionId.Trim();
        return $"{userId}:{safeSessionId}";
    }

    private static string? NormalizeLocale(string? locale) => string.IsNullOrWhiteSpace(locale) ? null : locale.Trim();
    private static string? NormalizePersona(string? persona) => string.IsNullOrWhiteSpace(persona) ? null : persona.Trim().ToLowerInvariant();
    private static string? NormalizeModule(string? module) => string.IsNullOrWhiteSpace(module) ? null : module.Trim().ToLowerInvariant();

    private static string NormalizeAssistantResponse(string? content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            return "Tôi chưa có dữ liệu phù hợp trong HueSTD để trả lời câu này.";
        }

        var normalizedLines = content
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Split('\n')
            .Select(x => x.Trim())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Take(8)
            .ToArray();

        return normalizedLines.Length == 0
            ? "Tôi chưa có dữ liệu phù hợp trong HueSTD để trả lời câu này."
            : string.Join('\n', normalizedLines);
    }

    private static string BuildPromptedUserMessage(string message)
    {
        return
            "Hãy trả lời bằng tiếng Việt có dấu, ngắn gọn và đúng trọng tâm." +
            "\n- Ưu tiên markdown đẹp, dễ đọc." +
            "\n- Tối đa 3 ý chính hoặc 1 danh sách ngắn." +
            "\n- Chỉ dùng bảng khi thật sự cần để so sánh dữ liệu." +
            "\n- Không viết thành một đoạn văn dài." +
            "\n- Nếu thiếu dữ liệu thì nói rõ trong 1 câu." +
            $"\n\nTin nhắn người dùng: {message}";
    }

    private static Dictionary<string, bool> BuildFeatureFlags()
    {
        return new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase)
        {
            ["markdown"] = true,
            ["quickReplies"] = true,
            ["conversationSearch"] = true,
            ["offlineQueue"] = true,
            ["persistentSessions"] = true,
            ["restartSafeSessions"] = true,
            ["multiDeviceSync"] = true,
            ["rag"] = false,
            ["knowledgeBase"] = false,
            ["humanHandover"] = true
        };
    }

    private static string[] BuildSuggestedReplies(string? module)
    {
        return NormalizeModule(module) switch
        {
            "documents" => DocumentQuickReplies,
            "chat" => ChatQuickReplies,
            _ => DefaultQuickReplies
        };
    }

    private static AssistantChatMessageDto CreateAssistantMessage(string sessionId, string content, string[] quickReplies)
    {
        return new AssistantChatMessageDto
        {
            Id = Guid.NewGuid().ToString("N"),
            SessionId = sessionId,
            Role = "assistant",
            Content = content,
            Timestamp = DateTime.UtcNow,
            QuickReplies = quickReplies
        };
    }

    private static AssistantChatMessageDto CloneMessage(AssistantChatMessageDto message)
    {
        return new AssistantChatMessageDto
        {
            Id = message.Id,
            SessionId = message.SessionId,
            Role = message.Role,
            Content = message.Content,
            Timestamp = message.Timestamp,
            QuickReplies = message.QuickReplies?.ToArray() ?? Array.Empty<string>()
        };
    }

    private static string Truncate(string value, int maxLength) => value.Length <= maxLength ? value : value[..maxLength] + "...";

    private static Guid ParseUserGuid(string? userId)
    {
        if (!Guid.TryParse(userId, out var guid))
        {
            throw new UnauthorizedException("Định danh người dùng không hợp lệ.");
        }

        return guid;
    }

    private static void MergeMetadata(Dictionary<string, string> target, Dictionary<string, string>? source)
    {
        if (source == null)
        {
            return;
        }

        foreach (var (key, value) in source)
        {
            if (!string.IsNullOrWhiteSpace(key) && !string.IsNullOrWhiteSpace(value))
            {
                target[key] = value.Length > 500 ? value[..500] : value;
            }
        }
    }

    private static string? SerializeMetadata(Dictionary<string, string> metadata) => metadata.Count == 0 ? null : JsonSerializer.Serialize(metadata);

    private static Dictionary<string, string> DeserializeMetadata(string? json)
    {
        return string.IsNullOrWhiteSpace(json)
            ? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            : JsonSerializer.Deserialize<Dictionary<string, string>>(json) ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    }

    private static string? SerializeQuickReplies(string[]? quickReplies) => quickReplies == null || quickReplies.Length == 0 ? null : JsonSerializer.Serialize(quickReplies);
    private static string[] DeserializeQuickReplies(string? json) => string.IsNullOrWhiteSpace(json) ? Array.Empty<string>() : JsonSerializer.Deserialize<string[]>(json) ?? Array.Empty<string>();

    private static void CleanupInactiveSessions()
    {
        var cutoff = DateTime.UtcNow.Subtract(SessionCacheTtl);
        foreach (var entry in Sessions)
        {
            if (entry.Value.LastActivityAt < cutoff)
            {
                Sessions.TryRemove(entry.Key, out _);
            }
        }
    }

    private sealed class AssistantState
    {
        public AssistantState(string sessionKey, string userId, string userName)
        {
            SessionKey = sessionKey;
            UserId = userId;
            UserName = userName;
        }

        public string SessionKey { get; }
        public string UserId { get; set; }
        public string UserName { get; set; }
        public string PageContext { get; set; } = string.Empty;
        public string? Module { get; set; }
        public string Locale { get; set; } = "vi-VN";
        public string Persona { get; set; } = "default";
        public string? Summary { get; set; }
        public Dictionary<string, string> Metadata { get; set; } = new(StringComparer.OrdinalIgnoreCase);
        public List<AssistantChatMessageDto> Messages { get; } = [];
        public DateTime LastActivityAt { get; set; } = DateTime.UtcNow;
        public bool IsHydrated { get; set; }
        public SemaphoreSlim SyncRoot { get; } = new(1, 1);
    }
}


