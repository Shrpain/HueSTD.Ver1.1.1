using HueSTD.Application.DTOs.Auth;
using HueSTD.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Supabase;

namespace HueSTD.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly Client _supabaseClient;

    public AuthController(IAuthService authService, Client supabaseClient)
    {
        _authService = authService;
        _supabaseClient = supabaseClient;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        try
        {
            var result = await _authService.RegisterAsync(request);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        try
        {
            var result = await _authService.LoginAsync(request);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var authHeader = Request.Headers["Authorization"].ToString();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        {
            return Unauthorized(new { message = "No token provided." });
        }

        var token = authHeader.Substring("Bearer ".Length).Trim();
        var user = await _authService.GetCurrentUserAsync(token);

        if (user == null)
        {
            return Unauthorized(new { message = "Invalid or expired token." });
        }

        return Ok(user);
    }

    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var authHeader = Request.Headers["Authorization"].ToString();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        {
            return Unauthorized(new { message = "No token provided." });
        }

        var token = authHeader.Substring("Bearer ".Length).Trim();
        
        // Use the token to get the user ID from Supabase Auth
        var userDto = await _authService.GetCurrentUserAsync(token);
        if (userDto == null || string.IsNullOrEmpty(userDto.Id))
        {
            return Unauthorized(new { message = "Invalid or expired token." });
        }

        var result = await _authService.UpdateProfileAsync(userDto.Id, request);

        if (!result)
        {
            return BadRequest(new { message = "Failed to update profile." });
        }

        return Ok(new { message = "Profile updated successfully." });
    }
}
