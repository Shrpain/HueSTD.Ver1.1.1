using HueSTD.Application.DTOs.Document;

namespace HueSTD.Application.Interfaces;

public interface IDocumentService
{
    Task<IEnumerable<DocumentDto>> GetAllDocumentsAsync();
    Task<IReadOnlyList<DocumentDto>> SearchDocumentsForAssistantAsync(string query, string? preferredSchool = null, int limit = 5);
    Task<DocumentDto?> CreateDocumentAsync(Guid userId, CreateDocumentRequest request);
    Task<DocumentDto?> GetDocumentByIdAsync(Guid documentId);
    Task<bool> IncrementViewsAsync(Guid documentId, Guid? actorUserId = null);
    Task<bool> IncrementDownloadsAsync(Guid documentId, Guid? actorUserId = null);
    Task<IReadOnlyList<DocumentCommentDto>> GetDocumentCommentsAsync(Guid documentId);
    Task<DocumentCommentDto?> AddDocumentCommentAsync(Guid documentId, Guid userId, string content);
}
