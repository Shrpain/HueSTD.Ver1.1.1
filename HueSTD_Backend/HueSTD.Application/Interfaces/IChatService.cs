using HueSTD.Application.DTOs.Chat;

namespace HueSTD.Application.Interfaces;

public interface IChatService
{
    Task<List<ConversationListItemDto>> GetUserConversationsAsync(Guid userId);
    Task<ConversationDto?> GetConversationAsync(Guid conversationId, Guid userId);
    Task<ConversationDto> CreateDirectConversationAsync(Guid userId, Guid otherUserId);
    Task<ConversationDto> CreateGroupConversationAsync(Guid userId, CreateConversationRequest request);
    Task<ConversationDto?> UpdateConversationAsync(Guid conversationId, Guid userId, UpdateConversationRequest request);
    Task<bool> DeleteConversationAsync(Guid conversationId, Guid userId);
    Task<bool> AddMemberAsync(Guid conversationId, Guid userId, Guid memberId);
    Task<bool> RemoveMemberAsync(Guid conversationId, Guid userId, Guid memberId);
    Task<bool> LeaveConversationAsync(Guid conversationId, Guid userId);
    
    Task<List<MessageDto>> GetMessagesAsync(Guid conversationId, Guid userId, int page = 1, int pageSize = 50);
    Task<MessageDto> SendMessageAsync(Guid conversationId, Guid senderId, SendMessageRequest request);
    Task<MessageDto?> EditMessageAsync(Guid messageId, Guid userId, EditMessageRequest request);
    Task<bool> DeleteMessageAsync(Guid messageId, Guid userId);
    Task<bool> DeleteMessageAsAdminAsync(Guid messageId);
    Task<bool> ReportMessageAsync(Guid messageId, Guid reportedByUserId, string? reason = null);
    Task MarkAsReadAsync(Guid conversationId, Guid userId);
    
    Task<bool> AddReactionAsync(Guid messageId, Guid userId, AddReactionRequest request);
    Task<bool> RemoveReactionAsync(Guid messageId, Guid userId);

    /// <summary>Search profiles by email or display name (case-insensitive). Excludes current user.</summary>
    Task<List<ChatUserSearchResultDto>> SearchUsersForChatAsync(Guid currentUserId, string search, int limit = 20);
}
