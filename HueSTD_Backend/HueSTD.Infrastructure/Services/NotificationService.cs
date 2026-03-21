using HueSTD.Application.DTOs.Notification;
using HueSTD.Application.Interfaces;
using HueSTD.Domain.Entities;
using Microsoft.Extensions.Logging;
using Profile = HueSTD.Domain.Entities.Profile;

namespace HueSTD.Infrastructure.Services;

public class NotificationService : INotificationService
{
    private readonly Supabase.Client _supabaseClient;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(Supabase.Client supabaseClient, ILogger<NotificationService> logger)
    {
        _supabaseClient = supabaseClient;
        _logger = logger;
    }

    public async Task<List<NotificationDto>> GetUserNotificationsAsync(string userId, int limit = 10, int offset = 0)
    {
        try
        {
            var userGuid = Guid.Parse(userId);
            var result = await _supabaseClient
                .From<Notification>()
                .Where(n => n.UserId == userGuid)
                .Order("created_at", Supabase.Postgrest.Constants.Ordering.Descending)
                .Range(offset, offset + limit - 1)
                .Get();

            return result.Models.Select(n => new NotificationDto
            {
                Id = n.Id.ToString(),
                Title = n.Title,
                Message = n.Message,
                Type = n.Type,
                ReferenceId = n.ReferenceId?.ToString(),
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt
            }).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[NotificationService] Error getting notifications");
            return new List<NotificationDto>();
        }
    }

    public async Task<List<NotificationDto>> GetUnreadNotificationsAsync(string userId)
    {
        try
        {
            var userGuid = Guid.Parse(userId);
            var result = await _supabaseClient
                .From<Notification>()
                .Where(n => n.UserId == userGuid && n.IsRead == false)
                .Order("created_at", Supabase.Postgrest.Constants.Ordering.Descending)
                .Get();

            return result.Models.Select(n => new NotificationDto
            {
                Id = n.Id.ToString(),
                Title = n.Title,
                Message = n.Message,
                Type = n.Type,
                ReferenceId = n.ReferenceId?.ToString(),
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt
            }).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[NotificationService] Error getting unread notifications");
            return new List<NotificationDto>();
        }
    }

    public async Task<bool> CreateNotificationAsync(CreateNotificationRequest request)
    {
        try
        {
            var notification = new Notification
            {
                UserId = request.UserId,
                Title = request.Title,
                Message = request.Message,
                Type = request.Type,
                ReferenceId = request.ReferenceId,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };

            await _supabaseClient
                .From<Notification>()
                .Insert(notification);

            Console.WriteLine($"[NotificationService] Created notification for user {request.UserId}: {request.Title}");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[NotificationService] Error creating notification");
            return false;
        }
    }

    public async Task<bool> MarkAsReadAsync(string notificationId, string userId)
    {
        try
        {
            var notifGuid = Guid.Parse(notificationId);
            var userGuid = Guid.Parse(userId);

            var result = await _supabaseClient
                .From<Notification>()
                .Where(n => n.Id == notifGuid && n.UserId == userGuid)
                .Get();

            if (result.Models.Count == 0) return false;

            var notification = result.Models[0];
            notification.IsRead = true;

            await _supabaseClient
                .From<Notification>()
                .Upsert(notification);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[NotificationService] Error marking as read");
            return false;
        }
    }

    public async Task<int> MarkAllAsReadAsync(string userId)
    {
        try
        {
            var userGuid = Guid.Parse(userId);

            // Get all unread notifications for the user
            var result = await _supabaseClient
                .From<Notification>()
                .Where(n => n.UserId == userGuid && n.IsRead == false)
                .Get();

            if (result.Models.Count == 0) return 0;

            // Mark all as read
            foreach (var notification in result.Models)
            {
                notification.IsRead = true;
            }

            await _supabaseClient
                .From<Notification>()
                .Upsert(result.Models);

            return result.Models.Count;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[NotificationService] Error marking all as read");
            return 0;
        }
    }

    public async Task<bool> DeleteNotificationAsync(string notificationId, string userId)
    {
        try
        {
            var notifGuid = Guid.Parse(notificationId);
            var userGuid = Guid.Parse(userId);

            await _supabaseClient
                .From<Notification>()
                .Where(n => n.Id == notifGuid && n.UserId == userGuid)
                .Delete();

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[NotificationService] Error deleting notification");
            return false;
        }
    }

    public async Task<int> GetUnreadCountAsync(string userId)
    {
        try
        {
            var userGuid = Guid.Parse(userId);
            var result = await _supabaseClient
                .From<Notification>()
                .Where(n => n.UserId == userGuid && n.IsRead == false)
                .Get();

            return result.Models.Count;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[NotificationService] Error getting unread count");
            return 0;
        }
    }

    public async Task<bool> BroadcastNotificationAsync(string title, string message, string type)
    {
        try
        {
            // Get all user IDs from profiles
            var profilesResult = await _supabaseClient
                .From<Profile>()
                .Select("id")
                .Get();

            if (profilesResult.Models.Count == 0) return true;

            var notifications = profilesResult.Models.Select(profile => new Notification
            {
                UserId = profile.Id,
                Title = title,
                Message = message,
                Type = type,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            }).ToList();

            // Insert all notifications
            await _supabaseClient
                .From<Notification>()
                .Insert(notifications);

            Console.WriteLine($"[NotificationService] Broadcast notification to {notifications.Count} users: {title}");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[NotificationService] Error broadcasting notification");
            return false;
        }
    }

    public async Task<bool> NotifyAdminsAsync(string title, string message, string type, Guid? referenceId = null)
    {
        try
        {
            // Get all admin users
            var profilesResult = await _supabaseClient
                .From<Profile>()
                .Where(p => p.Role == "admin")
                .Get();

            if (profilesResult.Models.Count == 0)
            {
                _logger.LogWarning("[NotificationService] No admin users found for notification");
                return true;
            }

            var notifications = profilesResult.Models.Select(profile => new Notification
            {
                UserId = profile.Id,
                Title = title,
                Message = message,
                Type = type,
                ReferenceId = referenceId,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            }).ToList();

            // Insert all notifications
            await _supabaseClient
                .From<Notification>()
                .Insert(notifications);

            Console.WriteLine($"[NotificationService] Notified {notifications.Count} admins: {title}");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[NotificationService] Error notifying admins");
            return false;
        }
    }

    public async Task<bool> NotifyAdminsGroupedAsync(string title, string message, string type, int count)
    {
        try
        {
            // Get all admin users
            var profilesResult = await _supabaseClient
                .From<Profile>()
                .Where(p => p.Role == "admin")
                .Get();

            if (profilesResult.Models.Count == 0) return true;

            foreach (var profile in profilesResult.Models)
            {
                // Check if an existing unread grouped notification of this type exists for the admin
                var existingResult = await _supabaseClient
                    .From<Notification>()
                    .Where(n => n.UserId == profile.Id && n.Type == type && n.IsRead == false)
                    .Get();

                if (existingResult.Models.Count > 0)
                {
                    // Update existing notification
                    var notification = existingResult.Models[0];
                    notification.Title = title;
                    notification.Message = message;
                    // ReferenceId could be null for grouped
                    notification.CreatedAt = DateTime.UtcNow; // Update timestamp to bring it to top

                    await _supabaseClient
                        .From<Notification>()
                        .Upsert(notification);
                }
                else
                {
                    // Create new notification
                    var notification = new Notification
                    {
                        UserId = profile.Id,
                        Title = title,
                        Message = message,
                        Type = type,
                        IsRead = false,
                        CreatedAt = DateTime.UtcNow
                    };

                    await _supabaseClient
                        .From<Notification>()
                        .Insert(notification);
                }
            }

            Console.WriteLine($"[NotificationService] Notified {profilesResult.Models.Count} admins (Grouped): {title}");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[NotificationService] Error notifying admins grouped");
            return false;
        }
    }

    public async Task<bool> SendToUserAsync(Guid userId, string title, string message, string type, Guid? referenceId = null)
    {
        try
        {
            var notification = new Notification
            {
                UserId = userId,
                Title = title,
                Message = message,
                Type = type,
                ReferenceId = referenceId,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            };

            await _supabaseClient
                .From<Notification>()
                .Insert(notification);

            Console.WriteLine($"[NotificationService] Sent notification to user {userId}: {title}");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[NotificationService] Error sending notification to user {UserId}", userId);
            return false;
        }
    }

    public async Task<bool> SendToMultipleUsersAsync(List<Guid> userIds, string title, string message, string type, Guid? referenceId = null)
    {
        try
        {
            if (userIds == null || userIds.Count == 0)
            {
                return true;
            }

            var notifications = userIds.Select(userId => new Notification
            {
                UserId = userId,
                Title = title,
                Message = message,
                Type = type,
                ReferenceId = referenceId,
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            }).ToList();

            await _supabaseClient
                .From<Notification>()
                .Insert(notifications);

            Console.WriteLine($"[NotificationService] Sent notification to {notifications.Count} users: {title}");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[NotificationService] Error sending notification to multiple users");
            return false;
        }
    }
}
