using HueSTD.Application.DTOs.Notification;

namespace HueSTD.Application.Interfaces;

public interface INotificationService
{
    Task<List<NotificationDto>> GetUserNotificationsAsync(string userId, int limit = 10, int offset = 0);
    Task<List<NotificationDto>> GetUnreadNotificationsAsync(string userId);
    Task<bool> CreateNotificationAsync(CreateNotificationRequest request);
    Task<bool> MarkAsReadAsync(string notificationId, string userId);
    Task<int> MarkAllAsReadAsync(string userId);
    Task<bool> DeleteNotificationAsync(string notificationId, string userId);
    Task<int> GetUnreadCountAsync(string userId);
    Task<bool> BroadcastNotificationAsync(string title, string message, string type);
    Task<bool> NotifyAdminsAsync(string title, string message, string type, Guid? referenceId = null);
    Task<bool> NotifyAdminsGroupedAsync(string title, string message, string type, int count);
    Task<bool> SendToUserAsync(Guid userId, string title, string message, string type, Guid? referenceId = null);
    Task<bool> SendToMultipleUsersAsync(List<Guid> userIds, string title, string message, string type, Guid? referenceId = null);
}
