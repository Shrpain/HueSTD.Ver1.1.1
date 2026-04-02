using System.ComponentModel.DataAnnotations;
using HueSTD.API.Auth;
using HueSTD.Application.DTOs.Notification;
using HueSTD.Application.Exceptions;
using HueSTD.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HueSTD.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class NotificationController : ApiControllerBase
{
    private readonly INotificationService _notificationService;
    private readonly IAuthService _authService;

    public NotificationController(INotificationService notificationService, IAuthService authService)
    {
        _notificationService = notificationService;
        _authService = authService;
    }

    [HttpGet]
    public async Task<IActionResult> GetNotifications([FromQuery] int limit = 10, [FromQuery] int offset = 0)
    {
        var notifications = await _notificationService.GetUserNotificationsAsync(CurrentUserIdValue, limit, offset);
        return Ok(notifications);
    }

    [HttpGet("unread")]
    public async Task<IActionResult> GetUnreadNotifications()
    {
        var notifications = await _notificationService.GetUnreadNotificationsAsync(CurrentUserIdValue);
        return Ok(notifications);
    }

    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var count = await _notificationService.GetUnreadCountAsync(CurrentUserIdValue);
        return Ok(new { count });
    }

    [HttpPut("{id}/read")]
    public async Task<IActionResult> MarkAsRead(string id)
    {
        var result = await _notificationService.MarkAsReadAsync(id, CurrentUserIdValue);
        if (!result)
        {
            throw new NotFoundException("Notification not found.");
        }

        return Ok(new { message = "Marked as read" });
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var count = await _notificationService.MarkAllAsReadAsync(CurrentUserIdValue);
        return Ok(new { message = $"Marked {count} notifications as read", count });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteNotification(string id)
    {
        var result = await _notificationService.DeleteNotificationAsync(id, CurrentUserIdValue);
        if (!result)
        {
            throw new NotFoundException("Notification not found.");
        }

        return Ok(new { message = "Notification deleted" });
    }

    [Authorize(Policy = AppPolicies.Admin)]
    [HttpPost("broadcast")]
    public async Task<IActionResult> BroadcastNotification([FromBody] BroadcastNotificationRequest request)
    {
        var result = await _notificationService.BroadcastNotificationAsync(request.Title, request.Message, request.Type);
        if (!result)
        {
            throw new BadRequestException("Failed to broadcast notification.");
        }

        return Ok(new { message = "Notification broadcasted successfully" });
    }

    [Authorize(Policy = AppPolicies.Admin)]
    [HttpPost("send-to-user")]
    public async Task<IActionResult> SendToUser([FromBody] SendToUserRequest request)
    {
        var result = await _notificationService.SendToUserAsync(request.UserId, request.Title, request.Message, request.Type, request.ReferenceId);
        if (!result)
        {
            throw new BadRequestException("Failed to send notification.");
        }

        return Ok(new { message = "Notification sent successfully" });
    }

    [Authorize(Policy = AppPolicies.Admin)]
    [HttpPost("send-to-users")]
    public async Task<IActionResult> SendToUsers([FromBody] SendToUsersRequest request)
    {
        var result = await _notificationService.SendToMultipleUsersAsync(request.UserIds, request.Title, request.Message, request.Type, request.ReferenceId);
        if (!result)
        {
            throw new BadRequestException("Failed to send notifications.");
        }

        return Ok(new { message = "Notifications sent successfully" });
    }

    [HttpPost("notify-admins")]
    public async Task<IActionResult> NotifyAdmins([FromBody] NotifyAdminsRequest request)
    {
        var user = await _authService.GetCurrentUserAsync(CurrentUserIdValue, CurrentUserEmail);
        var userName = user?.FullName ?? user?.Email ?? "Người dùng";

        var result = await _notificationService.NotifyAdminsAsync(
            request.Title,
            $"{userName}: {request.Message}",
            request.Type);

        if (!result)
        {
            throw new BadRequestException("Failed to send request to admins.");
        }

        return Ok(new { message = "Request sent to admins successfully" });
    }

    [Authorize(Policy = AppPolicies.Admin)]
    [HttpPost]
    public async Task<IActionResult> CreateNotification([FromBody] CreateNotificationRequest request)
    {
        var result = await _notificationService.SendToUserAsync(
            request.UserId,
            request.Title,
            request.Message,
            request.Type,
            request.ReferenceId);

        if (!result)
        {
            throw new BadRequestException("Failed to create notification.");
        }

        return Ok(new { message = "Notification created successfully" });
    }
}

public class BroadcastNotificationRequest
{
    [Required]
    [StringLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [StringLength(2000)]
    public string Message { get; set; } = string.Empty;

    [Required]
    [StringLength(50)]
    public string Type { get; set; } = "system";
}

public class SendToUserRequest
{
    [Required]
    public Guid UserId { get; set; }

    [Required]
    [StringLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [StringLength(2000)]
    public string Message { get; set; } = string.Empty;

    [Required]
    [StringLength(50)]
    public string Type { get; set; } = "system";

    public Guid? ReferenceId { get; set; }
}

public class SendToUsersRequest
{
    [Required]
    [MinLength(1)]
    public List<Guid> UserIds { get; set; } = new();

    [Required]
    [StringLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [StringLength(2000)]
    public string Message { get; set; } = string.Empty;

    [Required]
    [StringLength(50)]
    public string Type { get; set; } = "system";

    public Guid? ReferenceId { get; set; }
}

public class NotifyAdminsRequest
{
    [Required]
    [StringLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [StringLength(2000)]
    public string Message { get; set; } = string.Empty;

    [Required]
    [StringLength(50)]
    public string Type { get; set; } = "support";
}
