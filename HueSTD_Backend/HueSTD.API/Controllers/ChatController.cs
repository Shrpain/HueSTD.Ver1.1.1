using HueSTD.Application.DTOs.Chat;
using HueSTD.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HueSTD.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ChatController : ControllerBase
{
    private readonly IChatService _chatService;
    private readonly IAuthService _authService;

    public ChatController(IChatService chatService, IAuthService authService)
    {
        _chatService = chatService;
        _authService = authService;
    }

    private async Task<(Guid UserId, IActionResult? Error)> ResolveUserAsync()
    {
        var authHeader = Request.Headers["Authorization"].ToString();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return (Guid.Empty, Unauthorized(new { message = "No token provided." }));

        var token = authHeader["Bearer ".Length..].Trim();
        var user = await _authService.GetCurrentUserAsync(token);
        if (user == null || string.IsNullOrEmpty(user.Id))
            return (Guid.Empty, Unauthorized(new { message = "Invalid or expired token." }));

        if (!Guid.TryParse(user.Id, out var userGuid))
            return (Guid.Empty, BadRequest(new { message = "Invalid user ID format." }));

        return (userGuid, null);
    }

    private async Task<bool> IsCurrentUserAdminAsync()
    {
        var authHeader = Request.Headers["Authorization"].ToString();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return false;

        var token = authHeader["Bearer ".Length..].Trim();
        var user = await _authService.GetCurrentUserAsync(token);
        return user?.Role == "admin";
    }

    /// <summary>Search users to start a conversation (any authenticated member; not admin-only).</summary>
    [HttpGet("users/search")]
    public async Task<IActionResult> SearchUsers([FromQuery] string search, [FromQuery] int limit = 20)
    {
        var (userId, err) = await ResolveUserAsync();
        if (err != null) return err;

        limit = Math.Clamp(limit, 1, 50);
        var results = await _chatService.SearchUsersForChatAsync(userId, search ?? "", limit);
        return Ok(results);
    }

    #region Conversations

    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations()
    {
        var (userId, err) = await ResolveUserAsync();
        if (err != null) return err;

        var conversations = await _chatService.GetUserConversationsAsync(userId);
        return Ok(conversations);
    }

    [HttpGet("conversations/{id:guid}")]
    public async Task<IActionResult> GetConversation(Guid id)
    {
        var (userId, err) = await ResolveUserAsync();
        if (err != null) return err;

        var conversation = await _chatService.GetConversationAsync(id, userId);
        if (conversation == null) return NotFound();
        return Ok(conversation);
    }

    [HttpPost("conversations/direct")]
    public async Task<IActionResult> CreateDirectConversation([FromBody] CreateDirectRequest request)
    {
        var (userId, err) = await ResolveUserAsync();
        if (err != null) return err;

        if (!Guid.TryParse(request.UserId, out var otherUserId))
            return BadRequest(new { message = "Invalid user ID format." });

        if (otherUserId == userId)
            return BadRequest(new { message = "Không thể tạo cuộc trò chuyện với chính bạn." });

        var conversation = await _chatService.CreateDirectConversationAsync(userId, otherUserId);
        return Created($"/api/chat/conversations/{conversation.Id}", conversation);
    }

    [HttpPost("conversations/group")]
    public async Task<IActionResult> CreateGroupConversation([FromBody] CreateConversationRequest request)
    {
        var (userId, err) = await ResolveUserAsync();
        if (err != null) return err;

        var conversation = await _chatService.CreateGroupConversationAsync(userId, request);
        return Created($"/api/chat/conversations/{conversation.Id}", conversation);
    }

    [HttpPut("conversations/{id:guid}")]
    public async Task<IActionResult> UpdateConversation(Guid id, [FromBody] UpdateConversationRequest request)
    {
        var (userId, err) = await ResolveUserAsync();
        if (err != null) return err;

        var conversation = await _chatService.UpdateConversationAsync(id, userId, request);
        if (conversation == null) return NotFound();
        return Ok(conversation);
    }

    [HttpDelete("conversations/{id:guid}")]
    public async Task<IActionResult> DeleteConversation(Guid id)
    {
        var (userId, err) = await ResolveUserAsync();
        if (err != null) return err;

        var success = await _chatService.DeleteConversationAsync(id, userId);
        return success ? NoContent() : NotFound();
    }

    [HttpPost("conversations/{id:guid}/leave")]
    public async Task<IActionResult> LeaveConversation(Guid id)
    {
        var (userId, err) = await ResolveUserAsync();
        if (err != null) return err;

        var success = await _chatService.LeaveConversationAsync(id, userId);
        return success ? NoContent() : NotFound();
    }

    [HttpPost("conversations/{id:guid}/members")]
    public async Task<IActionResult> AddMember(Guid id, [FromBody] AddMemberRequest request)
    {
        var (userId, err) = await ResolveUserAsync();
        if (err != null) return err;

        if (!Guid.TryParse(request.UserId, out var memberId))
            return BadRequest(new { message = "Invalid user ID format." });

        var success = await _chatService.AddMemberAsync(id, userId, memberId);
        return success ? Ok() : BadRequest();
    }

    [HttpDelete("conversations/{id:guid}/members/{memberId:guid}")]
    public async Task<IActionResult> RemoveMember(Guid id, Guid memberId)
    {
        var (userId, err) = await ResolveUserAsync();
        if (err != null) return err;

        var success = await _chatService.RemoveMemberAsync(id, userId, memberId);
        return success ? NoContent() : NotFound();
    }

    [HttpPost("conversations/{id:guid}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id)
    {
        var (userId, err) = await ResolveUserAsync();
        if (err != null) return err;

        await _chatService.MarkAsReadAsync(id, userId);
        return Ok();
    }

    #endregion

    #region Messages

    [HttpGet("conversations/{id:guid}/messages")]
    public async Task<IActionResult> GetMessages(Guid id, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var (userId, err) = await ResolveUserAsync();
        if (err != null) return err;

        var messages = await _chatService.GetMessagesAsync(id, userId, page, pageSize);
        return Ok(messages);
    }

    [HttpPost("conversations/{id:guid}/messages")]
    public async Task<IActionResult> SendMessage(Guid id, [FromBody] SendMessageRequest request)
    {
        var (userId, err) = await ResolveUserAsync();
        if (err != null) return err;

        var message = await _chatService.SendMessageAsync(id, userId, request);
        return Created($"/api/chat/messages/{message.Id}", message);
    }

    [HttpPut("messages/{id:guid}")]
    public async Task<IActionResult> EditMessage(Guid id, [FromBody] EditMessageRequest request)
    {
        var (userId, err) = await ResolveUserAsync();
        if (err != null) return err;

        var message = await _chatService.EditMessageAsync(id, userId, request);
        return message != null ? Ok(message) : NotFound();
    }

    [HttpDelete("messages/{id:guid}")]
    public async Task<IActionResult> DeleteMessage(Guid id)
    {
        var (userId, err) = await ResolveUserAsync();
        if (err != null) return err;

        var success = await _chatService.DeleteMessageAsync(id, userId);
        return success ? NoContent() : NotFound();
    }

    [HttpDelete("messages/{id:guid}/admin-delete")]
    public async Task<IActionResult> AdminDeleteMessage(Guid id)
    {
        if (!await IsCurrentUserAdminAsync())
            return Forbid();

        var success = await _chatService.DeleteMessageAsAdminAsync(id);
        return success ? NoContent() : NotFound();
    }

    [HttpPost("messages/{id:guid}/report")]
    public async Task<IActionResult> ReportMessage(Guid id, [FromBody] ReportMessageRequest? request)
    {
        var (userId, err) = await ResolveUserAsync();
        if (err != null) return err;

        var success = await _chatService.ReportMessageAsync(id, userId, request?.Reason);
        return success ? Ok(new { message = "Message reported successfully." }) : NotFound();
    }

    #endregion

    #region Reactions

    [HttpPost("messages/{id:guid}/reactions")]
    public async Task<IActionResult> AddReaction(Guid id, [FromBody] AddReactionRequest request)
    {
        var (userId, err) = await ResolveUserAsync();
        if (err != null) return err;

        var success = await _chatService.AddReactionAsync(id, userId, request);
        return success ? Ok() : BadRequest();
    }

    [HttpDelete("messages/{id:guid}/reactions")]
    public async Task<IActionResult> RemoveReaction(Guid id)
    {
        var (userId, err) = await ResolveUserAsync();
        if (err != null) return err;

        var success = await _chatService.RemoveReactionAsync(id, userId);
        return success ? NoContent() : NotFound();
    }

    #endregion
}

public class CreateDirectRequest
{
    public string UserId { get; set; } = string.Empty;
}

public class AddMemberRequest
{
    public string UserId { get; set; } = string.Empty;
}

public class ReportMessageRequest
{
    public string? Reason { get; set; }
}
