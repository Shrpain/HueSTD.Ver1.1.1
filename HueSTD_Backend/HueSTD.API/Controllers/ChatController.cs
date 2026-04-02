using System.ComponentModel.DataAnnotations;
using HueSTD.API.Auth;
using HueSTD.Application.DTOs.Chat;
using HueSTD.Application.Exceptions;
using HueSTD.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HueSTD.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ChatController : ApiControllerBase
{
    private readonly IChatService _chatService;

    public ChatController(IChatService chatService)
    {
        _chatService = chatService;
    }

    /// <summary>Search users to start a conversation (any authenticated member; not admin-only).</summary>
    [HttpGet("users/search")]
    public async Task<IActionResult> SearchUsers([FromQuery] string search, [FromQuery] int limit = 20)
    {
        limit = Math.Clamp(limit, 1, 50);
        var results = await _chatService.SearchUsersForChatAsync(CurrentUserId, search ?? string.Empty, limit);
        return Ok(results);
    }

    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations()
    {
        var conversations = await _chatService.GetUserConversationsAsync(CurrentUserId);
        return Ok(conversations);
    }

    [HttpGet("conversations/{id:guid}")]
    public async Task<IActionResult> GetConversation(Guid id)
    {
        var conversation = await _chatService.GetConversationAsync(id, CurrentUserId);
        if (conversation == null)
        {
            throw new NotFoundException("Conversation not found.");
        }

        return Ok(conversation);
    }

    [HttpPost("conversations/direct")]
    public async Task<IActionResult> CreateDirectConversation([FromBody] CreateDirectRequest request)
    {
        if (!Guid.TryParse(request.UserId, out var otherUserId))
        {
            throw new BadRequestException("Invalid user ID format.");
        }

        if (otherUserId == CurrentUserId)
        {
            throw new BadRequestException("Không thể tạo cuộc trò chuyện với chính bạn.");
        }

        var conversation = await _chatService.CreateDirectConversationAsync(CurrentUserId, otherUserId);
        return Created($"/api/chat/conversations/{conversation.Id}", conversation);
    }

    [HttpPost("conversations/group")]
    public async Task<IActionResult> CreateGroupConversation([FromBody] CreateConversationRequest request)
    {
        var conversation = await _chatService.CreateGroupConversationAsync(CurrentUserId, request);
        return Created($"/api/chat/conversations/{conversation.Id}", conversation);
    }

    [HttpPut("conversations/{id:guid}")]
    public async Task<IActionResult> UpdateConversation(Guid id, [FromBody] UpdateConversationRequest request)
    {
        var conversation = await _chatService.UpdateConversationAsync(id, CurrentUserId, request);
        if (conversation == null)
        {
            throw new NotFoundException("Conversation not found.");
        }

        return Ok(conversation);
    }

    [HttpDelete("conversations/{id:guid}")]
    public async Task<IActionResult> DeleteConversation(Guid id)
    {
        var success = await _chatService.DeleteConversationAsync(id, CurrentUserId);
        if (!success)
        {
            throw new NotFoundException("Conversation not found.");
        }

        return NoContent();
    }

    [HttpPost("conversations/{id:guid}/leave")]
    public async Task<IActionResult> LeaveConversation(Guid id)
    {
        var success = await _chatService.LeaveConversationAsync(id, CurrentUserId);
        if (!success)
        {
            throw new NotFoundException("Conversation not found.");
        }

        return NoContent();
    }

    [HttpPost("conversations/{id:guid}/members")]
    public async Task<IActionResult> AddMember(Guid id, [FromBody] AddMemberRequest request)
    {
        if (!Guid.TryParse(request.UserId, out var memberId))
        {
            throw new BadRequestException("Invalid user ID format.");
        }

        var success = await _chatService.AddMemberAsync(id, CurrentUserId, memberId);
        if (!success)
        {
            throw new BadRequestException("Unable to add member to conversation.");
        }

        return Ok();
    }

    [HttpDelete("conversations/{id:guid}/members/{memberId:guid}")]
    public async Task<IActionResult> RemoveMember(Guid id, Guid memberId)
    {
        var success = await _chatService.RemoveMemberAsync(id, CurrentUserId, memberId);
        if (!success)
        {
            throw new NotFoundException("Conversation member not found.");
        }

        return NoContent();
    }

    [HttpPost("conversations/{id:guid}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        await _chatService.MarkAsReadAsync(id, CurrentUserId);
        return Ok();
    }

    [HttpGet("conversations/{id:guid}/messages")]
    public async Task<IActionResult> GetMessages(Guid id, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var messages = await _chatService.GetMessagesAsync(id, CurrentUserId, page, pageSize);
        return Ok(messages);
    }

    [HttpPost("conversations/{id:guid}/messages")]
    public async Task<IActionResult> SendMessage(Guid id, [FromBody] SendMessageRequest request)
    {
        var message = await _chatService.SendMessageAsync(id, CurrentUserId, request);
        return Created($"/api/chat/messages/{message.Id}", message);
    }

    [HttpPut("messages/{id:guid}")]
    public async Task<IActionResult> EditMessage(Guid id, [FromBody] EditMessageRequest request)
    {
        var message = await _chatService.EditMessageAsync(id, CurrentUserId, request);
        if (message == null)
        {
            throw new NotFoundException("Message not found.");
        }

        return Ok(message);
    }

    [HttpDelete("messages/{id:guid}")]
    public async Task<IActionResult> DeleteMessage(Guid id)
    {
        var success = await _chatService.DeleteMessageAsync(id, CurrentUserId);
        if (!success)
        {
            throw new NotFoundException("Message not found.");
        }

        return NoContent();
    }

    [Authorize(Policy = AppPolicies.Admin)]
    [HttpDelete("messages/{id:guid}/admin-delete")]
    public async Task<IActionResult> AdminDeleteMessage(Guid id)
    {
        var success = await _chatService.DeleteMessageAsAdminAsync(id);
        if (!success)
        {
            throw new NotFoundException("Message not found.");
        }

        return NoContent();
    }

    [HttpPost("messages/{id:guid}/report")]
    public async Task<IActionResult> ReportMessage(Guid id, [FromBody] ReportMessageRequest? request)
    {
        var success = await _chatService.ReportMessageAsync(id, CurrentUserId, request?.Reason);
        if (!success)
        {
            throw new NotFoundException("Message not found.");
        }

        return Ok(new { message = "Message reported successfully." });
    }

    [HttpPost("messages/{id:guid}/reactions")]
    public async Task<IActionResult> AddReaction(Guid id, [FromBody] AddReactionRequest request)
    {
        var success = await _chatService.AddReactionAsync(id, CurrentUserId, request);
        if (!success)
        {
            throw new BadRequestException("Unable to add reaction.");
        }

        return Ok();
    }

    [HttpDelete("messages/{id:guid}/reactions")]
    public async Task<IActionResult> RemoveReaction(Guid id)
    {
        var success = await _chatService.RemoveReactionAsync(id, CurrentUserId);
        if (!success)
        {
            throw new NotFoundException("Reaction not found.");
        }

        return NoContent();
    }
}

public class CreateDirectRequest
{
    [Required]
    public string UserId { get; set; } = string.Empty;
}

public class AddMemberRequest
{
    [Required]
    public string UserId { get; set; } = string.Empty;
}

public class ReportMessageRequest
{
    [StringLength(1000)]
    public string? Reason { get; set; }
}
