using HueSTD.Application.DTOs.Auth;
using HueSTD.Application.Interfaces;
using HueSTD.Domain.Entities;
using Supabase.Gotrue;
using System.Text;
using System.Text.Json;

using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace HueSTD.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly Supabase.Client _supabaseClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;

    public AuthService(Supabase.Client supabaseClient, IConfiguration configuration, ILogger<AuthService> logger)
    {
        _supabaseClient = supabaseClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        try
        {
            var session = await _supabaseClient.Auth.SignIn(request.Email, request.Password);

            if (session == null || session.User == null)
            {
                throw new Exception("Login failed.");
            }

            // Check if email is confirmed
            if (session.User.EmailConfirmedAt == null || session.User.EmailConfirmedAt == default(DateTime))
            {
                throw new Exception("Vui lòng xác nhận email trước khi đăng nhập. Kiểm tra hộp thư email của bạn.");
            }

            // Fetch full profile data after login
            if (!Guid.TryParse(session.User.Id, out var userGuid))
            {
                 throw new Exception("Invalid User ID format from Supabase.");
            }

            var profileResult = await _supabaseClient
                .From<HueSTD.Domain.Entities.Profile>()
                .Where(x => x.Id == userGuid)
                .Single();

            // Fetch Stats
            var documentStats = await _supabaseClient
                .From<HueSTD.Domain.Entities.Document>()
                .Where(x => x.UploaderId == userGuid)
                .Get();

            var totalDocs = documentStats.Models.Count;
            var totalDownloads = documentStats.Models.Sum(x => x.Downloads);

            // Calculate rank
            var userPoints = profileResult?.Points ?? 0;
            var higherRankedCount = await _supabaseClient
                .From<HueSTD.Domain.Entities.Profile>()
                .Filter("points", Supabase.Postgrest.Constants.Operator.GreaterThan, userPoints.ToString())
                .Count(Supabase.Postgrest.Constants.CountType.Exact);
            var rank = (int)higherRankedCount + 1;

            return new AuthResponse
            {
                AccessToken = session.AccessToken,
                RefreshToken = session.RefreshToken,
                User = new UserDto
                {
                    Id = session.User.Id,
                    Email = session.User.Email,
                    FullName = profileResult?.FullName,
                    Role = profileResult?.Role ?? "user",
                    School = profileResult?.School,
                    Major = profileResult?.Major,
                    AvatarUrl = profileResult?.AvatarUrl,
                    Points = userPoints,
                    Rank = rank,
                    Badge = profileResult?.Badge,
                    PublicId = profileResult?.PublicId,
                    TotalDocuments = totalDocs,
                    TotalDownloads = totalDownloads,
                    AverageRating = 0.0,
                    CreatedAt = profileResult?.CreatedAt ?? DateTime.UtcNow
                }
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Login failed for {Email}", request.Email);
            throw new Exception($"Đăng nhập thất bại: {ex.Message}");
        }
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        // Use /signup endpoint to require email confirmation
        var supabaseUrl = _configuration["Supabase:Url"] ?? Environment.GetEnvironmentVariable("SUPABASE_URL");
        var supabaseKey = _configuration["Supabase:Key"] ?? Environment.GetEnvironmentVariable("SUPABASE_KEY");
        var anonKey = _configuration["Supabase:AnonKey"] ?? Environment.GetEnvironmentVariable("SUPABASE_ANON_KEY");

        if (string.IsNullOrEmpty(supabaseUrl) || string.IsNullOrEmpty(anonKey))
             throw new Exception("Supabase configuration missing.");

        // Use /signup endpoint - this will send confirmation email
        var signupUrl = $"{supabaseUrl}/auth/v1/signup";

        using var httpClient = new HttpClient();
        httpClient.DefaultRequestHeaders.Add("apikey", anonKey);

        var payload = new
        {
            email = request.Email,
            password = request.Password,
            data = new 
            { 
                full_name = request.FullName ?? "",
                school = request.School ?? "" 
            }
        };

        var jsonPayload = JsonSerializer.Serialize(payload);
        var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

        _logger.LogDebug("Posting to: {SignupUrl}", signupUrl);

        var response = await httpClient.PostAsync(signupUrl, content);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();
            _logger.LogError("Signup Failed: {ErrorBody}", errorBody);
            throw new Exception($"Registration failed: {response.StatusCode} - {errorBody}");
        }

        // Return message asking user to check email for confirmation
        return new AuthResponse
        {
            AccessToken = "",
            User = new UserDto
            {
                Id = Guid.Empty.ToString(),
                Email = request.Email,
                FullName = request.FullName ?? "",
                School = request.School ?? ""
            }
        };
    }

    public async Task<UserDto?> GetCurrentUserAsync(string token)
    {
        if (string.IsNullOrEmpty(token))
        {
            _logger.LogWarning("[AuthService] GetCurrentUserAsync called with null/empty token");
            return null;
        }

        _logger.LogInformation("[AuthService] GetCurrentUserAsync called. Token length: {Length}", token.Length);
        try
        {
            var user = await _supabaseClient.Auth.GetUser(token);
            if (user == null || string.IsNullOrEmpty(user.Id))
            {
                _logger.LogWarning("[AuthService] GetUser returned null or empty Id");
                return null;
            }

            _logger.LogInformation("[AuthService] Token valid. UserId: {UserId}, Email: {Email}", user.Id, user.Email);

            if (!Guid.TryParse(user.Id, out var userGuid))
            {
                _logger.LogWarning("[AuthService] UserId is not valid GUID: {UserId}", user.Id);
                return null;
            }

            // Fetch profile data from public.profiles
            var profileResult = await _supabaseClient
                .From<HueSTD.Domain.Entities.Profile>()
                .Where(x => x.Id == userGuid)
                .Single();

            // Fetch Stats
            var documentStats = await _supabaseClient
                .From<HueSTD.Domain.Entities.Document>()
                .Where(x => x.UploaderId == userGuid)
                .Get();
            
            var totalDocs = documentStats.Models.Count;
            var totalDownloads = documentStats.Models.Sum(x => x.Downloads);

            // Calculate rank
            var userPoints = profileResult?.Points ?? 0;
            var higherRankedCount = await _supabaseClient
                .From<HueSTD.Domain.Entities.Profile>()
                .Filter("points", Supabase.Postgrest.Constants.Operator.GreaterThan, userPoints.ToString())
                .Count(Supabase.Postgrest.Constants.CountType.Exact);
            var rank = (int)higherRankedCount + 1;

            return new UserDto
            {
                Id = user.Id,
                Email = user.Email,
                FullName = profileResult?.FullName,
                Role = profileResult?.Role ?? "user",
                School = profileResult?.School,
                Major = profileResult?.Major,
                AvatarUrl = profileResult?.AvatarUrl,
                Points = userPoints,
                Rank = rank,
                Badge = profileResult?.Badge,
                PublicId = profileResult?.PublicId,
                TotalDocuments = totalDocs,
                TotalDownloads = totalDownloads,
                AverageRating = 0.0, // Placeholder
                CreatedAt = profileResult?.CreatedAt ?? DateTime.UtcNow
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AuthService] Error validating token");
            if (ex.InnerException != null)
            {
                _logger.LogError(ex.InnerException, "[AuthService] Inner Exception");
            }
            return null;
        }
    }

    public async Task<bool> UpdateProfileAsync(string userId, UpdateProfileRequest request)
    {
        if (!Guid.TryParse(userId, out var userGuid))
        {
            _logger.LogWarning("[AuthService] Invalid user ID format: {UserId}", userId);
            return false;
        }

        try
        {
            // Fetch existing profile
            var profileResult = await _supabaseClient
                .From<HueSTD.Domain.Entities.Profile>()
                .Where(x => x.Id == userGuid)
                .Single();

            if (profileResult == null)
            {
                _logger.LogWarning("[AuthService] Profile not found for user: {UserId}", userId);
                return false;
            }

            // Update only provided fields
            if (!string.IsNullOrEmpty(request.FullName)) profileResult.FullName = request.FullName;
            if (!string.IsNullOrEmpty(request.School)) profileResult.School = request.School;
            if (!string.IsNullOrEmpty(request.Major)) profileResult.Major = request.Major;
            if (!string.IsNullOrEmpty(request.AvatarUrl)) profileResult.AvatarUrl = request.AvatarUrl;

            await profileResult.Update<HueSTD.Domain.Entities.Profile>();

            _logger.LogInformation("[AuthService] Profile updated successfully for user: {UserId}", userId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AuthService] Error updating profile for user: {UserId}", userId);
            return false;
        }
    }
}
