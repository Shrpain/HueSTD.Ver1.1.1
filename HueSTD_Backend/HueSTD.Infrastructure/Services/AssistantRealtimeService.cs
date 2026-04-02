using System.Collections.Concurrent;
using System.Text;
using HueSTD.Application.DTOs.AI;
using HueSTD.Application.DTOs.Auth;
using HueSTD.Application.DTOs.Document;
using HueSTD.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace HueSTD.Infrastructure.Services;

public class AssistantRealtimeService : IAssistantRealtimeService
{
    private const int MaxHistoryTurns = 12;
    private const int MaxMessagesReturned = 40;
    private const int SummaryTriggerTurns = 24;
    private const int MaxDocumentContextItems = 5;
    private const string SensitiveDataResponse = "Liên hệ Admin HueSTD để biết thêm chi tiết.";
    private const string ScopeLimitResponse = "Tôi là trợ lý HueSTD và chỉ hỗ trợ thông tin, chức năng, tài liệu trong hệ thống HueSTD.";
    private const string IdentityResponse = "Tôi là trợ lý HueSTD. Tôi hỗ trợ tra cứu thông tin và hướng dẫn thao tác trong hệ thống HueSTD.";
    private const string ReadOnlyResponse = "Tôi chỉ có quyền đọc thông tin trong HueSTD và không có quyền chỉnh sửa dữ liệu.";
    private const string EmptyAiResponse = "Tôi chưa có dữ liệu phù hợp trong HueSTD để trả lời câu này.";

    private static readonly ConcurrentDictionary<string, AssistantRealtimeSessionState> Sessions = new();

    private static readonly string[] SensitiveKeywords =
    [
        "email",
        "số điện thoại",
        "so dien thoai",
        "địa chỉ",
        "dia chi",
        "cccd",
        "cmnd",
        "mật khẩu",
        "mat khau",
        "ngày sinh",
        "ngay sinh",
        "thông tin cá nhân",
        "thong tin ca nhan",
        "hồ sơ",
        "ho so",
        "profile",
        "dữ liệu người dùng",
        "du lieu nguoi dung",
        "token",
        "jwt",
        "api key",
        "refresh token"
    ];

    private static readonly string[] OutOfScopeKeywords =
    [
        "thời tiết",
        "thoi tiet",
        "giá vàng",
        "gia vang",
        "bitcoin",
        "chứng khoán",
        "chung khoan",
        "tin thế giới",
        "tin the gioi",
        "bóng đá",
        "bong da",
        "chính trị",
        "chinh tri",
        "ngoài internet",
        "ngoai internet",
        "web khác",
        "web khac",
        "google giúp",
        "tìm trên mạng",
        "tim tren mang"
    ];

    private static readonly string[] IdentityKeywords =
    [
        "nguồn gốc",
        "nguon goc",
        "model",
        "mô hình",
        "mo hinh",
        "gemini",
        "openai",
        "google deepmind",
        "deepmind",
        "bạn là ai",
        "ban la ai",
        "ai tạo ra",
        "ai tao ra",
        "công nghệ gì",
        "cong nghe gi"
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
    private readonly ILogger<AssistantRealtimeService> _logger;

    public AssistantRealtimeService(
        IAuthService authService,
        IAiService aiService,
        IDocumentReadGateway documentReadGateway,
        ILogger<AssistantRealtimeService> logger)
    {
        _authService = authService;
        _aiService = aiService;
        _documentReadGateway = documentReadGateway;
        _logger = logger;
    }

    public async Task<AssistantSessionJoinedDto> JoinSessionAsync(
        string accessToken,
        AssistantSessionJoinRequest request,
        CancellationToken cancellationToken = default)
    {
        var user = await RequireUserAsync(accessToken);
        var sessionId = NormalizeSessionId(request.SessionId, user.Id);
        var pageContext = BuildPageContext(request.PagePath, request.PageTitle, request.Module, request.ContextSummary);
        var normalizedModule = NormalizeModule(request.Module);

        Sessions.AddOrUpdate(
            sessionId,
            _ => new AssistantRealtimeSessionState
            {
                SessionId = sessionId,
                UserId = user.Id!,
                UserName = user.FullName ?? user.Email ?? "Người dùng",
                PageContext = pageContext,
                Module = normalizedModule,
                Locale = NormalizeLocale(request.Locale) ?? "vi-VN",
                Persona = NormalizePersona(request.Persona) ?? "default",
                Metadata = new Dictionary<string, string>(request.Metadata ?? new Dictionary<string, string>(), StringComparer.OrdinalIgnoreCase)
            },
            (_, state) =>
            {
                state.PageContext = pageContext;
                state.Module = normalizedModule;
                state.UserName = user.FullName ?? user.Email ?? state.UserName;
                state.Locale = NormalizeLocale(request.Locale) ?? state.Locale;
                state.Persona = NormalizePersona(request.Persona) ?? state.Persona;
                MergeMetadata(state.Metadata, request.Metadata);
                return state;
            });

        var state = Sessions[sessionId];
        var suggestedReplies = BuildSuggestedReplies(state.Module);

        return new AssistantSessionJoinedDto
        {
            SessionId = sessionId,
            UserId = user.Id!,
            UserName = user.FullName ?? user.Email ?? "Người dùng",
            WelcomeMessage = BuildWelcomeMessage(user, request),
            Capabilities =
            [
                "tra_cuu_thong_tin_trong_huestd",
                "huong_dan_su_dung_chuc_nang",
                "goi_y_tai_lieu",
                "ghi_nho_lich_su_ngan_han_theo_session",
                "quick_replies",
                "conversation_search",
                "markdown_rich_messages"
            ],
            Locale = state.Locale,
            Persona = state.Persona,
            SessionSummary = state.Summary,
            HumanHandoverAvailable = true,
            FeatureFlags = BuildFeatureFlags(),
            SuggestedReplies = suggestedReplies,
            Messages = state.Messages.TakeLast(MaxMessagesReturned).ToList()
        };
    }

    public async Task<AssistantChatMessageDto> SendMessageAsync(
        string accessToken,
        AssistantSendMessageRequest request,
        CancellationToken cancellationToken = default)
    {
        var user = await RequireUserAsync(accessToken);
        var sessionId = NormalizeSessionId(request.SessionId, user.Id);
        var state = Sessions.GetOrAdd(sessionId, _ => new AssistantRealtimeSessionState
        {
            SessionId = sessionId,
            UserId = user.Id!,
            UserName = user.FullName ?? user.Email ?? "Người dùng",
            Locale = NormalizeLocale(request.Locale) ?? "vi-VN",
            Persona = NormalizePersona(request.Persona) ?? "default",
            Module = NormalizeModule(request.Module)
        });

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

        var trimmedMessage = request.Message.Trim();
        var quickReplies = BuildSuggestedReplies(state.Module);
        var userMessage = new AssistantChatMessageDto
        {
            Id = Guid.NewGuid().ToString("N"),
            SessionId = sessionId,
            Role = "user",
            Content = trimmedMessage,
            Timestamp = DateTime.UtcNow
        };

        state.Messages.Add(userMessage);
        TrimHistory(state);
        RebuildSummaryIfNeeded(state);

        if (TryBuildRestrictedResponse(trimmedMessage, out var restrictedResponse))
        {
            var blockedMessage = CreateAssistantMessage(sessionId, restrictedResponse, quickReplies);
            state.Messages.Add(blockedMessage);
            TrimHistory(state);
            RebuildSummaryIfNeeded(state);
            return blockedMessage;
        }

        var documentContext = await BuildRelevantDocumentContextAsync(trimmedMessage, request.Metadata, user, state);
        var aiRequest = new ChatRequest
        {
            Message = BuildPromptedUserMessage(trimmedMessage),
            Context = BuildAssistantContext(user, state, documentContext),
            IsSystemPrompt = false,
            UserId = user.Id
        };

        var response = await _aiService.ChatAsync(aiRequest, user.Id);
        if (!response.Success)
        {
            _logger.LogWarning("[AssistantRealtime] AI request failed for user {UserId}: {Error}", user.Id, response.Error);
            throw new InvalidOperationException(response.Error ?? "AI chat failed.");
        }

        var assistantMessage = CreateAssistantMessage(
            sessionId,
            NormalizeAssistantResponse(response.Content),
            quickReplies);

        state.Messages.Add(assistantMessage);
        TrimHistory(state);
        RebuildSummaryIfNeeded(state);

        return assistantMessage;
    }

    private async Task<UserDto> RequireUserAsync(string accessToken)
    {
        var user = await _authService.GetCurrentUserFromTokenAsync(accessToken);
        if (user == null || string.IsNullOrWhiteSpace(user.Id))
        {
            throw new UnauthorizedAccessException("Invalid or expired access token.");
        }

        return user;
    }

    private static AssistantChatMessageDto CreateAssistantMessage(string sessionId, string content, string[]? quickReplies = null)
    {
        return new AssistantChatMessageDto
        {
            Id = Guid.NewGuid().ToString("N"),
            SessionId = sessionId,
            Role = "assistant",
            Content = content,
            Timestamp = DateTime.UtcNow,
            QuickReplies = quickReplies ?? Array.Empty<string>()
        };
    }

    private static bool TryBuildRestrictedResponse(string message, out string response)
    {
        if (ContainsAny(message, SensitiveKeywords))
        {
            response = SensitiveDataResponse;
            return true;
        }

        if (ContainsAny(message, IdentityKeywords))
        {
            response = IdentityResponse;
            return true;
        }

        if (ContainsAny(message, OutOfScopeKeywords))
        {
            response = ScopeLimitResponse;
            return true;
        }

        if (message.Contains("chỉnh sửa", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("chinh sua", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("xóa", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("xoa", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("duyệt", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("duyet", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("cập nhật dữ liệu", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("cap nhat du lieu", StringComparison.OrdinalIgnoreCase))
        {
            response = ReadOnlyResponse;
            return true;
        }

        response = string.Empty;
        return false;
    }

    private static bool ContainsAny(string content, IEnumerable<string> keywords)
    {
        return keywords.Any(keyword => content.Contains(keyword, StringComparison.OrdinalIgnoreCase));
    }

    private static string NormalizeSessionId(string? sessionId, string? userId)
    {
        var safeSessionId = string.IsNullOrWhiteSpace(sessionId) ? Guid.NewGuid().ToString("N") : sessionId.Trim();
        return $"{userId}:{safeSessionId}";
    }

    private static string BuildPageContext(string? pagePath, string? pageTitle, string? module, string? contextSummary)
    {
        var parts = new List<string>();

        if (!string.IsNullOrWhiteSpace(pagePath))
        {
            parts.Add($"Đường dẫn hiện tại: {pagePath.Trim()}");
        }

        if (!string.IsNullOrWhiteSpace(pageTitle))
        {
            parts.Add($"Tiêu đề hiện tại: {pageTitle.Trim()}");
        }

        if (!string.IsNullOrWhiteSpace(module))
        {
            parts.Add($"Module đang sử dụng: {module.Trim()}");
        }

        if (!string.IsNullOrWhiteSpace(contextSummary))
        {
            parts.Add($"Ngữ cảnh bổ sung: {contextSummary.Trim()}");
        }

        return string.Join('\n', parts);
    }

    private static string BuildWelcomeMessage(UserDto user, AssistantSessionJoinRequest request)
    {
        var name = user.FullName ?? user.Email ?? "bạn";
        var module = string.IsNullOrWhiteSpace(request.Module) ? "hệ thống HueSTD" : request.Module.Trim();
        return $"Xin chào {name}. Tôi là trợ lý HueSTD và có thể hỗ trợ bạn trong phạm vi của {module}.";
    }

    private static string BuildAssistantContext(UserDto user, AssistantRealtimeSessionState state, string? documentContext)
    {
        var builder = new StringBuilder();
        builder.AppendLine("Bạn là trợ lý HueSTD.");
        builder.AppendLine("Bạn chỉ được trả lời với tư cách là trợ lý HueSTD.");
        builder.AppendLine("Bạn không được nói về nguồn gốc công nghệ, nhà phát triển, model, hãng AI hoặc cách bạn được xây dựng.");
        builder.AppendLine("Nếu bị hỏi về nguồn gốc, model, công nghệ hoặc danh tính kỹ thuật, chỉ trả lời ngắn gọn: Tôi là trợ lý HueSTD.");
        builder.AppendLine("Bạn chỉ được tra cứu thông tin trong phạm vi HueSTD và dữ liệu mà backend cung cấp.");
        builder.AppendLine("Tuyệt đối không tìm thông tin trên internet, không suy diễn ngoài HueSTD.");
        builder.AppendLine("Bạn chỉ có quyền đọc dữ liệu, không có quyền chỉnh sửa, xóa, duyệt hay thay đổi dữ liệu.");
        builder.AppendLine("Nếu câu hỏi yêu cầu dữ liệu cá nhân hoặc thông tin nhạy cảm của bất kỳ người dùng nào, hãy trả lời đúng câu: Liên hệ Admin HueSTD để biết thêm chi tiết.");
        builder.AppendLine("Không được tiết lộ dữ liệu của người dùng khác.");
        builder.AppendLine("Nếu dữ liệu không có trong HueSTD, hãy nói rõ là không tìm thấy trong HueSTD.");
        builder.AppendLine("Luôn trả lời bằng tiếng Việt có dấu.");
        builder.AppendLine("Luôn trả lời cực ngắn, đúng trọng tâm, ưu tiên 1-3 câu ngắn hoặc tối đa 3 gạch đầu dòng.");
        builder.AppendLine("Không viết mở đầu xã giao dài, không lặp lại câu hỏi, không giải thích lan man.");
        builder.AppendLine("Chỉ hỏi thêm 1 câu làm rõ khi thật sự thiếu dữ liệu để trả lời.");
        builder.AppendLine();
        builder.AppendLine($"Persona hiện tại: {state.Persona}");
        builder.AppendLine($"Locale hiện tại: {state.Locale}");
        builder.AppendLine();
        builder.AppendLine("Thông tin người dùng hiện tại:");
        builder.AppendLine($"- UserId: {user.Id}");
        builder.AppendLine($"- Họ tên: {user.FullName ?? "Chưa cập nhật"}");
        builder.AppendLine($"- Vai trò: {user.Role}");
        builder.AppendLine($"- Trường: {user.School ?? "Chưa cập nhật"}");
        builder.AppendLine($"- Ngành: {user.Major ?? "Chưa cập nhật"}");

        if (!string.IsNullOrWhiteSpace(state.PageContext))
        {
            builder.AppendLine();
            builder.AppendLine("Ngữ cảnh trang hiện tại:");
            builder.AppendLine(state.PageContext);
        }

        if (state.Metadata.Count > 0)
        {
            builder.AppendLine();
            builder.AppendLine("Metadata từ client:");
            foreach (var entry in state.Metadata.OrderBy(kvp => kvp.Key))
            {
                builder.AppendLine($"- {entry.Key}: {entry.Value}");
            }
        }

        if (!string.IsNullOrWhiteSpace(state.Summary))
        {
            builder.AppendLine();
            builder.AppendLine("Tóm tắt hội thoại trước đó:");
            builder.AppendLine(state.Summary);
        }

        if (!string.IsNullOrWhiteSpace(documentContext))
        {
            builder.AppendLine();
            builder.AppendLine("Dữ liệu tài liệu HueSTD có thể dùng để trả lời:");
            builder.AppendLine(documentContext);
        }

        if (state.Messages.Count > 0)
        {
            builder.AppendLine();
            builder.AppendLine("Lịch sử hội thoại gần đây:");
            foreach (var message in state.Messages.TakeLast(MaxHistoryTurns))
            {
                builder.AppendLine($"- {message.Role}: {message.Content}");
            }
        }

        return builder.ToString();
    }

    private async Task<string?> BuildRelevantDocumentContextAsync(
        string userMessage,
        Dictionary<string, string>? metadata,
        UserDto user,
        AssistantRealtimeSessionState state)
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
                userMessage.Contains("môn", StringComparison.OrdinalIgnoreCase) ||
                userMessage.Contains("view", StringComparison.OrdinalIgnoreCase) ||
                userMessage.Contains("lượt xem", StringComparison.OrdinalIgnoreCase) ||
                userMessage.Contains("lượt tải", StringComparison.OrdinalIgnoreCase) ||
                userMessage.Contains("mới nhất", StringComparison.OrdinalIgnoreCase);

            if (!shouldSearchDocuments)
            {
                return null;
            }

            IReadOnlyList<DocumentDto> results;
            if (userMessage.Contains("nhiều view nhất", StringComparison.OrdinalIgnoreCase) ||
                userMessage.Contains("lượt xem cao nhất", StringComparison.OrdinalIgnoreCase) ||
                userMessage.Contains("được xem nhiều nhất", StringComparison.OrdinalIgnoreCase))
            {
                results = await _documentReadGateway.GetTopViewedDocumentsAsync(MaxDocumentContextItems);
            }
            else if (userMessage.Contains("lượt tải cao nhất", StringComparison.OrdinalIgnoreCase) ||
                     userMessage.Contains("tải nhiều nhất", StringComparison.OrdinalIgnoreCase))
            {
                results = await _documentReadGateway.GetTopDownloadedDocumentsAsync(MaxDocumentContextItems);
            }
            else if (userMessage.Contains("mới nhất", StringComparison.OrdinalIgnoreCase))
            {
                results = await _documentReadGateway.GetNewestDocumentsAsync(MaxDocumentContextItems);
            }
            else
            {
                results = await _documentReadGateway.SearchDocumentsAsync(
                    userMessage,
                    user.School,
                    MaxDocumentContextItems);
            }

            if (results.Count == 0)
            {
                return "Chưa tìm thấy tài liệu phù hợp trong cơ sở dữ liệu tài liệu HueSTD.";
            }

            return FormatDocumentContext(results, "Các tài liệu liên quan nhất");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[AssistantRealtime] Failed to build document context for user {UserId}", user.Id);
            return null;
        }
    }

    private static bool TryGetDocumentId(Dictionary<string, string>? metadata, out Guid documentId)
    {
        documentId = Guid.Empty;
        if (metadata is null)
        {
            return false;
        }

        if (!metadata.TryGetValue("documentId", out var rawDocumentId) ||
            string.IsNullOrWhiteSpace(rawDocumentId))
        {
            return false;
        }

        return Guid.TryParse(rawDocumentId, out documentId);
    }

    private static string FormatDocumentContext(IReadOnlyList<DocumentDto> documents, string includeReasonHeader)
    {
        var builder = new StringBuilder();
        builder.AppendLine(includeReasonHeader + ":");

        foreach (var document in documents.Take(MaxDocumentContextItems))
        {
            builder.AppendLine($"- Id: {document.Id}");
            builder.AppendLine($"  Tiêu đề: {document.Title ?? "Không rõ"}");
            builder.AppendLine($"  Môn học: {document.Subject ?? "Không rõ"}");
            builder.AppendLine($"  Trường: {document.School ?? "Không rõ"}");
            builder.AppendLine($"  Loại: {document.Type ?? "Không rõ"}");
            builder.AppendLine($"  Năm: {document.Year ?? "Không rõ"}");
            builder.AppendLine($"  Lượt xem: {document.Views}");
            builder.AppendLine($"  Lượt tải: {document.Downloads}");
            if (!string.IsNullOrWhiteSpace(document.Description))
            {
                builder.AppendLine($"  Mô tả: {TruncateForContext(document.Description, 220)}");
            }
        }

        return builder.ToString().Trim();
    }

    private static string TruncateForContext(string value, int maxLength)
    {
        if (value.Length <= maxLength)
        {
            return value;
        }

        return value[..maxLength] + "...";
    }

    private static void TrimHistory(AssistantRealtimeSessionState state)
    {
        while (state.Messages.Count > SummaryTriggerTurns)
        {
            state.Messages.RemoveAt(0);
        }
    }

    private static void RebuildSummaryIfNeeded(AssistantRealtimeSessionState state)
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

        state.Summary = string.Join(
            '\n',
            olderMessages.Select(message => $"{message.Role}: {message.Content}").Take(12));

        state.Messages.RemoveRange(0, Math.Max(0, state.Messages.Count - MaxHistoryTurns));
    }

    private static string? NormalizeLocale(string? locale)
    {
        if (string.IsNullOrWhiteSpace(locale))
        {
            return null;
        }

        return locale.Trim();
    }

    private static string? NormalizePersona(string? persona)
    {
        if (string.IsNullOrWhiteSpace(persona))
        {
            return null;
        }

        return persona.Trim().ToLowerInvariant();
    }

    private static string? NormalizeModule(string? module)
    {
        if (string.IsNullOrWhiteSpace(module))
        {
            return null;
        }

        return module.Trim().ToLowerInvariant();
    }

    private static string NormalizeAssistantResponse(string? content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            return EmptyAiResponse;
        }

        var normalizedLines = content
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Split('\n')
            .Select(line => line.Trim())
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .Take(6)
            .ToArray();

        return normalizedLines.Length == 0
            ? EmptyAiResponse
            : string.Join('\n', normalizedLines);
    }

    private static void MergeMetadata(Dictionary<string, string> target, Dictionary<string, string>? source)
    {
        if (source is null)
        {
            return;
        }

        foreach (var (key, value) in source)
        {
            if (!string.IsNullOrWhiteSpace(key) && !string.IsNullOrWhiteSpace(value))
            {
                target[key] = value;
            }
        }
    }

    private static Dictionary<string, bool> BuildFeatureFlags()
    {
        return new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase)
        {
            ["markdown"] = true,
            ["quickReplies"] = true,
            ["conversationSearch"] = true,
            ["offlineQueue"] = true,
            ["multiDeviceSync"] = false,
            ["rag"] = false,
            ["knowledgeBase"] = false,
            ["humanHandover"] = true,
            ["pushEmailNotifications"] = false
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

    private static string BuildPromptedUserMessage(string message)
    {
        return
            "Hãy trả lời bằng tiếng Việt có dấu, cực ngắn và đúng trọng tâm." +
            "\n- Tối đa 3 câu ngắn hoặc 3 gạch đầu dòng." +
            "\n- Không lan man, không lặp lại ý." +
            "\n- Nếu thiếu dữ liệu thì nói rõ thiếu gì trong 1 câu." +
            $"\n\nTin nhắn người dùng: {message}";
    }

    private sealed class AssistantRealtimeSessionState
    {
        public string SessionId { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public string PageContext { get; set; } = string.Empty;
        public string? Module { get; set; }
        public string Locale { get; set; } = "vi-VN";
        public string Persona { get; set; } = "default";
        public string? Summary { get; set; }
        public Dictionary<string, string> Metadata { get; set; } = new(StringComparer.OrdinalIgnoreCase);
        public List<AssistantChatMessageDto> Messages { get; } = new();
    }
}
