using HueSTD.Application.DTOs.AI;
using HueSTD.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace HueSTD.API.Hubs;

[Authorize]
public class AssistantHub : Hub
{
    private readonly IAssistantRealtimeService _assistantRealtimeService;
    private readonly ILogger<AssistantHub> _logger;

    public AssistantHub(IAssistantRealtimeService assistantRealtimeService, ILogger<AssistantHub> logger)
    {
        _assistantRealtimeService = assistantRealtimeService;
        _logger = logger;
    }

    public async Task JoinSession(AssistantSessionJoinRequest request)
    {
        var accessToken = GetAccessToken();
        var joined = await _assistantRealtimeService.JoinSessionAsync(accessToken, request, Context.ConnectionAborted);
        await Groups.AddToGroupAsync(Context.ConnectionId, joined.SessionId, Context.ConnectionAborted);
        await Clients.Caller.SendAsync("AssistantSessionJoined", joined, Context.ConnectionAborted);
    }

    public async Task SendUserMessage(AssistantSendMessageRequest request)
    {
        var accessToken = GetAccessToken();
        await Clients.Caller.SendAsync("AssistantTypingStarted", new { request.SessionId }, Context.ConnectionAborted);

        var assistantMessage = await _assistantRealtimeService.SendMessageAsync(accessToken, request, Context.ConnectionAborted);
        await Clients.Group(assistantMessage.SessionId).SendAsync("AssistantMessageReceived", assistantMessage, Context.ConnectionAborted);
        await Clients.Caller.SendAsync("AssistantTypingFinished", new { request.SessionId }, Context.ConnectionAborted);
    }

    private string GetAccessToken()
    {
        var httpContext = Context.GetHttpContext();
        var accessToken = httpContext?.Request.Query["access_token"].ToString();
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            _logger.LogWarning("[AssistantHub] Missing access_token in SignalR query string.");
            throw new HubException("Missing access token.");
        }

        return accessToken;
    }
}
