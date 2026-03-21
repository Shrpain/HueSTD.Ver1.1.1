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

    // Cache for AI settings
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

            _logger.LogInformation("[AI] Loaded AI settings from database. Model: {Model}", _cachedModel);

            return (_cachedApiKey, _cachedModel);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AI] Failed to load AI settings from database");
            throw new Exception("AI configuration not found. Please contact administrator.");
        }
    }

    private async Task<UserAiUsage?> GetUserAiUsageAsync(Guid userId)
    {
        try
        {
            var result = await _supabaseClient
                .From<UserAiUsage>()
                .Where(u => u.UserId == userId)
                .Single();
            return result;
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
                var newUsage = new UserAiUsage
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    MessagesUsed = 1,
                    MessageLimit = 10,
                    IsUnlocked = false,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                await _supabaseClient.From<UserAiUsage>().Insert(newUsage);
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
            if (usage != null && !string.IsNullOrEmpty(usage.ApiKey))
            {
                _logger.LogInformation("[AI] Using per-user API key for user {UserId}", userId);
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
                try { userGuid = Guid.Parse(userId); } catch { }
            }

            // ===== Limit check =====
            if (userGuid.HasValue)
            {
                var usage = await GetUserAiUsageAsync(userGuid.Value);
                var hasDedicatedApi = usage != null && !string.IsNullOrWhiteSpace(usage.ApiKey);
                bool canUse = false;
                if (usage == null)
                {
                    canUse = true;
                }
                else if (hasDedicatedApi)
                {
                    // Per-user API key: không áp dụng giới hạn tin nhắn miễn phí
                    canUse = true;
                }
                else if (usage.IsUnlocked)
                {
                    canUse = true;
                }
                else if (usage.MessagesUsed < usage.MessageLimit)
                {
                    canUse = true;
                }

                if (!canUse)
                {
                    _logger.LogWarning("[AI] User {UserId} exceeded AI message limit", userId);
                    return new ChatResponse
                    {
                        Success = false,
                        Error = "Bạn đã hết lượt hỏi AI miễn phí. Vui lòng liên hệ Admin để tiếp tục.",
                        ErrorCode = "limit_exceeded"
                    };
                }

                // Chỉ tăng bộ đếm gói miễn phí khi user không dùng API key riêng
                if (!request.IsSystemPrompt && !hasDedicatedApi)
                {
                    await IncrementUsageAsync(userGuid.Value);
                }
            }

            // ===== Get API key =====
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

            _logger.LogInformation("[AI] Starting chat request. Message length: {Length}", request.Message?.Length ?? 0);

            var systemPrompt = @"Bạn là một trợ lý AI thông minh của HueSTD, chuyên trả lời câu hỏi về tài liệu học tập.
Hãy trả lời ngắn gọn, chính xác và hữu ích dựa trên nội dung tài liệu được cung cấp.
Nếu không tìm thấy thông tin trong tài liệu, hãy tìm nó ở ngoài trình duyệt.
Trả lời bằng tiếng Việt, sử dụng markdown để định dạng.";

            var messages = new List<object>
            {
                new { role = "system", content = systemPrompt }
            };

            if (!string.IsNullOrEmpty(request.Context))
            {
                messages.Add(new { role = "system", content = $"Ngữ cảnh tài liệu:\n{request.Context}" });
            }

            messages.Add(new { role = "user", content = request.Message });

            var (_, model) = await GetAiSettingsAsync();
            var requestBody = new
            {
                model = model,
                messages = messages,
                temperature = 0.7,
                max_tokens = 2000
            };

            var jsonContent = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            _httpClient.DefaultRequestHeaders.Clear();
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

            _logger.LogInformation("[AI] Sending request to {Url}", apiUrl);

            var response = await _httpClient.PostAsync(apiUrl, content);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                _logger.LogError("[AI] API Error: {StatusCode} - {Error}", response.StatusCode, errorBody);
                return new ChatResponse
                {
                    Success = false,
                    Error = $"API Error: {response.StatusCode}"
                };
            }

            var responseBody = await response.Content.ReadAsStringAsync();
            _logger.LogInformation("[AI] Response received. Length: {Length}", responseBody.Length);

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
                        Content = contentProp.GetString() ?? ""
                    };
                }
            }

            return new ChatResponse
            {
                Success = false,
                Error = "Invalid response format"
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
