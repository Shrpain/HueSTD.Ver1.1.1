using HueSTD.Application.DTOs.Document;

namespace HueSTD.Application.Interfaces;

public interface IDocumentService
{
    Task<IEnumerable<DocumentDto>> GetAllDocumentsAsync();
    Task<DocumentDto?> CreateDocumentAsync(Guid userId, CreateDocumentRequest request);
    Task<DocumentDto?> GetDocumentByIdAsync(Guid documentId);
    Task<bool> IncrementViewsAsync(Guid documentId);
    Task<bool> IncrementDownloadsAsync(Guid documentId);
    Task<IReadOnlyList<DocumentCommentDto>> GetDocumentCommentsAsync(Guid documentId);
    Task<DocumentCommentDto?> AddDocumentCommentAsync(Guid documentId, Guid userId, string content);
}
