using HueSTD.Application.DTOs.AI;

namespace HueSTD.Application.Interfaces;

public interface IAiService
{
    Task<ChatResponse> ChatAsync(ChatRequest request, string? userId = null);
}
