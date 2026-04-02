using HueSTD.Application.DTOs.Document;
using HueSTD.Application.Interfaces;
using HueSTD.Domain.Entities;
using Microsoft.Extensions.Logging;
using Supabase;
using System.Globalization;
using System.Text;

namespace HueSTD.Infrastructure.Services;

public class DocumentReadGateway : IDocumentReadGateway
{
    private readonly Client _supabaseClient;
    private readonly ILogger<DocumentReadGateway> _logger;

    public DocumentReadGateway(Client supabaseClient, ILogger<DocumentReadGateway> logger)
    {
        _supabaseClient = supabaseClient;
        _logger = logger;
    }

    public async Task<DocumentDto?> GetDocumentByIdAsync(Guid documentId)
    {
        try
        {
            var result = await _supabaseClient
                .From<Document>()
                .Where(d => d.Id == documentId && d.IsApproved == true)
                .Get();

            var doc = result.Models.FirstOrDefault();
            return doc == null ? null : MapDocument(doc);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[DocumentReadGateway] Failed to get document {DocumentId}", documentId);
            return null;
        }
    }

    public async Task<IReadOnlyList<DocumentDto>> SearchDocumentsAsync(string query, string? preferredSchool = null, int limit = 5)
    {
        var normalizedQuery = query?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedQuery))
        {
            return Array.Empty<DocumentDto>();
        }

        var documents = await GetApprovedDocumentsAsync();
        if (documents.Count == 0)
        {
            return Array.Empty<DocumentDto>();
        }

        var keywords = normalizedQuery
            .Split([' ', '\t', '\r', '\n', ',', '.', ';', ':', '-', '_', '/', '\\', '(', ')', '[', ']', '{', '}', '?', '!'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(token => token.Length >= 2)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (keywords.Length == 0)
        {
            keywords = [normalizedQuery];
        }

        return documents
            .Select(doc => new
            {
                Document = doc,
                Score = ScoreDocument(doc, normalizedQuery, keywords, preferredSchool)
            })
            .Where(x => x.Score > 0)
            .OrderByDescending(x => x.Score)
            .ThenByDescending(x => x.Document.Downloads)
            .ThenByDescending(x => x.Document.Views)
            .ThenByDescending(x => x.Document.CreatedAt)
            .Take(Math.Max(1, limit))
            .Select(x => x.Document)
            .ToList();
    }

    public async Task<DocumentQueryResultDto> QueryDocumentsAsync(DocumentQueryRequest request)
    {
        var documents = await GetApprovedDocumentsAsync();
        if (documents.Count == 0)
        {
            return new DocumentQueryResultDto();
        }

        var normalizedQuery = request.Query?.Trim();
        var normalizedSchool = Normalize(request.School);
        var normalizedSubject = Normalize(request.Subject);
        var normalizedType = Normalize(request.Type);
        var normalizedYear = Normalize(request.Year);

        IEnumerable<DocumentDto> filtered = documents.Where(doc =>
            MatchesFilter(doc.School, normalizedSchool) &&
            MatchesFilter(doc.Subject, normalizedSubject) &&
            MatchesFilter(doc.Type, normalizedType) &&
            MatchesFilter(doc.Year, normalizedYear));

        var filteredList = filtered.ToList();
        var totalCount = filteredList.Count;
        if (totalCount == 0)
        {
            return new DocumentQueryResultDto();
        }

        var sorted = ApplySort(filteredList, normalizedQuery, request.SortBy);

        return new DocumentQueryResultDto
        {
            TotalCount = totalCount,
            Documents = sorted.Take(Math.Max(1, request.Limit)).ToList()
        };
    }

    public async Task<IReadOnlyList<DocumentDto>> GetTopViewedDocumentsAsync(int limit = 5)
    {
        var documents = await GetApprovedDocumentsAsync();
        return documents
            .OrderByDescending(x => x.Views)
            .ThenByDescending(x => x.Downloads)
            .ThenByDescending(x => x.CreatedAt)
            .Take(Math.Max(1, limit))
            .ToList();
    }

    public async Task<IReadOnlyList<DocumentDto>> GetTopDownloadedDocumentsAsync(int limit = 5)
    {
        var documents = await GetApprovedDocumentsAsync();
        return documents
            .OrderByDescending(x => x.Downloads)
            .ThenByDescending(x => x.Views)
            .ThenByDescending(x => x.CreatedAt)
            .Take(Math.Max(1, limit))
            .ToList();
    }

    public async Task<IReadOnlyList<DocumentDto>> GetNewestDocumentsAsync(int limit = 5)
    {
        var documents = await GetApprovedDocumentsAsync();
        return documents
            .OrderByDescending(x => x.CreatedAt)
            .Take(Math.Max(1, limit))
            .ToList();
    }

    private async Task<List<DocumentDto>> GetApprovedDocumentsAsync()
    {
        try
        {
            var result = await _supabaseClient
                .From<Document>()
                .Where(d => d.IsApproved == true)
                .Get();

            return result.Models
                .Where(d => d.Id != Guid.Empty)
                .Select(MapDocument)
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[DocumentReadGateway] Failed to load approved documents");
            return [];
        }
    }

    private static DocumentDto MapDocument(Document doc)
    {
        return new DocumentDto
        {
            Id = doc.Id,
            Title = doc.Title,
            Description = doc.Description,
            FileUrl = doc.FileUrl,
            UploaderId = doc.UploaderId ?? Guid.Empty,
            School = doc.School,
            Subject = doc.Subject,
            Type = doc.Type,
            Year = doc.Year,
            Views = doc.Views,
            Downloads = doc.Downloads,
            Status = doc.Status,
            CreatedAt = doc.CreatedAt
        };
    }

    private static int ScoreDocument(DocumentDto doc, string normalizedQuery, string[] keywords, string? preferredSchool)
    {
        var score = 0;

        score += ScoreField(doc.Title, normalizedQuery, keywords, 10);
        score += ScoreField(doc.Subject, normalizedQuery, keywords, 8);
        score += ScoreField(doc.Type, normalizedQuery, keywords, 6);
        score += ScoreField(doc.Description, normalizedQuery, keywords, 4);
        score += ScoreField(doc.School, normalizedQuery, keywords, 4);
        score += ScoreField(doc.Year, normalizedQuery, keywords, 2);

        if (!string.IsNullOrWhiteSpace(preferredSchool) &&
            !string.IsNullOrWhiteSpace(doc.School) &&
            doc.School.Contains(preferredSchool, StringComparison.OrdinalIgnoreCase))
        {
            score += 5;
        }

        if (doc.Downloads > 0)
        {
            score += Math.Min(5, doc.Downloads / 10);
        }

        if (doc.Views > 0)
        {
            score += Math.Min(3, doc.Views / 20);
        }

        return score;
    }

    private static IEnumerable<DocumentDto> ApplySort(IEnumerable<DocumentDto> documents, string? query, string? sortBy)
    {
        var normalizedSort = Normalize(sortBy);
        return normalizedSort switch
        {
            "views" => documents
                .OrderByDescending(x => x.Views)
                .ThenByDescending(x => x.Downloads)
                .ThenByDescending(x => x.CreatedAt),
            "downloads" => documents
                .OrderByDescending(x => x.Downloads)
                .ThenByDescending(x => x.Views)
                .ThenByDescending(x => x.CreatedAt),
            "newest" => documents
                .OrderByDescending(x => x.CreatedAt),
            _ => OrderByRelevance(documents, query)
        };
    }

    private static IEnumerable<DocumentDto> OrderByRelevance(IEnumerable<DocumentDto> documents, string? query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return documents
                .OrderByDescending(x => x.CreatedAt)
                .ThenByDescending(x => x.Downloads)
                .ThenByDescending(x => x.Views);
        }

        var keywords = query
            .Split([' ', '\t', '\r', '\n', ',', '.', ';', ':', '-', '_', '/', '\\', '(', ')', '[', ']', '{', '}', '?', '!'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(token => token.Length >= 2)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (keywords.Length == 0)
        {
            keywords = [query];
        }

        return documents
            .Select(doc => new
            {
                Document = doc,
                Score = ScoreDocument(doc, query, keywords, preferredSchool: null)
            })
            .OrderByDescending(x => x.Score)
            .ThenByDescending(x => x.Document.Downloads)
            .ThenByDescending(x => x.Document.Views)
            .ThenByDescending(x => x.Document.CreatedAt)
            .Select(x => x.Document);
    }

    private static int ScoreField(string? field, string normalizedQuery, string[] keywords, int weight)
    {
        if (string.IsNullOrWhiteSpace(field))
        {
            return 0;
        }

        var score = 0;
        if (field.Contains(normalizedQuery, StringComparison.OrdinalIgnoreCase))
        {
            score += weight * 3;
        }

        foreach (var keyword in keywords)
        {
            if (field.Contains(keyword, StringComparison.OrdinalIgnoreCase))
            {
                score += weight;
            }
        }

        return score;
    }

    private static bool MatchesFilter(string? field, string? normalizedFilter)
    {
        if (string.IsNullOrWhiteSpace(normalizedFilter))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(field))
        {
            return false;
        }

        return Normalize(field)!.Contains(normalizedFilter, StringComparison.OrdinalIgnoreCase);
    }

    private static string? Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var decomposed = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);

        foreach (var ch in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            builder.Append(ch == 'đ' ? 'd' : ch);
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }
}
