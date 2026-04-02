using System.Text;
using System.Text.Json;
using HueSTD.Application.DTOs.AI;
using HueSTD.Application.Interfaces;
using HueSTD.Domain.Entities;
using Microsoft.Extensions.Logging;
using Supabase;

namespace HueSTD.Infrastructure.Services;

public class AiService : IAiService
{
    private readonly Supabase.Client _supabaseClient;
    private readonly HttpClient _httpClient;
    private readonly ILogger<AiService> _logger;

    private static string? _cachedApiKey;
    private static string? _cachedModel;
    private static DateTime _cacheExpiry = DateTime.MinValue;
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);

    public AiService(Supabase.Client supabaseClient, HttpClient httpClient, ILogger<AiService> logger)
    {
        _supabaseClient = supabaseClient;
        _httpClient = httpClient;
        _logger = logger;
    }

    private async Task<(string apiKey, string model)> GetAiSettingsAsync()
    {
        if (_cachedApiKey != null && _cachedModel != null && DateTime.UtcNow < _cacheExpiry)
        {
            return (_cachedApiKey, _cachedModel);
        }

        try
        {
            var apiKeyResult = await _supabaseClient
                .From<ApiSettings>()
                .Where(s => s.KeyName == "ai_api_key")
                .Single();

            var modelResult = await _supabaseClient
                .From<ApiSettings>()
                .Where(s => s.KeyName == "ai_model")
                .Single();

            _cachedApiKey = apiKeyResult?.KeyValue ?? throw new Exception("AI API Key not configured");
            _cachedModel = modelResult?.KeyValue ?? "gemini-3-flash";
            _cacheExpiry = DateTime.UtcNow.Add(CacheDuration);

            _logger.LogInformation("[AI] Loaded AI settings from database.");
            return (_cachedApiKey, _cachedModel);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AI] Failed to load AI settings from database");
            throw new Exception("Không tìm thấy cấu hình AI. Vui lòng liên hệ quản trị viên.");
        }
    }

    private async Task<UserAiUsage?> GetUserAiUsageAsync(Guid userId)
    {
        try
        {
            return await _supabaseClient
                .From<UserAiUsage>()
                .Where(u => u.UserId == userId)
                .Single();
        }
        catch
        {
            return null;
        }
    }

    private async Task IncrementUsageAsync(Guid userId)
    {
        try
        {
            var usage = await GetUserAiUsageAsync(userId);
            if (usage == null)
            {
                await _supabaseClient.From<UserAiUsage>().Insert(new UserAiUsage
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    MessagesUsed = 1,
                    MessageLimit = 10,
                    IsUnlocked = false,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }
            else
            {
                usage.MessagesUsed += 1;
                usage.UpdatedAt = DateTime.UtcNow;
                await _supabaseClient.From<UserAiUsage>().Upsert(usage);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[AI] Failed to increment usage for user {UserId}", userId);
        }
    }

    private async Task<string> GetEffectiveApiKeyAsync(Guid userId)
    {
        try
        {
            var usage = await GetUserAiUsageAsync(userId);
            if (usage != null && !string.IsNullOrWhiteSpace(usage.ApiKey))
            {
                return usage.ApiKey!;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[AI] Failed to get per-user API key, using global");
        }

        var (globalKey, _) = await GetAiSettingsAsync();
        return globalKey;
    }

    public async Task<ChatResponse> ChatAsync(ChatRequest request, string? userId = null)
    {
        try
        {
            Guid? userGuid = null;
            if (!string.IsNullOrEmpty(userId))
            {
                try
                {
                    userGuid = Guid.Parse(userId);
                }
                catch
                {
                    // ignore invalid user id
                }
            }

            if (userGuid.HasValue)
            {
                var usage = await GetUserAiUsageAsync(userGuid.Value);
                var hasDedicatedApi = usage != null && !string.IsNullOrWhiteSpace(usage.ApiKey);
                var canUse = usage == null ||
                             hasDedicatedApi ||
                             usage.IsUnlocked ||
                             usage.MessagesUsed < usage.MessageLimit;

                if (!canUse)
                {
                    return new ChatResponse
                    {
                        Success = false,
                        Error = "Bạn đã hết lượt hỏi AI miễn phí. Vui lòng liên hệ Admin để tiếp tục.",
                        ErrorCode = "limit_exceeded"
                    };
                }

                if (!request.IsSystemPrompt && !hasDedicatedApi)
                {
                    await IncrementUsageAsync(userGuid.Value);
                }
            }

            var apiKey = _cachedApiKey;
            if (userGuid.HasValue)
            {
                apiKey = await GetEffectiveApiKeyAsync(userGuid.Value);
            }

            if (string.IsNullOrEmpty(apiKey))
            {
                var (globalKey, _) = await GetAiSettingsAsync();
                apiKey = globalKey;
            }

            var apiUrl = "http://127.0.0.1:8045/v1/chat/completions";
            var systemPrompt = """
Bạn là trợ lý HueSTD.
Không bao giờ nói về nguồn gốc công nghệ, model, hãng AI, nhà phát triển hay dữ liệu hệ thống nội bộ.
Không tìm kiếm trên internet và không trả lời các vấn đề ngoài phạm vi HueSTD.
Chỉ sử dụng ngữ cảnh mà backend HueSTD cung cấp.
Không tiết lộ dữ liệu cá nhân hoặc dữ liệu nhạy cảm của bất kỳ người dùng nào.
Nếu thông tin nhạy cảm bị hỏi tới, hãy yêu cầu người dùng liên hệ Admin HueSTD.
Không được nhận là có quyền chỉnh sửa dữ liệu. Bạn chỉ có quyền đọc.
Luôn trả lời bằng tiếng Việt có dấu, ngắn gọn, rõ ràng, và trình bày đẹp bằng markdown.
""";

            var messages = new List<object>
            {
                new { role = "system", content = systemPrompt }
            };

            if (!string.IsNullOrEmpty(request.Context))
            {
                messages.Add(new { role = "system", content = $"Ngữ cảnh HueSTD:\n{request.Context}" });
            }

            messages.Add(new { role = "user", content = request.Message });

            var (_, model) = await GetAiSettingsAsync();
            var requestBody = new
            {
                model,
                messages,
                temperature = 0.2,
                max_tokens = 1600
            };

            var jsonContent = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

            var response = await _httpClient.PostAsync(apiUrl, content);
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                _logger.LogError("[AI] API Error: {StatusCode} - {Error}", response.StatusCode, errorBody);
                return new ChatResponse
                {
                    Success = false,
                    Error = $"AI API lỗi: {response.StatusCode}"
                };
            }

            var responseBody = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(responseBody);
            var root = doc.RootElement;

            if (root.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0)
            {
                var firstChoice = choices[0];
                if (firstChoice.TryGetProperty("message", out var message) &&
                    message.TryGetProperty("content", out var contentProp))
                {
                    return new ChatResponse
                    {
                        Success = true,
                        Content = contentProp.GetString() ?? string.Empty
                    };
                }
            }

            return new ChatResponse
            {
                Success = false,
                Error = "Định dạng phản hồi AI không hợp lệ."
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AI] Exception during chat");
            return new ChatResponse
            {
                Success = false,
                Error = ex.Message
            };
        }
    }
}
