using HueSTD.Application.DTOs.AI;

namespace HueSTD.Application.Interfaces;

public interface IAiService
{
    Task<ChatResponse> ChatAsync(ChatRequest request, string? userId = null);
    Task<ChatResponse> CompleteAsync(AiCompletionRequest request, string? userId = null);
    Task<GeneratedExamDto?> GenerateExamAsync(GenerateExamRequest request, string? userId = null);
}
