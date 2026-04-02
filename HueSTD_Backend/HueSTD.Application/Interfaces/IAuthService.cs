using HueSTD.Application.DTOs.Auth;

namespace HueSTD.Application.Interfaces;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request);
    Task<AuthResponse> LoginAsync(LoginRequest request);
    Task<UserDto?> GetCurrentUserFromTokenAsync(string token);
    Task<UserDto?> GetCurrentUserAsync(string userId, string? email = null);
    Task<bool> UpdateProfileAsync(string userId, UpdateProfileRequest request);
}
