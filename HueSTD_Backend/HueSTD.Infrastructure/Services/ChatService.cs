using HueSTD.Application.DTOs.Chat;
using HueSTD.Application.Interfaces;
using HueSTD.Domain.Entities;
using Supabase;
using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace HueSTD.Infrastructure.Services;

public class ChatService : IChatService
{
    private readonly Client _supabase;
    private readonly IAuthService _authService;
    private readonly INotificationService _notificationService;

    public ChatService(Client supabase, IAuthService authService, INotificationService notificationService)
    {
        _supabase = supabase;
        _authService = authService;
        _notificationService = notificationService;
    }

    public async Task<List<ConversationListItemDto>> GetUserConversationsAsync(Guid userId)
    {
        var participantConvs = await _supabase
            .From<ConvParticipant>()
            .Where(p => p.UserId == userId)
            .Get();

        var result = new List<ConversationListItemDto>();

        foreach (var participant in participantConvs.Models)
        {
            var convResult = await _supabase
                .From<Conv>()
                .Where(c => c.Id == participant.ConversationId)
                .Get();

            var conv = convResult.Models.FirstOrDefault();
            if (conv == null || conv.IsArchived) continue;

            var allParticipants = await _supabase
                .From<ConvParticipant>()
                .Where(p => p.ConversationId == conv.Id)
                .Get();

            var memberCount = allParticipants.Models.Count;
            
            var lastMsg = await _supabase
                .From<ChatMessage>()
                .Where(m => m.ConversationId == conv.Id)
                .Order("created_at", Supabase.Postgrest.Constants.Ordering.Descending)
                .Limit(1)
                .Get();

            string? lastMsgContent = null;
            if (lastMsg.Models.Any())
            {
                var msg = lastMsg.Models.First();
                var sender = await GetProfileAsync(msg.SenderId);
                lastMsgContent = $"{sender?.FullName ?? "Unknown"}: {(msg.IsDeleted ? "Tin nhắn đã xóa" : msg.Content)}";
            }

            Guid? otherUserId = null;
            string? otherUserName = null;
            string? otherUserAvatar = null;

            if (conv.Type == "direct")
            {
                var other = allParticipants.Models.FirstOrDefault(p => p.UserId != userId);
                if (other != null)
                {
                    otherUserId = other.UserId;
                    var profile = await GetProfileAsync(other.UserId);
                    otherUserName = profile?.FullName;
                    otherUserAvatar = profile?.AvatarUrl;
                }
            }

            var unreadCount = allParticipants.Models
                .Count(p => p.UserId == userId && p.LastReadAt < conv.LastMessageAt);

            result.Add(new ConversationListItemDto(
                conv.Id,
                conv.Type ?? "direct",
                conv.Name,
                conv.AvatarUrl,
                otherUserId,
                otherUserName,
                otherUserAvatar,
                conv.LastMessageAt,
                lastMsgContent,
                memberCount,
                unreadCount,
                participant.IsPinned,
                participant.IsMuted
            ));
        }

        return result.OrderByDescending(c => c.IsPinned)
                    .ThenByDescending(c => c.LastMessageAt)
                    .ToList();
    }

    public async Task<ConversationDto?> GetConversationAsync(Guid conversationId, Guid userId)
    {
        var convResult = await _supabase
            .From<Conv>()
            .Where(c => c.Id == conversationId)
            .Get();

        var conv = convResult.Models.FirstOrDefault();
        if (conv == null) return null;

        var participants = await _supabase
            .From<ConvParticipant>()
            .Where(p => p.ConversationId == conversationId)
            .Get();

        var members = new List<ConversationMemberDto>();
        foreach (var p in participants.Models)
        {
            var profile = await GetProfileAsync(p.UserId);
            members.Add(new ConversationMemberDto(
                p.UserId,
                p.UserId,
                profile?.FullName ?? "Unknown",
                profile?.AvatarUrl ?? "",
                p.Role ?? "member",
                p.Nickname,
                p.CreatedAt,
                p.LastReadAt,
                false
            ));
        }

        var lastMessage = await GetLastMessageAsync(conversationId);
        var unreadCount = participants.Models
            .Count(p => p.UserId == userId && p.LastReadAt < conv.LastMessageAt);

        return new ConversationDto(
            conv.Id,
            conv.Type ?? "direct",
            conv.Name,
            conv.AvatarUrl,
            conv.CreatedBy ?? Guid.Empty,
            conv.CreatedAt,
            conv.LastMessageAt,
            members.Count,
            lastMessage,
            members,
            unreadCount
        );
    }

    public async Task<ConversationDto> CreateDirectConversationAsync(Guid userId, Guid otherUserId)
    {
        var existing = await _supabase
            .From<Conv>()
            .Where(c => c.Type == "direct")
            .Get();

        foreach (var conv in existing.Models)
        {
            var participants = await _supabase
                .From<ConvParticipant>()
                .Where(p => p.ConversationId == conv.Id)
                .Get();

            if (participants.Models.Count == 2 &&
                participants.Models.Any(p => p.UserId == userId) &&
                participants.Models.Any(p => p.UserId == otherUserId))
            {
                var dto = await GetConversationAsync(conv.Id, userId);
                return dto!;
            }
        }

        var now = DateTime.UtcNow;
        var newConv = new Conv
        {
            Id = Guid.NewGuid(),
            Type = "direct",
            CreatedBy = userId,
            CreatedAt = now,
            UpdatedAt = now,
            LastMessageAt = now,
            IsArchived = false
        };

        await _supabase.From<Conv>().Insert(newConv);

        await _supabase.From<ConvParticipant>().Insert(new[]
        {
            new ConvParticipant
            {
                ConversationId = newConv.Id,
                UserId = userId,
                CreatedAt = now,
                LastReadAt = now,
                Role = "member",
                IsMuted = false,
                IsPinned = false
            },
            new ConvParticipant
            {
                ConversationId = newConv.Id,
                UserId = otherUserId,
                CreatedAt = now,
                LastReadAt = now,
                Role = "member",
                IsMuted = false,
                IsPinned = false
            }
        });

        var created = await GetConversationAsync(newConv.Id, userId);
        if (created == null)
            throw new InvalidOperationException("Conversation was created but could not be loaded.");

        return created;
    }

    public async Task<ConversationDto> CreateGroupConversationAsync(Guid userId, CreateConversationRequest request)
    {
        var now = DateTime.UtcNow;
        var newConv = new Conv
        {
            Id = Guid.NewGuid(),
            Type = "group",
            Name = request.Name,
            CreatedBy = userId,
            CreatedAt = now,
            UpdatedAt = now,
            LastMessageAt = now,
            IsArchived = false
        };

        await _supabase.From<Conv>().Insert(newConv);

        var participants = new List<ConvParticipant>
        {
            new()
            {
                ConversationId = newConv.Id,
                UserId = userId,
                CreatedAt = now,
                LastReadAt = now,
                Role = "owner",
                IsMuted = false,
                IsPinned = false
            }
        };

        if (request.MemberIds != null)
        {
            foreach (var memberId in request.MemberIds)
            {
                participants.Add(new ConvParticipant
                {
                    ConversationId = newConv.Id,
                    UserId = memberId,
                    CreatedAt = now,
                    LastReadAt = now,
                    Role = "member",
                    IsMuted = false,
                    IsPinned = false
                });
            }
        }

        await _supabase.From<ConvParticipant>().Insert(participants);

        var created = await GetConversationAsync(newConv.Id, userId);
        if (created == null)
            throw new InvalidOperationException("Conversation was created but could not be loaded.");

        return created;
    }

    public async Task<ConversationDto?> UpdateConversationAsync(Guid conversationId, Guid userId, UpdateConversationRequest request)
    {
        var convResult = await _supabase
            .From<Conv>()
            .Where(c => c.Id == conversationId)
            .Get();

        var conv = convResult.Models.FirstOrDefault();
        if (conv == null) return null;

        if (request.Name != null) conv.Name = request.Name;
        if (request.AvatarUrl != null) conv.AvatarUrl = request.AvatarUrl;
        if (request.IsArchived.HasValue) conv.IsArchived = request.IsArchived.Value;

        await _supabase.From<Conv>().Update(conv);

        if (request.IsPinned.HasValue || request.IsMuted.HasValue)
        {
            var partResult = await _supabase
                .From<ConvParticipant>()
                .Where(p => p.ConversationId == conversationId && p.UserId == userId)
                .Get();

            var participant = partResult.Models.FirstOrDefault();

            if (participant != null)
            {
                if (request.IsPinned.HasValue) participant.IsPinned = request.IsPinned.Value;
                if (request.IsMuted.HasValue) participant.IsMuted = request.IsMuted.Value;
                await _supabase.From<ConvParticipant>().Update(participant);
            }
        }

        return await GetConversationAsync(conversationId, userId);
    }

    public async Task<bool> DeleteConversationAsync(Guid conversationId, Guid userId)
    {
        var convResult = await _supabase
            .From<Conv>()
            .Where(c => c.Id == conversationId && c.CreatedBy == userId)
            .Get();

        var conv = convResult.Models.FirstOrDefault();
        if (conv == null) return false;

        await _supabase.From<Conv>().Delete(conv);
        return true;
    }

    public async Task<bool> AddMemberAsync(Guid conversationId, Guid userId, Guid memberId)
    {
        var existingResult = await _supabase
            .From<ConvParticipant>()
            .Where(p => p.ConversationId == conversationId && p.UserId == memberId)
            .Get();

        if (existingResult.Models.Any()) return true;

        var now = DateTime.UtcNow;
        await _supabase.From<ConvParticipant>().Insert(new ConvParticipant
        {
            ConversationId = conversationId,
            UserId = memberId,
            CreatedAt = now,
            LastReadAt = now,
            Role = "member",
            IsMuted = false,
            IsPinned = false
        });

        return true;
    }

    public async Task<bool> RemoveMemberAsync(Guid conversationId, Guid userId, Guid memberId)
    {
        var partResult = await _supabase
            .From<ConvParticipant>()
            .Where(p => p.ConversationId == conversationId && p.UserId == memberId)
            .Get();

        var participant = partResult.Models.FirstOrDefault();
        if (participant == null) return false;

        await _supabase.From<ConvParticipant>().Delete(participant);
        return true;
    }

    public async Task<bool> LeaveConversationAsync(Guid conversationId, Guid userId)
    {
        return await RemoveMemberAsync(conversationId, userId, userId);
    }

    public async Task<List<MessageDto>> GetMessagesAsync(Guid conversationId, Guid userId, int page = 1, int pageSize = 50)
    {
        var offset = (page - 1) * pageSize;

        var messages = await _supabase
            .From<ChatMessage>()
            .Where(m => m.ConversationId == conversationId)
            .Order("created_at", Supabase.Postgrest.Constants.Ordering.Descending)
            .Range(offset, offset + pageSize - 1)
            .Get();

        var result = new List<MessageDto>();
        foreach (var msg in messages.Models)
        {
            var profile = await GetProfileAsync(msg.SenderId);
            var reactions = await GetMessageReactionsAsync(msg.Id);

            string? replyToContent = null;
            string? replyToSenderName = null;
            if (msg.ReplyToId.HasValue)
            {
                var replyResult = await _supabase
                    .From<ChatMessage>()
                    .Where(m => m.Id == msg.ReplyToId.Value)
                    .Get();
                var replyTo = replyResult.Models.FirstOrDefault();
                if (replyTo != null)
                {
                    replyToContent = replyTo.Content;
                    var replyProfile = await GetProfileAsync(replyTo.SenderId);
                    replyToSenderName = replyProfile?.FullName;
                }
            }

            result.Add(new MessageDto(
                msg.Id,
                msg.ConversationId,
                msg.SenderId,
                profile?.FullName ?? "Unknown",
                profile?.AvatarUrl ?? "",
                msg.IsDeleted ? "Tin nhắn đã được xóa" : msg.Content,
                msg.ContentType ?? "text",
                msg.FileUrl,
                msg.FileName,
                msg.FileSize,
                msg.ReplyToId,
                replyToContent,
                replyToSenderName,
                msg.IsEdited,
                msg.IsDeleted,
                msg.CreatedAt,
                reactions
            ));
        }

        result.Reverse();
        return result;
    }

    public async Task<MessageDto> SendMessageAsync(Guid conversationId, Guid senderId, SendMessageRequest request)
    {
        var message = new ChatMessage
        {
            Id = Guid.NewGuid(),
            ConversationId = conversationId,
            SenderId = senderId,
            Content = request.Content,
            ContentType = request.ContentType,
            FileUrl = request.FileUrl,
            FileName = request.FileName,
            FileSize = request.FileSize,
            ReplyToId = request.ReplyToId,
            IsRead = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _supabase.From<ChatMessage>().Insert(message);

        await _supabase.From<Conv>()
            .Filter("id", Supabase.Postgrest.Constants.Operator.Equals, conversationId.ToString())
            .Set(x => x.LastMessageAt, DateTime.UtcNow)
            .Update();

        var profile = await GetProfileAsync(senderId);
        var reactions = await GetMessageReactionsAsync(message.Id);

        string? replyToContent = null;
        string? replyToSenderName = null;
        if (request.ReplyToId.HasValue)
        {
            var replyResult = await _supabase
                .From<ChatMessage>()
                .Where(m => m.Id == request.ReplyToId.Value)
                .Get();
            var replyTo = replyResult.Models.FirstOrDefault();
            if (replyTo != null)
            {
                replyToContent = replyTo.Content;
                var replyProfile = await GetProfileAsync(replyTo.SenderId);
                replyToSenderName = replyProfile?.FullName;
            }
        }

        return new MessageDto(
            message.Id,
            message.ConversationId,
            message.SenderId,
            profile?.FullName ?? "Unknown",
            profile?.AvatarUrl ?? "",
            message.Content,
            message.ContentType ?? "text",
            message.FileUrl,
            message.FileName,
            message.FileSize,
            message.ReplyToId,
            replyToContent,
            replyToSenderName,
            false,
            false,
            message.CreatedAt,
            reactions
        );
    }

    public async Task<MessageDto?> EditMessageAsync(Guid messageId, Guid userId, EditMessageRequest request)
    {
        var msgResult = await _supabase
            .From<ChatMessage>()
            .Where(m => m.Id == messageId && m.SenderId == userId)
            .Get();

        var message = msgResult.Models.FirstOrDefault();
        if (message == null || message.IsDeleted) return null;

        message.Content = request.Content;
        message.IsEdited = true;
        message.UpdatedAt = DateTime.UtcNow;

        await _supabase.From<ChatMessage>().Update(message);

        var profile = await GetProfileAsync(message.SenderId);
        var reactions = await GetMessageReactionsAsync(message.Id);

        return new MessageDto(
            message.Id,
            message.ConversationId,
            message.SenderId,
            profile?.FullName ?? "Unknown",
            profile?.AvatarUrl ?? "",
            message.Content,
            message.ContentType ?? "text",
            message.FileUrl,
            message.FileName,
            message.FileSize,
            message.ReplyToId,
            null,
            null,
            true,
            false,
            message.CreatedAt,
            reactions
        );
    }

    public async Task<bool> DeleteMessageAsync(Guid messageId, Guid userId)
    {
        var msgResult = await _supabase
            .From<ChatMessage>()
            .Where(m => m.Id == messageId && m.SenderId == userId)
            .Get();

        var message = msgResult.Models.FirstOrDefault();
        if (message == null) return false;

        message.IsDeleted = true;
        message.Content = "";
        message.UpdatedAt = DateTime.UtcNow;

        await _supabase.From<ChatMessage>().Update(message);
        return true;
    }

    public async Task<bool> DeleteMessageAsAdminAsync(Guid messageId)
    {
        var msgResult = await _supabase
            .From<ChatMessage>()
            .Where(m => m.Id == messageId)
            .Get();

        var message = msgResult.Models.FirstOrDefault();
        if (message == null) return false;

        if (message.IsDeleted) return true;

        message.IsDeleted = true;
        message.Content = "";
        message.UpdatedAt = DateTime.UtcNow;

        await _supabase.From<ChatMessage>().Update(message);
        return true;
    }

    public async Task<bool> ReportMessageAsync(Guid messageId, Guid reportedByUserId, string? reason = null)
    {
        var msgResult = await _supabase
            .From<ChatMessage>()
            .Where(m => m.Id == messageId)
            .Get();

        var message = msgResult.Models.FirstOrDefault();
        if (message == null) return false;

        var reporterProfile = await GetProfileAsync(reportedByUserId);
        var senderProfile = await GetProfileAsync(message.SenderId);

        var rawContent = message.IsDeleted ? "[Tin nhan da bi xoa]" : message.Content;
        var reporterName = reporterProfile?.FullName ?? reporterProfile?.Email ?? reportedByUserId.ToString();
        var senderName = senderProfile?.FullName ?? senderProfile?.Email ?? message.SenderId.ToString();
        var reasonLine = string.IsNullOrWhiteSpace(reason) ? "" : $"\nLy do: {reason.Trim()}";

        var notifyOk = await _notificationService.NotifyAdminsAsync(
            "Bao cao tin nhan chat",
            $"Nguoi bao cao: {reporterName}\nNguoi gui tin nhan: {senderName}\nConversation: {message.ConversationId}\nMessageId: {message.Id}\nNoi dung nguyen van:\n{rawContent}{reasonLine}",
            "chat_report",
            message.Id
        );

        return notifyOk;
    }

    public async Task MarkAsReadAsync(Guid conversationId, Guid userId)
    {
        var partResult = await _supabase
            .From<ConvParticipant>()
            .Where(p => p.ConversationId == conversationId && p.UserId == userId)
            .Get();

        var participant = partResult.Models.FirstOrDefault();
        if (participant != null)
        {
            participant.LastReadAt = DateTime.UtcNow;
            await _supabase.From<ConvParticipant>().Update(participant);
        }
    }

    public async Task<bool> AddReactionAsync(Guid messageId, Guid userId, AddReactionRequest request)
    {
        var existingResult = await _supabase
            .From<MsgReaction>()
            .Where(r => r.MessageId == messageId && r.UserId == userId)
            .Get();

        var existing = existingResult.Models.FirstOrDefault();
        if (existing != null)
        {
            existing.Reaction = request.Reaction;
            await _supabase.From<MsgReaction>().Update(existing);
            return true;
        }

        await _supabase.From<MsgReaction>().Insert(new MsgReaction
        {
            Id = Guid.NewGuid(),
            MessageId = messageId,
            UserId = userId,
            Reaction = request.Reaction,
            CreatedAt = DateTime.UtcNow
        });

        return true;
    }

    public async Task<bool> RemoveReactionAsync(Guid messageId, Guid userId)
    {
        var reactResult = await _supabase
            .From<MsgReaction>()
            .Where(r => r.MessageId == messageId && r.UserId == userId)
            .Get();

        var reaction = reactResult.Models.FirstOrDefault();
        if (reaction == null) return false;

        await _supabase.From<MsgReaction>().Delete(reaction);
        return true;
    }

    public async Task<List<ChatUserSearchResultDto>> SearchUsersForChatAsync(Guid currentUserId, string search, int limit = 20)
    {
        var term = (search ?? "").Trim();
        if (string.IsNullOrEmpty(term) || term.Length > 200)
            return new List<ChatUserSearchResultDto>();

        var safe = term.Replace("%", string.Empty).Replace("_", string.Empty);
        if (string.IsNullOrEmpty(safe))
            return new List<ChatUserSearchResultDto>();

        var pattern = $"%{safe}%";

        var byEmail = await _supabase
            .From<Profile>()
            .Filter("email", Supabase.Postgrest.Constants.Operator.ILike, pattern)
            .Limit(limit + 10)
            .Get();

        var byName = await _supabase
            .From<Profile>()
            .Filter("full_name", Supabase.Postgrest.Constants.Operator.ILike, pattern)
            .Limit(limit + 10)
            .Get();

        var seen = new HashSet<Guid>();
        var merged = new List<ChatUserSearchResultDto>();

        foreach (var p in byEmail.Models.Concat(byName.Models))
        {
            if (p.Id == currentUserId) continue;
            if (!seen.Add(p.Id)) continue;

            merged.Add(new ChatUserSearchResultDto(
                p.Id.ToString(),
                p.FullName,
                p.Email,
                p.AvatarUrl));

            if (merged.Count >= limit)
                break;
        }

        return merged;
    }

    private async Task<Profile?> GetProfileAsync(Guid userId)
    {
        var result = await _supabase
            .From<Profile>()
            .Where(p => p.Id == userId)
            .Get();

        return result.Models.FirstOrDefault();
    }

    private async Task<MessageDto?> GetLastMessageAsync(Guid conversationId)
    {
        var msgResult = await _supabase
            .From<ChatMessage>()
            .Where(m => m.ConversationId == conversationId)
            .Order("created_at", Supabase.Postgrest.Constants.Ordering.Descending)
            .Limit(1)
            .Get();

        var message = msgResult.Models.FirstOrDefault();
        if (message == null) return null;

        var profile = await GetProfileAsync(message.SenderId);
        var reactions = await GetMessageReactionsAsync(message.Id);

        return new MessageDto(
            message.Id,
            message.ConversationId,
            message.SenderId,
            profile?.FullName ?? "Unknown",
            profile?.AvatarUrl ?? "",
            message.IsDeleted ? "Tin nhắn đã được xóa" : message.Content,
            message.ContentType ?? "text",
            message.FileUrl,
            message.FileName,
            message.FileSize,
            message.ReplyToId,
            null,
            null,
            message.IsEdited,
            message.IsDeleted,
            message.CreatedAt,
            reactions
        );
    }

    private async Task<List<MessageReactionDto>> GetMessageReactionsAsync(Guid messageId)
    {
        var reactions = await _supabase
            .From<MsgReaction>()
            .Where(r => r.MessageId == messageId)
            .Get();

        return reactions.Models
            .GroupBy(r => r.Reaction)
            .Select(g => new MessageReactionDto(
                g.First().Id,
                g.Key,
                g.First().UserId,
                null!,
                g.Count(),
                g.Select(r => new ReactionUserDto(r.UserId, null!)).ToList()
            ))
            .ToList();
    }
}

// Chat-specific models for Supabase
[Table("conversations")]
public class Conv : BaseModel
{
    /// <summary>shouldInsert:true — mặc định Postgrest bỏ PK khi insert, DB sinh id khác Guid client → lỗi FK participants.</summary>
    [PrimaryKey("id", true)]
    public Guid Id { get; set; }

    [Column("type")]
    public string? Type { get; set; }

    [Column("name")]
    public string? Name { get; set; }

    [Column("avatar_url")]
    public string? AvatarUrl { get; set; }

    [Column("created_by")]
    public Guid? CreatedBy { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }

    [Column("last_message_at")]
    public DateTime LastMessageAt { get; set; }

    [Column("is_archived")]
    public bool IsArchived { get; set; }
}

[Table("conversation_participants")]
public class ConvParticipant : BaseModel
{
    /// <summary>Composite PK in DB: (conversation_id, user_id). Không có cột id riêng.</summary>
    [PrimaryKey("conversation_id", true)]
    [Column("conversation_id")]
    public Guid ConversationId { get; set; }

    [PrimaryKey("user_id", true)]
    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("role")]
    public string? Role { get; set; }

    [Column("nickname")]
    public string? Nickname { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("last_read_at")]
    public DateTime LastReadAt { get; set; }

    [Column("is_muted")]
    public bool IsMuted { get; set; }

    [Column("is_pinned")]
    public bool IsPinned { get; set; }
}

[Table("messages")]
public class ChatMessage : BaseModel
{
    [PrimaryKey("id", true)]
    public Guid Id { get; set; }

    [Column("conversation_id")]
    public Guid ConversationId { get; set; }

    [Column("sender_id")]
    public Guid SenderId { get; set; }

    [Column("content")]
    public string Content { get; set; } = "";

    [Column("content_type")]
    public string? ContentType { get; set; }

    [Column("file_url")]
    public string? FileUrl { get; set; }

    [Column("file_name")]
    public string? FileName { get; set; }

    [Column("file_size")]
    public long? FileSize { get; set; }

    [Column("reply_to_id")]
    public Guid? ReplyToId { get; set; }

    [Column("is_read")]
    public bool IsRead { get; set; }

    [Column("is_edited")]
    public bool IsEdited { get; set; }

    [Column("is_deleted")]
    public bool IsDeleted { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}

[Table("message_reactions")]
public class MsgReaction : BaseModel
{
    [PrimaryKey("id", true)]
    public Guid Id { get; set; }

    [Column("message_id")]
    public Guid MessageId { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("reaction")]
    public string Reaction { get; set; } = "";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
