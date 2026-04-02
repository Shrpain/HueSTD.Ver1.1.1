using System.ComponentModel.DataAnnotations;

namespace HueSTD.Application.DTOs.Chat;

public record ConversationDto(
    Guid Id,
    string Type,
    string? Name,
    string? AvatarUrl,
    Guid CreatedBy,
    DateTime CreatedAt,
    DateTime LastMessageAt,
    int MemberCount,
    MessageDto? LastMessage,
    List<ConversationMemberDto> Members,
    int UnreadCount
);

public record ConversationMemberDto(
    Guid Id,
    Guid UserId,
    string UserName,
    string UserAvatar,
    string Role,
    string? Nickname,
    DateTime JoinedAt,
    DateTime LastReadAt,
    bool IsOnline
);

public record CreateConversationRequest(
    [Required, StringLength(20)]
    string Type,
    [StringLength(200)]
    string? Name,
    List<Guid>? MemberIds
);

public record UpdateConversationRequest(
    [StringLength(200)]
    string? Name,
    [Url]
    string? AvatarUrl,
    bool? IsArchived,
    bool? IsMuted,
    bool? IsPinned
);

public record ConversationListItemDto(
    Guid Id,
    string Type,
    string? Name,
    string? AvatarUrl,
    Guid? OtherUserId,
    string? OtherUserName,
    string? OtherUserAvatar,
    DateTime LastMessageAt,
    string? LastMessageContent,
    int MemberCount,
    int UnreadCount,
    bool IsPinned,
    bool IsMuted
);

/// <summary>Minimal profile row for starting a direct chat (authenticated user search).</summary>
public record ChatUserSearchResultDto(string Id, string? FullName, string? Email, string? AvatarUrl);
