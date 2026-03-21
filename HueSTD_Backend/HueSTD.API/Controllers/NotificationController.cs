using HueSTD.Application.DTOs.Notification;
using HueSTD.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HueSTD.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NotificationController : ControllerBase
{
    private readonly INotificationService _notificationService;
    private readonly IAuthService _authService;

    public NotificationController(INotificationService notificationService, IAuthService authService)
    {
        _notificationService = notificationService;
        _authService = authService;
    }

    private async Task<string?> GetUserIdFromToken()
    {
        var authHeader = Request.Headers["Authorization"].ToString();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        {
            return null;
        }

        var token = authHeader.Substring("Bearer ".Length).Trim();
        var user = await _authService.GetCurrentUserAsync(token);
        return user?.Id;
    }

    private async Task<bool> IsAdmin()
    {
        var authHeader = Request.Headers["Authorization"].ToString();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        {
            return false;
        }

        var token = authHeader.Substring("Bearer ".Length).Trim();
        var user = await _authService.GetCurrentUserAsync(token);
        return user?.Role == "admin";
    }

    [HttpGet]
    public async Task<IActionResult> GetNotifications([FromQuery] int limit = 10, [FromQuery] int offset = 0)
    {
        var userId = await GetUserIdFromToken();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var notifications = await _notificationService.GetUserNotificationsAsync(userId, limit, offset);
        return Ok(notifications);
    }

    [HttpGet("unread")]
    public async Task<IActionResult> GetUnreadNotifications()
    {
        var userId = await GetUserIdFromToken();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var notifications = await _notificationService.GetUnreadNotificationsAsync(userId);
        return Ok(notifications);
    }

    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var userId = await GetUserIdFromToken();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var count = await _notificationService.GetUnreadCountAsync(userId);
        return Ok(new { count });
    }

    [HttpPut("{id}/read")]
    public async Task<IActionResult> MarkAsRead(string id)
    {
        var userId = await GetUserIdFromToken();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var result = await _notificationService.MarkAsReadAsync(id, userId);
        if (!result) return NotFound(new { error = "Notification not found" });

        return Ok(new { message = "Marked as read" });
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userId = await GetUserIdFromToken();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var count = await _notificationService.MarkAllAsReadAsync(userId);
        return Ok(new { message = $"Marked {count} notifications as read", count });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteNotification(string id)
    {
        var userId = await GetUserIdFromToken();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var result = await _notificationService.DeleteNotificationAsync(id, userId);
        if (!result) return NotFound(new { error = "Notification not found" });

        return Ok(new { message = "Notification deleted" });
    }

    [HttpPost("broadcast")]
    public async Task<IActionResult> BroadcastNotification([FromBody] BroadcastNotificationRequest request)
    {
        if (!await IsAdmin())
            return Forbid();

        var result = await _notificationService.BroadcastNotificationAsync(request.Title, request.Message, request.Type);
        if (!result) return BadRequest(new { error = "Failed to broadcast notification" });

        return Ok(new { message = "Notification broadcasted successfully" });
    }

    /// <summary>
    /// Send notification to a specific user
    /// </summary>
    [HttpPost("send-to-user")]
    public async Task<IActionResult> SendToUser([FromBody] SendToUserRequest request)
    {
        if (!await IsAdmin())
            return Forbid();

        var result = await _notificationService.SendToUserAsync(request.UserId, request.Title, request.Message, request.Type, request.ReferenceId);
        if (!result) return BadRequest(new { error = "Failed to send notification" });

        return Ok(new { message = "Notification sent successfully" });
    }

    /// <summary>
    /// Send notification to multiple users
    /// </summary>
    [HttpPost("send-to-users")]
    public async Task<IActionResult> SendToUsers([FromBody] SendToUsersRequest request)
    {
        if (!await IsAdmin())
            return Forbid();

        var result = await _notificationService.SendToMultipleUsersAsync(request.UserIds, request.Title, request.Message, request.Type, request.ReferenceId);
        if (!result) return BadRequest(new { error = "Failed to send notifications" });

        return Ok(new { message = "Notifications sent successfully" });
    }

    /// <summary>
    /// User sends support request to admins
    /// </summary>
    [HttpPost("notify-admins")]
    public async Task<IActionResult> NotifyAdmins([FromBody] NotifyAdminsRequest request)
    {
        var userId = await GetUserIdFromToken();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        // Get user info
        var user = await _authService.GetCurrentUserAsync(Request.Headers["Authorization"].ToString().Substring("Bearer ".Length).Trim());
        var userName = user?.FullName ?? user?.Email ?? "Người dùng";

        var result = await _notificationService.NotifyAdminsAsync(
            request.Title,
            $"{userName}: {request.Message}",
            request.Type
        );

        if (!result) return BadRequest(new { error = "Failed to send request to admins" });

        return Ok(new { message = "Request sent to admins successfully" });
    }

    /// <summary>
    /// Create a notification for a user (admin or system use)
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateNotification([FromBody] CreateNotificationRequest request)
    {
        var userId = await GetUserIdFromToken();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        // Only admin can create notifications for other users
        if (!await IsAdmin())
            return Forbid();

        var result = await _notificationService.SendToUserAsync(
            request.UserId,
            request.Title,
            request.Message,
            request.Type,
            request.ReferenceId
        );

        if (!result) return BadRequest(new { error = "Failed to create notification" });

        return Ok(new { message = "Notification created successfully" });
    }
}

public class BroadcastNotificationRequest
{
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Type { get; set; } = "system";
}

public class SendToUserRequest
{
    public Guid UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Type { get; set; } = "system";
    public Guid? ReferenceId { get; set; }
}

public class SendToUsersRequest
{
    public List<Guid> UserIds { get; set; } = new();
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Type { get; set; } = "system";
    public Guid? ReferenceId { get; set; }
}

public class NotifyAdminsRequest
{
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Type { get; set; } = "support";
}
