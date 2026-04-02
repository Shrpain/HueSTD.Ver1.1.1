using HueSTD.Application.DTOs.Document;

namespace HueSTD.Application.Interfaces;

public interface IDocumentReadGateway
{
    Task<DocumentDto?> GetDocumentByIdAsync(Guid documentId);
    Task<IReadOnlyList<DocumentDto>> SearchDocumentsAsync(string query, string? preferredSchool = null, int limit = 5);
    Task<IReadOnlyList<DocumentDto>> GetTopViewedDocumentsAsync(int limit = 5);
    Task<IReadOnlyList<DocumentDto>> GetTopDownloadedDocumentsAsync(int limit = 5);
    Task<IReadOnlyList<DocumentDto>> GetNewestDocumentsAsync(int limit = 5);
}
