using HueSTD.Application.DTOs.AI;

namespace HueSTD.Application.Interfaces;

public interface IAssistantRealtimeService
{
    Task<AssistantSessionJoinedDto> JoinSessionAsync(string accessToken, AssistantSessionJoinRequest request, CancellationToken cancellationToken = default);
    Task<AssistantChatMessageDto> SendMessageAsync(string accessToken, AssistantSendMessageRequest request, CancellationToken cancellationToken = default);
}
