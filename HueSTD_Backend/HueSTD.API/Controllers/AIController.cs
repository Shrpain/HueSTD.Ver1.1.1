using HueSTD.Application.DTOs.AI;
using HueSTD.Application.DTOs.Auth;
using HueSTD.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HueSTD.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AI : ControllerBase
{
    private readonly IAiService _aiService;
    private readonly IAdminService _adminService;
    private readonly IAuthService _authService;
    private readonly ILogger<AI> _logger;

    public AI(IAiService aiService, IAdminService adminService, IAuthService authService, ILogger<AI> logger)
    {
        _aiService = aiService;
        _adminService = adminService;
        _authService = authService;
        _logger = logger;
    }

    private string? GetTokenFromHeader()
    {
        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
            return null;
        return authHeader.Substring("Bearer ".Length);
    }

    private async Task<UserDto?> GetAuthenticatedUserAsync()
    {
        var token = GetTokenFromHeader();
        if (string.IsNullOrEmpty(token))
        {
            _logger.LogWarning("[AI Controller] No Bearer token found in Authorization header");
            return null;
        }
        _logger.LogInformation("[AI Controller] Bearer token found, length: {Length}", token.Length);
        return await _authService.GetCurrentUserAsync(token);
    }

    private bool IsAdminOrModerator(UserDto? user)
    {
        return user?.Role == "admin" || user?.Role == "moderator";
    }

    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] ChatRequest request)
    {
        try
        {
            var user = await GetAuthenticatedUserAsync();
            _logger.LogInformation("[AI Controller] Chat request received. Message: {Message}, UserId: {UserId}",
                request.Message?.Substring(0, Math.Min(100, request.Message?.Length ?? 0)), user?.Id);

            if (string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(new { success = false, error = "Message is required" });
            }

            var result = await _aiService.ChatAsync(request, user?.Id);

            if (result.Success)
            {
                return Ok(new { success = true, content = result.Content });
            }
            else
            {
                _logger.LogError("[AI Controller] Chat failed: {Error}", result.Error);
                if (result.ErrorCode == "limit_exceeded")
                {
                    return StatusCode(403, new { success = false, error = result.Error, errorCode = "limit_exceeded" });
                }
                return StatusCode(500, new { success = false, error = result.Error });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AI Controller] Unexpected error");
            return StatusCode(500, new { success = false, error = "Internal server error" });
        }
    }

    [HttpGet("settings")]
    public async Task<IActionResult> GetAISettings()
    {
        try
        {
            var apiKeySetting = await _adminService.GetApiSettingAsync("ai_api_key");
            var modelSetting = await _adminService.GetApiSettingAsync("ai_model");

            return Ok(new
            {
                apiKey = apiKeySetting?.KeyValue ?? "",
                model = modelSetting?.KeyValue ?? "gemini-3-flash"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AI Controller] Error getting AI settings");
            return StatusCode(500, new { error = "Failed to get AI settings" });
        }
    }

    [HttpPut("settings")]
    public async Task<IActionResult> UpdateAISettings([FromBody] UpdateAISettingsRequest request)
    {
        try
        {
            var user = await GetAuthenticatedUserAsync();
            if (!IsAdminOrModerator(user))
            {
                return StatusCode(403, new { error = "Forbidden" });
            }

            if (!string.IsNullOrEmpty(request.ApiKey))
            {
                await _adminService.UpdateApiSettingAsync("ai_api_key",
                    new Application.DTOs.Admin.UpdateApiSettingRequest { KeyValue = request.ApiKey });
            }

            if (!string.IsNullOrEmpty(request.Model))
            {
                await _adminService.UpdateApiSettingAsync("ai_model",
                    new Application.DTOs.Admin.UpdateApiSettingRequest { KeyValue = request.Model });
            }

            return Ok(new { message = "AI settings updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AI Controller] Error updating AI settings");
            return StatusCode(500, new { error = "Failed to update AI settings" });
        }
    }

    // ===== User AI Usage (Admin) =====

    [HttpGet("admin/users")]
    public async Task<IActionResult> GetAllUserAiUsages(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null)
    {
        try
        {
            var user = await GetAuthenticatedUserAsync();
            if (!IsAdminOrModerator(user))
                return StatusCode(403, new { error = "Forbidden" });

            var result = await _adminService.GetUserAiUsagesPaginatedAsync(page, pageSize, search);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AI Controller] Error getting paginated user AI usages");
            return StatusCode(500, new { error = "Failed to get user AI usages" });
        }
    }

    [HttpGet("admin/users-with-dedicated-api")]
    public async Task<IActionResult> GetUsersWithDedicatedApi()
    {
        try
        {
            var user = await GetAuthenticatedUserAsync();
            if (!IsAdminOrModerator(user))
                return StatusCode(403, new { error = "Forbidden" });

            var items = await _adminService.GetUsersWithDedicatedApiAsync();
            return Ok(items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AI Controller] Error getting users with dedicated API");
            return StatusCode(500, new { error = "Failed to get dedicated API users" });
        }
    }

    [HttpGet("admin/users/{userId}")]
    public async Task<IActionResult> GetUserAiUsage(string userId)
    {
        try
        {
            var usage = await _adminService.GetUserAiUsageAsync(userId);
            if (usage == null) return NotFound(new { error = "User AI usage not found" });
            return Ok(usage);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AI Controller] Error getting user AI usage for {UserId}", userId);
            return StatusCode(500, new { error = "Failed to get user AI usage" });
        }
    }

    [HttpPut("admin/users/{userId}")]
    public async Task<IActionResult> UpdateUserAiUsage(string userId, [FromBody] UpdateUserAiUsageRequest request)
    {
        try
        {
            var user = await GetAuthenticatedUserAsync();
            if (!IsAdminOrModerator(user))
                return StatusCode(403, new { error = "Forbidden" });

            var result = await _adminService.UpdateUserAiUsageAsync(userId, request);
            if (result == null) return NotFound(new { error = "Failed to update user AI usage" });
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AI Controller] Error updating user AI usage for {UserId}", userId);
            return StatusCode(500, new { error = "Failed to update user AI usage" });
        }
    }

    [HttpPost("admin/users/{userId}/reset")]
    public async Task<IActionResult> ResetUserAiUsage(string userId, [FromBody] ResetUserAiUsageRequest request)
    {
        try
        {
            var user = await GetAuthenticatedUserAsync();
            if (!IsAdminOrModerator(user))
                return StatusCode(403, new { error = "Forbidden" });

            var success = await _adminService.ResetUserAiUsageAsync(userId, request);
            if (!success) return StatusCode(500, new { error = "Failed to reset user AI usage" });
            return Ok(new { message = "User AI usage reset successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AI Controller] Error resetting user AI usage for {UserId}", userId);
            return StatusCode(500, new { error = "Failed to reset user AI usage" });
        }
    }

    // ===== Unlock Requests =====

    [HttpGet("unlock-requests")]
    public async Task<IActionResult> GetUnlockRequests([FromQuery] string? status = null)
    {
        try
        {
            var user = await GetAuthenticatedUserAsync();
            if (!IsAdminOrModerator(user))
                return StatusCode(403, new { error = "Forbidden" });

            var requests = await _adminService.GetUnlockRequestsAsync(status);
            return Ok(requests);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AI Controller] Error getting unlock requests");
            return StatusCode(500, new { error = "Failed to get unlock requests" });
        }
    }

    [HttpPost("unlock-requests")]
    public async Task<IActionResult> CreateUnlockRequest([FromBody] CreateUnlockRequestDto dto)
    {
        try
        {
            var user = await GetAuthenticatedUserAsync();
            if (user == null) return Unauthorized();

            // TODO: create an unlock request in ai_unlock_requests table
            // For now return message to contact admin
            return Ok(new { message = "Vui lòng liên hệ Admin để được hỗ trợ mở khóa AI Chat." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AI Controller] Error creating unlock request");
            return StatusCode(500, new { error = "Failed to create unlock request" });
        }
    }

    [HttpPost("unlock-requests/{requestId}/approve")]
    public async Task<IActionResult> ApproveUnlockRequest(string requestId, [FromBody] string? adminNote = null)
    {
        try
        {
            var user = await GetAuthenticatedUserAsync();
            if (!IsAdminOrModerator(user))
                return StatusCode(403, new { error = "Forbidden" });

            var result = await _adminService.ApproveUnlockRequestAsync(requestId, adminNote);
            if (result == null) return NotFound(new { error = "Unlock request not found" });
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AI Controller] Error approving unlock request {RequestId}", requestId);
            return StatusCode(500, new { error = "Failed to approve unlock request" });
        }
    }

    [HttpPost("unlock-requests/{requestId}/reject")]
    public async Task<IActionResult> RejectUnlockRequest(string requestId, [FromBody] string? adminNote = null)
    {
        try
        {
            var user = await GetAuthenticatedUserAsync();
            if (!IsAdminOrModerator(user))
                return StatusCode(403, new { error = "Forbidden" });

            var result = await _adminService.RejectUnlockRequestAsync(requestId, adminNote);
            if (result == null) return NotFound(new { error = "Unlock request not found" });
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AI Controller] Error rejecting unlock request {RequestId}", requestId);
            return StatusCode(500, new { error = "Failed to reject unlock request" });
        }
    }

    // ===== My AI Status (User) =====

    [HttpGet("my-usage")]
    public async Task<IActionResult> GetMyUsage()
    {
        try
        {
            var user = await GetAuthenticatedUserAsync();
            if (user == null) return Unauthorized();

            var usage = await _adminService.GetUserAiUsageAsync(user.Id);
            var hasDedicatedApi = !string.IsNullOrWhiteSpace(usage?.ApiKey);
            var messageLimit = usage?.MessageLimit ?? 10;
            var messagesUsed = usage?.MessagesUsed ?? 0;
            return Ok(new
            {
                messagesUsed,
                messageLimit,
                remaining = messageLimit - messagesUsed,
                isUnlocked = usage?.IsUnlocked ?? false,
                hasDedicatedApi
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AI Controller] Error getting my usage");
            return StatusCode(500, new { error = "Failed to get usage" });
        }
    }
}
