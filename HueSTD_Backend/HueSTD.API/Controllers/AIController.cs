using HueSTD.API.Auth;
using HueSTD.Application.DTOs.AI;
using HueSTD.Application.DTOs.Admin;
using HueSTD.Application.Exceptions;
using HueSTD.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HueSTD.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class AI : ApiControllerBase
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

    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] ChatRequest request)
    {
        _logger.LogInformation("[AI Controller] Chat request received. UserId: {UserId}", CurrentUserIdValue);

        var result = await _aiService.ChatAsync(request, CurrentUserIdValue);
        if (!result.Success)
        {
            _logger.LogError("[AI Controller] Chat failed: {Error}", result.Error);

            if (result.ErrorCode == "limit_exceeded")
            {
                throw new ForbiddenException(result.Error ?? "AI usage limit exceeded.");
            }

            throw new InvalidOperationException(result.Error ?? "AI chat failed.");
        }

        return Ok(new { success = true, content = result.Content });
    }

    [Authorize(Policy = AppPolicies.ModeratorOrAdmin)]
    [HttpGet("settings")]
    public async Task<IActionResult> GetAISettings()
    {
        var apiKeySetting = await _adminService.GetApiSettingAsync("ai_api_key");
        var modelSetting = await _adminService.GetApiSettingAsync("ai_model");

        return Ok(new
        {
            apiKey = apiKeySetting?.KeyValue ?? string.Empty,
            model = modelSetting?.KeyValue ?? "gemini-3-flash"
        });
    }

    [Authorize(Policy = AppPolicies.ModeratorOrAdmin)]
    [HttpPut("settings")]
    public async Task<IActionResult> UpdateAISettings([FromBody] UpdateAISettingsRequest request)
    {
        if (!string.IsNullOrEmpty(request.ApiKey))
        {
            await _adminService.UpdateApiSettingAsync("ai_api_key", new UpdateApiSettingRequest
            {
                KeyValue = request.ApiKey
            });
        }

        if (!string.IsNullOrEmpty(request.Model))
        {
            await _adminService.UpdateApiSettingAsync("ai_model", new UpdateApiSettingRequest
            {
                KeyValue = request.Model
            });
        }

        return Ok(new { message = "AI settings updated successfully" });
    }

    [Authorize(Policy = AppPolicies.ModeratorOrAdmin)]
    [HttpGet("admin/users")]
    public async Task<IActionResult> GetAllUserAiUsages(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null)
    {
        var result = await _adminService.GetUserAiUsagesPaginatedAsync(page, pageSize, search);
        return Ok(result);
    }

    [Authorize(Policy = AppPolicies.ModeratorOrAdmin)]
    [HttpGet("admin/users-with-dedicated-api")]
    public async Task<IActionResult> GetUsersWithDedicatedApi()
    {
        var items = await _adminService.GetUsersWithDedicatedApiAsync();
        return Ok(items);
    }

    [Authorize(Policy = AppPolicies.ModeratorOrAdmin)]
    [HttpGet("admin/users/{userId}")]
    public async Task<IActionResult> GetUserAiUsage(string userId)
    {
        var usage = await _adminService.GetUserAiUsageAsync(userId);
        if (usage == null)
        {
            throw new NotFoundException("User AI usage not found.");
        }

        return Ok(usage);
    }

    [Authorize(Policy = AppPolicies.ModeratorOrAdmin)]
    [HttpPut("admin/users/{userId}")]
    public async Task<IActionResult> UpdateUserAiUsage(string userId, [FromBody] UpdateUserAiUsageRequest request)
    {
        var result = await _adminService.UpdateUserAiUsageAsync(userId, request);
        if (result == null)
        {
            throw new NotFoundException("Failed to update user AI usage.");
        }

        return Ok(result);
    }

    [Authorize(Policy = AppPolicies.ModeratorOrAdmin)]
    [HttpPost("admin/users/{userId}/reset")]
    public async Task<IActionResult> ResetUserAiUsage(string userId, [FromBody] ResetUserAiUsageRequest request)
    {
        var success = await _adminService.ResetUserAiUsageAsync(userId, request);
        if (!success)
        {
            throw new BadRequestException("Failed to reset user AI usage.");
        }

        return Ok(new { message = "User AI usage reset successfully" });
    }

    [Authorize(Policy = AppPolicies.ModeratorOrAdmin)]
    [HttpGet("unlock-requests")]
    public async Task<IActionResult> GetUnlockRequests([FromQuery] string? status = null)
    {
        var requests = await _adminService.GetUnlockRequestsAsync(status);
        return Ok(requests);
    }

    [HttpPost("unlock-requests")]
    public IActionResult CreateUnlockRequest([FromBody] CreateUnlockRequestDto dto)
    {
        return Ok(new { message = "Vui lòng liên hệ Admin để được hỗ trợ mở khóa AI Chat." });
    }

    [Authorize(Policy = AppPolicies.ModeratorOrAdmin)]
    [HttpPost("unlock-requests/{requestId}/approve")]
    public async Task<IActionResult> ApproveUnlockRequest(string requestId, [FromBody] string? adminNote = null)
    {
        var result = await _adminService.ApproveUnlockRequestAsync(requestId, adminNote);
        if (result == null)
        {
            throw new NotFoundException("Unlock request not found.");
        }

        return Ok(result);
    }

    [Authorize(Policy = AppPolicies.ModeratorOrAdmin)]
    [HttpPost("unlock-requests/{requestId}/reject")]
    public async Task<IActionResult> RejectUnlockRequest(string requestId, [FromBody] string? adminNote = null)
    {
        var result = await _adminService.RejectUnlockRequestAsync(requestId, adminNote);
        if (result == null)
        {
            throw new NotFoundException("Unlock request not found.");
        }

        return Ok(result);
    }

    [HttpGet("my-usage")]
    public async Task<IActionResult> GetMyUsage()
    {
        var user = await _authService.GetCurrentUserAsync(CurrentUserIdValue, CurrentUserEmail);
        if (user == null)
        {
            throw new UnauthorizedException("Vui lòng đăng nhập để xem trạng thái AI.");
        }

        var usage = await _adminService.GetUserAiUsageAsync(user.Id!);
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
}
