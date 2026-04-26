using System.Text;
using System.Text.Json;
using System.Web;
using HueSTD.Application.DTOs.AI;
using HueSTD.Application.Interfaces;
using HueSTD.Domain.Entities;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Supabase;

namespace HueSTD.Infrastructure.Services;

public class AiService : IAiService
{
    private readonly Supabase.Client _supabaseClient;
    private readonly HttpClient _httpClient;
    private readonly ILogger<AiService> _logger;
    private readonly string _apiUrl;
    private readonly string _defaultApiKey;
    private readonly string _fallbackApiUrl;
    private readonly string _fallbackApiKey;
    private readonly string _fallbackModel;
    private readonly IMemoryCache _cache;

    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);
    private const string AiSettingsCacheKey = "ai_settings";

    // Helper to mask sensitive info in URLs (remove query params like 'key')
    private static string MaskUrl(string url)
    {
        try
        {
            if (Uri.TryCreate(url, UriKind.Absolute, out var uri))
            {
                var query = HttpUtility.ParseQueryString(uri.Query);
                query.Remove("key");
                query.Remove("api_key");
                var builder = new UriBuilder(uri) { Query = query.ToString() };
                return builder.Uri.ToString();
            }
        }
        catch { }
        return url;
    }

    public AiService(Supabase.Client supabaseClient, HttpClient httpClient, ILogger<AiService> logger, IConfiguration configuration, IMemoryCache cache)
    {
        _supabaseClient = supabaseClient;
        _httpClient = httpClient;
        _logger = logger;
        _cache = cache;
        _apiUrl = configuration["AI:ApiUrl"] ?? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
        _defaultApiKey = configuration["AI:DefaultApiKey"] ?? string.Empty;
        _fallbackApiUrl = configuration["AI:FallbackApiUrl"] ?? string.Empty;
        _fallbackApiKey = configuration["AI:FallbackApiKey"] ?? string.Empty;
        _fallbackModel = configuration["AI:FallbackModel"] ?? "gemini-2.0-flash";
        _logger.LogInformation("[AI] Primary: {ApiUrl}, Fallback: {FallbackUrl}", _apiUrl, _fallbackApiUrl);
    }

    public async Task<ChatResponse> ChatAsync(ChatRequest request, string? userId = null)
    {
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

        if (!string.IsNullOrWhiteSpace(request.Context))
        {
            messages.Add(new { role = "system", content = $"Ngữ cảnh HueSTD:\n{request.Context}" });
        }

        messages.Add(new { role = "user", content = request.Message });
        return await SendMessagesAsync(messages, userId, request.IsSystemPrompt, temperature: 0.2m, maxTokens: 1600);
    }

    public async Task<ChatResponse> CompleteAsync(AiCompletionRequest request, string? userId = null)
    {
        var messages = new List<object>
        {
            new { role = "system", content = request.SystemPrompt },
            new { role = "user", content = request.UserPrompt }
        };

        return await SendMessagesAsync(messages, userId, isSystemPrompt: false, request.Temperature, request.MaxTokens);
    }

    public async Task<GeneratedExamDto?> GenerateExamAsync(GenerateExamRequest request, string? userId = null)
    {
        var systemPrompt = """
        Bạn là chuyên gia giáo dục của HueSTD.
        Nhiệm vụ của bạn là tạo đề thi trắc nghiệm từ nội dung văn bản được cung cấp.
        YÊU CẦU BẮT BUỘC:
        1. Trả về kết quả DUY NHẤT dưới định dạng JSON nguyên bản, không kèm markdown code block.
        2. Cấu trúc JSON phải khớp chính xác:
           {
             "title": "Tiêu đề đề thi",
             "description": "Mô tả ngắn gọn nội dung",
             "questions": [
               {
                 "text": "Nội dung câu hỏi",
                 "points": 1.0,
                 "options": [
                   { "key": "A", "text": "Đáp án 1", "isCorrect": true },
                   { "key": "B", "text": "Đáp án 2", "isCorrect": false },
                   { "key": "C", "text": "Đáp án 3", "isCorrect": false },
                   { "key": "D", "text": "Đáp án 4", "isCorrect": false }
                 ]
               }
             ]
           }
        3. Tạo đúng số lượng câu hỏi yêu cầu. Mỗi câu hỏi chỉ 1 đáp án đúng. Luôn có 4 đáp án A,B,C,D.
        """;

        var userPrompt = $"Dựa trên nội dung sau, hãy tạo {request.QuestionCount} câu hỏi trắc nghiệm:\n\n{request.Content}";

        var messages = new List<object>
        {
            new { role = "system", content = systemPrompt },
            new { role = "user", content = userPrompt }
        };

        var response = await SendMessagesAsync(messages, userId, isSystemPrompt: false, temperature: 0.1m, maxTokens: 4000);

        if (response.Success && !string.IsNullOrWhiteSpace(response.Content))
        {
            try
            {
                var json = response.Content.Trim();
                if (json.StartsWith("```json")) json = json.Substring(7);
                if (json.EndsWith("```")) json = json.Substring(0, json.Length - 3);
                json = json.Trim();

                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                return JsonSerializer.Deserialize<GeneratedExamDto>(json, options);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[AI] Failed to parse generated exam JSON");
                return null;
            }
        }

        return null;
    }

    private async Task<(string apiKey, string model)> GetAiSettingsAsync()
    {
        return await _cache.GetOrCreateAsync(AiSettingsCacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheDuration;
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

                var key = apiKeyResult?.KeyValue;
                if (string.IsNullOrWhiteSpace(key))
                {
                    key = _defaultApiKey;
                }
                if (string.IsNullOrWhiteSpace(key))
                {
                    throw new Exception("AI API Key not configured in database or appsettings.");
                }
                var model = modelResult?.KeyValue ?? "gemini-2.0-flash";
                _logger.LogInformation("[AI] Loaded AI settings from DB. Model: {Model}", model);
                return (key, model);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[AI] Failed to load AI settings from database, trying config fallback");
                if (!string.IsNullOrWhiteSpace(_defaultApiKey))
                {
                    return (_defaultApiKey, "gemini-2.0-flash");
                }
                throw new Exception("Khong tim thay cau hinh AI. Vui long lien he quan tri vien.");
            }
        })!;
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

    private async Task<ChatResponse> SendMessagesAsync(IEnumerable<object> messages, string? userId, bool isSystemPrompt, decimal temperature, int maxTokens)
    {
        try
        {
            Guid? userGuid = null;
            if (!string.IsNullOrWhiteSpace(userId) && Guid.TryParse(userId, out var parsedUserId))
            {
                userGuid = parsedUserId;
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
                        Error = "Ban da het luot hoi AI mien phi. Vui long lien he Admin de tiep tuc.",
                        ErrorCode = "limit_exceeded"
                    };
                }

                if (!isSystemPrompt && !hasDedicatedApi)
                {
                    await IncrementUsageAsync(userGuid.Value);
                }
            }

            string? apiKey = null;
            if (userGuid.HasValue)
            {
                apiKey = await GetEffectiveApiKeyAsync(userGuid.Value);
            }

            if (string.IsNullOrWhiteSpace(apiKey))
            {
                (apiKey, _) = await GetAiSettingsAsync();
            }

            var (_, model) = await GetAiSettingsAsync();

            if (string.IsNullOrWhiteSpace(apiKey))
            {
                return new ChatResponse
                {
                    Success = false,
                    Error = "Khong tim thay cau hinh AI. Vui long lien he quan tri vien."
                };
            }

            // Try primary (proxy), fallback to direct Gemini if it fails
            var result = await TryCallApiAsync(apiKey!, model, messages, temperature, maxTokens, _apiUrl, "Primary");
            if (!result.Success && !string.IsNullOrWhiteSpace(_fallbackApiUrl))
            {
                _logger.LogWarning("[AI] Primary failed ({Error}), trying fallback...", result.Error);
                result = await TryCallApiAsync(_fallbackApiKey, _fallbackModel, messages, temperature, maxTokens, _fallbackApiUrl, "Fallback");
            }
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AI] Exception during completion");
            return new ChatResponse
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    private async Task<ChatResponse> TryCallApiAsync(string apiKey, string model, IEnumerable<object> messages, decimal temperature, int maxTokens, string url, string label)
    {
        try
        {
            var isGeminiNative = url.Contains(":generateContent");
            object requestBody;

            if (isGeminiNative)
            {
                // Format for Gemini Native API (contents/parts/text)
                var geminiMessages = new List<object>();
                foreach (dynamic msg in messages)
                {
                    geminiMessages.Add(new
                    {
                        role = msg.role == "assistant" ? "model" : msg.role,
                        parts = new[] { new { text = msg.content } }
                    });
                }

                requestBody = new
                {
                    contents = geminiMessages,
                    generationConfig = new
                    {
                        temperature = (float)temperature,
                        maxOutputTokens = maxTokens
                    }
                };

                // For Gemini native, we pass key in URL or header
                if (!url.Contains("key="))
                {
                    url += (url.Contains("?") ? "&" : "?") + "key=" + apiKey;
                }
            }
            else
            {
                // Standard OpenAI format
                requestBody = new
                {
                    model,
                    messages,
                    temperature,
                    max_tokens = maxTokens
                };
            }

            var content = new StringContent(
                JsonSerializer.Serialize(requestBody),
                Encoding.UTF8,
                "application/json");

            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Content = content;
            
            if (!isGeminiNative)
            {
                request.Headers.Add("Authorization", $"Bearer {apiKey}");
            }

            _logger.LogInformation("[AI] [{Label}] Calling: {Url} model: {Model}", label, MaskUrl(url), model);
            var response = await _httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                _logger.LogError("[AI] [{Label}] Error: {StatusCode} - {Error}", label, response.StatusCode, errorBody);
                return new ChatResponse
                {
                    Success = false,
                    Error = $"[{label}] AI API loi: {response.StatusCode}"
                };
            }

            var responseBody = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(responseBody);
            var root = doc.RootElement;

            if (isGeminiNative)
            {
                // Parse Gemini Native Response
                if (root.TryGetProperty("candidates", out var candidates) &&
                    candidates.ValueKind == JsonValueKind.Array &&
                    candidates.GetArrayLength() > 0 &&
                    candidates[0].TryGetProperty("content", out var geminiContent) &&
                    geminiContent.TryGetProperty("parts", out var parts) &&
                    parts.ValueKind == JsonValueKind.Array &&
                    parts.GetArrayLength() > 0 &&
                    parts[0].TryGetProperty("text", out var textProp))
                {
                    _logger.LogInformation("[AI] [{Label}] Success (Gemini Native)!", label);
                    return new ChatResponse
                    {
                        Success = true,
                        Content = textProp.GetString() ?? string.Empty
                    };
                }
            }
            else
            {
                // Parse OpenAI Response
                if (root.TryGetProperty("choices", out var choices) &&
                    choices.ValueKind == JsonValueKind.Array &&
                    choices.GetArrayLength() > 0 &&
                    choices[0].TryGetProperty("message", out var msg) &&
                    msg.TryGetProperty("content", out var contentProp))
                {
                    _logger.LogInformation("[AI] [{Label}] Success (OpenAI)!", label);
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
                Error = $"[{label}] Dinh dang phan hoi AI khong hop le."
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AI] [{Label}] Exception", label);
            return new ChatResponse
            {
                Success = false,
                Error = $"[{label}] {ex.Message}"
            };
        }
    }
}
