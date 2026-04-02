using System.ComponentModel.DataAnnotations;

namespace HueSTD.Application.DTOs.Chat;

public record MessageDto(
    Guid Id,
    Guid ConversationId,
    Guid SenderId,
    string SenderName,
    string SenderAvatar,
    string Content,
    string ContentType,
    string? FileUrl,
    string? FileName,
    long? FileSize,
    Guid? ReplyToId,
    string? ReplyToContent,
    string? ReplyToSenderName,
    bool IsEdited,
    bool IsDeleted,
    DateTime CreatedAt,
    List<MessageReactionDto> Reactions
);

public record MessageReactionDto(
    Guid Id,
    string Reaction,
    Guid UserId,
    string UserName,
    int Count,
    List<ReactionUserDto> Users
);

public record ReactionUserDto(
    Guid Id,
    string Name
);

public record SendMessageRequest(
    [Required, StringLength(4000)]
    string Content,
    [StringLength(50)]
    string ContentType = "text",
    [Url]
    string? FileUrl = null,
    [StringLength(255)]
    string? FileName = null,
    long? FileSize = null,
    Guid? ReplyToId = null
);

public record EditMessageRequest([Required, StringLength(4000)] string Content);

public record AddReactionRequest([Required, StringLength(50)] string Reaction);
