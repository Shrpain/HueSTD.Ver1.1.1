using HueSTD.API.Auth;
using HueSTD.Application.DTOs.AI;
using HueSTD.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace HueSTD.API.Hubs;

[Authorize]
public class AssistantHub : Hub
{
    private readonly IAssistantRealtimeService _assistantRealtimeService;

    public AssistantHub(IAssistantRealtimeService assistantRealtimeService)
    {
        _assistantRealtimeService = assistantRealtimeService;
    }

    public async Task JoinSession(AssistantSessionJoinRequest request)
    {
        var user = Context.User ?? throw new HubException("Phiên đăng nhập không hợp lệ.");
        var joined = await _assistantRealtimeService.JoinSessionAsync(
            user.GetRequiredUserIdValue(),
            user.GetEmail(),
            user.GetAppRole(),
            request,
            Context.ConnectionAborted);

        await Groups.AddToGroupAsync(Context.ConnectionId, joined.SessionId, Context.ConnectionAborted);
        await Clients.Caller.SendAsync("AssistantSessionJoined", joined, Context.ConnectionAborted);
    }

    public async Task SendUserMessage(AssistantSendMessageRequest request)
    {
        var user = Context.User ?? throw new HubException("Phiên đăng nhập không hợp lệ.");
        await Clients.Caller.SendAsync("AssistantTypingStarted", new { request.SessionId }, Context.ConnectionAborted);

        try
        {
            var assistantMessage = await _assistantRealtimeService.SendMessageAsync(
                user.GetRequiredUserIdValue(),
                user.GetEmail(),
                user.GetAppRole(),
                request,
                Context.ConnectionAborted);

            await Clients.Group(assistantMessage.SessionId)
                .SendAsync("AssistantMessageReceived", assistantMessage, Context.ConnectionAborted);
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("AssistantRequestFailed", new
            {
                request.SessionId,
                message = ex.Message
            }, Context.ConnectionAborted);

            throw new HubException(ex.Message);
        }
        finally
        {
            await Clients.Caller.SendAsync("AssistantTypingFinished", new { request.SessionId }, Context.ConnectionAborted);
        }
    }
}
