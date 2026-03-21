using HueSTD.Application.DTOs.Document;
using HueSTD.Application.Interfaces;
using HueSTD.Domain.Entities;
using Supabase;

namespace HueSTD.Infrastructure.Services;

public class DocumentService : IDocumentService
{
    private readonly Client _supabaseClient;
    private readonly INotificationService _notificationService;

    public DocumentService(Client supabaseClient, INotificationService notificationService)
    {
        _supabaseClient = supabaseClient;
        _notificationService = notificationService;
    }

    public async Task<IEnumerable<DocumentDto>> GetAllDocumentsAsync()
    {
        // Only return approved documents for regular users
        var result = await _supabaseClient
            .From<Document>()
            .Where(d => d.IsApproved == true)
            .Get();

        var documents = result.Models;
        
        // Filter out documents with null or empty UploaderId
        var validDocuments = documents.Where(x => x.UploaderId.HasValue && x.UploaderId != Guid.Empty).ToList();
        
        if (!validDocuments.Any())
        {
            return Enumerable.Empty<DocumentDto>();
        }
        
        // Fetch all profiles to map uploader names
        var uploaderIds = validDocuments.Select(x => x.UploaderId!.Value).Distinct().ToList();
        var profilesResult = await _supabaseClient
            .From<Profile>()
            .Filter("id", Supabase.Postgrest.Constants.Operator.In, uploaderIds)
            .Get();
            
        var profileMap = profilesResult.Models.ToDictionary(p => p.Id, p => p);

        return validDocuments.Select(doc => new DocumentDto
        {
            Id = doc.Id,
            Title = doc.Title,
            Description = doc.Description,
            FileUrl = doc.FileUrl,
            UploaderId = doc.UploaderId!.Value,
            UploaderName = (doc.UploaderId.HasValue && profileMap.ContainsKey(doc.UploaderId.Value)) ? profileMap[doc.UploaderId.Value].FullName : "Unknown",
            UploaderPublicId = (doc.UploaderId.HasValue && profileMap.ContainsKey(doc.UploaderId.Value)) ? profileMap[doc.UploaderId.Value].PublicId : null,
            UploaderAvatar = (doc.UploaderId.HasValue && profileMap.ContainsKey(doc.UploaderId.Value)) ? profileMap[doc.UploaderId.Value].AvatarUrl : null,
            School = doc.School,
            Subject = doc.Subject,
            Type = doc.Type,
            Year = doc.Year,
            Views = doc.Views,
            Downloads = doc.Downloads,
            CreatedAt = doc.CreatedAt
        });
    }

    public async Task<DocumentDto?> CreateDocumentAsync(Guid userId, CreateDocumentRequest request)
    {
        var document = new Document
        {
            Title = request.Title,
            Description = request.Description,
            FileUrl = request.FileUrl,
            UploaderId = userId,
            School = request.School,
            Subject = request.Subject,
            Type = request.Type,
            Year = request.Year,
            Status = "active",
            IsApproved = false, // Default: pending approval
            Views = 0,
            Downloads = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var result = await _supabaseClient
            .From<Document>()
            .Insert(document);

        var newDoc = result.Models.FirstOrDefault();
        if (newDoc == null) return null;

        // Fetch count of pending documents for grouped notification
        var pendingDocsResult = await _supabaseClient
            .From<Document>()
            .Where(d => d.IsApproved == false)
            .Get();
        
        int pendingCount = pendingDocsResult.Models.Count;

        // Notify admins about new document upload (Grouped)
        await _notificationService.NotifyAdminsGroupedAsync(
            "Tài liệu mới cần duyệt!",
            $"Có {pendingCount} tài liệu mới chờ xét duyệt",
            "admin_document_approval",
            pendingCount
        );

        return new DocumentDto
        {
            Id = newDoc.Id,
            Title = newDoc.Title,
            Description = newDoc.Description,
            FileUrl = newDoc.FileUrl,
            UploaderId = newDoc.UploaderId.GetValueOrDefault(),
            School = newDoc.School,
            Subject = newDoc.Subject,
            Type = newDoc.Type,
            Year = newDoc.Year,
            Views = newDoc.Views,
            Downloads = newDoc.Downloads,
            CreatedAt = newDoc.CreatedAt
        };
    }

    public async Task<bool> IncrementViewsAsync(Guid documentId)
    {
        try
        {
            var docResult = await _supabaseClient
                .From<Document>()
                .Filter("id", Supabase.Postgrest.Constants.Operator.Equals, documentId.ToString())
                .Get();

            var doc = docResult.Models.FirstOrDefault();
            if (doc == null) return false;

            doc.Views += 1;
            doc.UpdatedAt = DateTime.UtcNow;

            await _supabaseClient
                .From<Document>()
                .Filter("id", Supabase.Postgrest.Constants.Operator.Equals, documentId.ToString())
                .Set(x => x.Views, doc.Views)
                .Set(x => x.UpdatedAt, doc.UpdatedAt)
                .Update();

            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<DocumentDto?> GetDocumentByIdAsync(Guid documentId)
    {
        try
        {
            var result = await _supabaseClient
                .From<Document>()
                .Where(d => d.Id == documentId)
                .Get();

            var doc = result.Models.FirstOrDefault();
            if (doc == null) return null;

            // Get uploader profile
            Profile? uploader = null;
            if (doc.UploaderId.HasValue)
            {
                var profileResult = await _supabaseClient
                    .From<Profile>()
                    .Where(p => p.Id == doc.UploaderId.Value)
                    .Get();
                uploader = profileResult.Models.FirstOrDefault();
            }

            return new DocumentDto
            {
                Id = doc.Id,
                Title = doc.Title,
                Description = doc.Description,
                FileUrl = doc.FileUrl,
                UploaderId = doc.UploaderId.GetValueOrDefault(),
                UploaderName = uploader?.FullName ?? "Unknown",
                UploaderPublicId = uploader?.PublicId,
                UploaderAvatar = uploader?.AvatarUrl,
                School = doc.School,
                Subject = doc.Subject,
                Type = doc.Type,
                Year = doc.Year,
                Views = doc.Views,
                Downloads = doc.Downloads,
                CreatedAt = doc.CreatedAt
            };
        }
        catch
        {
            return null;
        }
    }

    public async Task<bool> IncrementDownloadsAsync(Guid documentId)
    {
        try
        {
            var docResult = await _supabaseClient
                .From<Document>()
                .Filter("id", Supabase.Postgrest.Constants.Operator.Equals, documentId.ToString())
                .Get();

            var doc = docResult.Models.FirstOrDefault();
            if (doc == null) return false;

            doc.Downloads += 1;
            doc.UpdatedAt = DateTime.UtcNow;

            await _supabaseClient
                .From<Document>()
                .Filter("id", Supabase.Postgrest.Constants.Operator.Equals, documentId.ToString())
                .Set(x => x.Downloads, doc.Downloads)
                .Set(x => x.UpdatedAt, doc.UpdatedAt)
                .Update();

            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<IReadOnlyList<DocumentCommentDto>> GetDocumentCommentsAsync(Guid documentId)
    {
        try
        {
            var docResult = await _supabaseClient
                .From<Document>()
                .Where(d => d.Id == documentId)
                .Get();

            var doc = docResult.Models.FirstOrDefault();
            if (doc == null || doc.IsApproved != true)
            {
                return Array.Empty<DocumentCommentDto>();
            }

            var commentsResult = await _supabaseClient
                .From<DocumentComment>()
                .Filter("document_id", Supabase.Postgrest.Constants.Operator.Equals, documentId.ToString())
                .Order("created_at", Supabase.Postgrest.Constants.Ordering.Descending)
                .Get();

            var rows = commentsResult.Models;
            if (rows.Count == 0)
            {
                return Array.Empty<DocumentCommentDto>();
            }

            var userIds = rows.Select(c => c.UserId).Distinct().ToList();
            var profilesResult = await _supabaseClient
                .From<Profile>()
                .Filter("id", Supabase.Postgrest.Constants.Operator.In, userIds)
                .Get();

            var profileMap = profilesResult.Models.ToDictionary(p => p.Id, p => p);

            return rows.Select(c => new DocumentCommentDto
            {
                Id = c.Id,
                DocumentId = c.DocumentId,
                UserId = c.UserId,
                AuthorName = profileMap.TryGetValue(c.UserId, out var p) ? (p.FullName ?? "Người dùng") : "Người dùng",
                AuthorAvatar = profileMap.TryGetValue(c.UserId, out var p2) ? p2.AvatarUrl : null,
                Content = c.Content,
                CreatedAt = c.CreatedAt
            }).ToList();
        }
        catch
        {
            return Array.Empty<DocumentCommentDto>();
        }
    }

    public async Task<DocumentCommentDto?> AddDocumentCommentAsync(Guid documentId, Guid userId, string content)
    {
        try
        {
            var trimmed = content.Trim();
            if (string.IsNullOrEmpty(trimmed) || trimmed.Length > 2000)
            {
                return null;
            }

            var docResult = await _supabaseClient
                .From<Document>()
                .Where(d => d.Id == documentId)
                .Get();

            var doc = docResult.Models.FirstOrDefault();
            if (doc == null || doc.IsApproved != true)
            {
                return null;
            }

            var comment = new DocumentComment
            {
                Id = Guid.NewGuid(),
                DocumentId = documentId,
                UserId = userId,
                Content = trimmed,
                CreatedAt = DateTime.UtcNow
            };

            var insert = await _supabaseClient.From<DocumentComment>().Insert(comment);
            var inserted = insert.Models.FirstOrDefault();
            if (inserted == null)
            {
                return null;
            }

            var profileResult = await _supabaseClient
                .From<Profile>()
                .Where(p => p.Id == userId)
                .Get();

            var profile = profileResult.Models.FirstOrDefault();

            return new DocumentCommentDto
            {
                Id = inserted.Id,
                DocumentId = inserted.DocumentId,
                UserId = inserted.UserId,
                AuthorName = profile?.FullName ?? "Người dùng",
                AuthorAvatar = profile?.AvatarUrl,
                Content = inserted.Content,
                CreatedAt = inserted.CreatedAt
            };
        }
        catch
        {
            return null;
        }
    }
}
