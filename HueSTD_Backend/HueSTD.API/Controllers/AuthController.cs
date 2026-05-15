using HueSTD.Application.DTOs.Auth;
using HueSTD.Application.Exceptions;
using HueSTD.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HueSTD.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ApiControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var result = await _authService.RegisterAsync(request);
        return Ok(result);
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await _authService.LoginAsync(request);

        // Set HttpOnly cookies for access and refresh tokens
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = false, // Set to false for local development without HTTPS
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(30),
            Path = "/"
        };

        Response.Cookies.Append("access_token", result.AccessToken, cookieOptions);
        if (!string.IsNullOrEmpty(result.RefreshToken))
        {
            Response.Cookies.Append("refresh_token", result.RefreshToken, cookieOptions);
        }

        // Return user info but omit tokens from the response body to encourage cookie usage
        return Ok(result.User);
    }

    [AllowAnonymous]
    [HttpPost("login-callback")]
    public async Task<IActionResult> LoginCallback([FromBody] LoginCallbackRequest request)
    {
        var user = await _authService.GetCurrentUserFromTokenAsync(request.AccessToken);
        if (user == null)
        {
            throw new UnauthorizedException("Invalid Google access token.");
        }

        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = false,
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(30),
            Path = "/"
        };

        Response.Cookies.Append("access_token", request.AccessToken, cookieOptions);
        if (!string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            Response.Cookies.Append("refresh_token", request.RefreshToken, cookieOptions);
        }

        return Ok(user);
    }

    [AllowAnonymous]
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = false,
            SameSite = SameSiteMode.Lax,
            Path = "/"
        };

        Response.Cookies.Delete("access_token", cookieOptions);
        Response.Cookies.Delete("refresh_token", cookieOptions);

        return Ok(new { message = "Logged out successfully" });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var user = await _authService.GetCurrentUserAsync(CurrentUserIdValue, CurrentUserEmail);
        if (user == null)
        {
            throw new UnauthorizedException("Invalid or expired token.");
        }

        user.AccessToken = Request.Cookies["access_token"];
        return Ok(user);
    }

    [Authorize]
    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var updated = await _authService.UpdateProfileAsync(CurrentUserIdValue, request);
        if (!updated)
        {
            throw new BadRequestException("Failed to update profile.");
        }

        return Ok(new { message = "Profile updated successfully." });
    }
}
