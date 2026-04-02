using HueSTD.Application.DTOs.AI;

namespace HueSTD.Application.Interfaces;

public interface IAssistantRealtimeService
{
    Task<AssistantSessionJoinedDto> JoinSessionAsync(
        string userId,
        string? email,
        string role,
        AssistantSessionJoinRequest request,
        CancellationToken cancellationToken = default);

    Task<AssistantChatMessageDto> SendMessageAsync(
        string userId,
        string? email,
        string role,
        AssistantSendMessageRequest request,
        CancellationToken cancellationToken = default);
}
