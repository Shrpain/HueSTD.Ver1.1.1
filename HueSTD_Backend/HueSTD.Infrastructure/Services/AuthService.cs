using System.Text;
using System.Text.Json;
using HueSTD.Application.DTOs.Auth;
using HueSTD.Application.Exceptions;
using HueSTD.Application.Interfaces;
using HueSTD.Domain.Entities;
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

            if (session?.User == null)
            {
                throw new UnauthorizedException("Login failed.");
            }

            if (session.User.EmailConfirmedAt == null || session.User.EmailConfirmedAt == default)
            {
                throw new UnauthorizedException("Vui lòng xác nhận email trước khi đăng nhập. Kiểm tra hộp thư email của bạn.");
            }

            if (!Guid.TryParse(session.User.Id, out var userGuid))
            {
                throw new UnauthorizedException("Invalid user identifier returned by authentication provider.");
            }

            return new AuthResponse
            {
                AccessToken = session.AccessToken,
                RefreshToken = session.RefreshToken,
                User = await BuildUserDtoAsync(userGuid, session.User.Email)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Login failed for {Email}", request.Email);

            throw ex switch
            {
                AppException => ex,
                _ => new UnauthorizedException($"Đăng nhập thất bại: {ex.Message}")
            };
        }
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        var supabaseUrl = _configuration["Supabase:Url"] ?? Environment.GetEnvironmentVariable("SUPABASE_URL");
        var anonKey = _configuration["Supabase:AnonKey"] ?? Environment.GetEnvironmentVariable("SUPABASE_ANON_KEY");

        if (string.IsNullOrEmpty(supabaseUrl) || string.IsNullOrEmpty(anonKey))
        {
            throw new BadRequestException("Supabase configuration missing.");
        }

        var signupUrl = $"{supabaseUrl}/auth/v1/signup";

        using var httpClient = new HttpClient();
        httpClient.DefaultRequestHeaders.Add("apikey", anonKey);

        var payload = new
        {
            email = request.Email,
            password = request.Password,
            data = new
            {
                full_name = request.FullName ?? string.Empty,
                school = request.School ?? string.Empty
            }
        };

        var jsonPayload = JsonSerializer.Serialize(payload);
        var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

        _logger.LogDebug("Posting to: {SignupUrl}", signupUrl);

        var response = await httpClient.PostAsync(signupUrl, content);
        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();
            _logger.LogError("Signup failed: {ErrorBody}", errorBody);
            throw new BadRequestException($"Registration failed: {response.StatusCode} - {errorBody}");
        }

        return new AuthResponse
        {
            AccessToken = string.Empty,
            User = new UserDto
            {
                Id = Guid.Empty.ToString(),
                Email = request.Email,
                FullName = request.FullName ?? string.Empty,
                School = request.School ?? string.Empty
            }
        };
    }

    public async Task<UserDto?> GetCurrentUserFromTokenAsync(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            _logger.LogWarning("[AuthService] GetCurrentUserFromTokenAsync called with null/empty token");
            return null;
        }

        _logger.LogInformation("[AuthService] GetCurrentUserFromTokenAsync called. Token length: {Length}", token.Length);

        try
        {
            var user = await _supabaseClient.Auth.GetUser(token);
            if (user == null || string.IsNullOrWhiteSpace(user.Id))
            {
                _logger.LogWarning("[AuthService] GetUser returned null or empty Id");
                return null;
            }

            if (!Guid.TryParse(user.Id, out var userGuid))
            {
                _logger.LogWarning("[AuthService] UserId is not valid GUID: {UserId}", user.Id);
                return null;
            }

            return await BuildUserDtoAsync(userGuid, user.Email);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AuthService] Error validating token");
            if (ex.InnerException != null)
            {
                _logger.LogError(ex.InnerException, "[AuthService] Inner exception");
            }

            return null;
        }
    }

    public async Task<UserDto?> GetCurrentUserAsync(string userId, string? email = null)
    {
        if (!Guid.TryParse(userId, out var userGuid))
        {
            _logger.LogWarning("[AuthService] UserId is not valid GUID: {UserId}", userId);
            return null;
        }

        return await BuildUserDtoAsync(userGuid, email);
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
            var profileResult = await _supabaseClient
                .From<Profile>()
                .Where(x => x.Id == userGuid)
                .Single();

            if (profileResult == null)
            {
                _logger.LogWarning("[AuthService] Profile not found for user: {UserId}", userId);
                return false;
            }

            if (!string.IsNullOrEmpty(request.FullName)) profileResult.FullName = request.FullName;
            if (!string.IsNullOrEmpty(request.School)) profileResult.School = request.School;
            if (!string.IsNullOrEmpty(request.Major)) profileResult.Major = request.Major;
            if (!string.IsNullOrEmpty(request.AvatarUrl)) profileResult.AvatarUrl = request.AvatarUrl;

            await profileResult.Update<Profile>();

            _logger.LogInformation("[AuthService] Profile updated successfully for user: {UserId}", userId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AuthService] Error updating profile for user: {UserId}", userId);
            return false;
        }
    }

    private async Task<UserDto> BuildUserDtoAsync(Guid userGuid, string? email = null)
    {
        var profileResult = await _supabaseClient
            .From<Profile>()
            .Where(x => x.Id == userGuid)
            .Single();

        var documentStats = await _supabaseClient
            .From<Document>()
            .Where(x => x.UploaderId == userGuid)
            .Get();

        var totalDocs = documentStats.Models.Count;
        var totalDownloads = documentStats.Models.Sum(x => x.Downloads);

        var userPoints = profileResult?.Points ?? 0;
        var higherRankedCount = await _supabaseClient
            .From<Profile>()
            .Filter("points", Supabase.Postgrest.Constants.Operator.GreaterThan, userPoints.ToString())
            .Count(Supabase.Postgrest.Constants.CountType.Exact);

        return new UserDto
        {
            Id = userGuid.ToString(),
            Email = email ?? profileResult?.Email,
            FullName = profileResult?.FullName,
            Role = profileResult?.Role ?? "user",
            School = profileResult?.School,
            Major = profileResult?.Major,
            AvatarUrl = profileResult?.AvatarUrl,
            Points = userPoints,
            Rank = (int)higherRankedCount + 1,
            Badge = profileResult?.Badge,
            PublicId = profileResult?.PublicId,
            TotalDocuments = totalDocs,
            TotalDownloads = totalDownloads,
            AverageRating = 0.0,
            CreatedAt = profileResult?.CreatedAt ?? DateTime.UtcNow
        };
    }
}
