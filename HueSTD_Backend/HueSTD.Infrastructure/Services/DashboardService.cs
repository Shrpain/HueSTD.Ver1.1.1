using HueSTD.Application.DTOs.Document;
using HueSTD.Application.DTOs.Statistics;
using HueSTD.Application.Interfaces;
using HueSTD.Domain.Entities;
using Supabase;

namespace HueSTD.Infrastructure.Services;

public class DashboardService : IDashboardService
{
    private readonly Client _supabaseClient;

    public DashboardService(Client supabaseClient)
    {
        _supabaseClient = supabaseClient;
    }

    public async Task<DashboardStatsDto> GetGlobalStatsAsync()
    {
        // Get all documents
        var docResult = await _supabaseClient.From<Document>().Get();
        var allDocs = docResult.Models;

        // Total views = lượt truy cập trang HueSTD (page_views table)
        var totalViewsResult = await _supabaseClient.From<PageView>().Select("id").Get();
        var totalViews = totalViewsResult.Models.Count;

        // Lượt tải = tổng downloads của all documents
        var totalDownloads = allDocs.Sum(x => x.Downloads);

        // Weekly stats
        var lastWeek = DateTime.UtcNow.AddDays(-7);

        // Weekly views = page_views trong 7 ngày gần nhất
        var weeklyViewsResult = await _supabaseClient
            .From<PageView>()
            .Where(pv => pv.VisitedAt >= lastWeek)
            .Select("id")
            .Get();
        var weeklyViews = weeklyViewsResult.Models.Count;

        // Weekly downloads = documents updated trong 7 ngày gần nhất
        var weeklyDownloads = allDocs.Where(x => x.UpdatedAt >= lastWeek).Sum(x => x.Downloads);

        // Total Members
        var profileResult = await _supabaseClient.From<Profile>().Get();
        var totalMembers = profileResult.Models.Count;

        return new DashboardStatsDto
        {
            TotalDocuments = allDocs.Count,
            TotalViews = totalViews,
            TotalDownloads = totalDownloads,
            WeeklyViews = weeklyViews,
            WeeklyDownloads = weeklyDownloads,
            TotalMembers = totalMembers
        };
    }

    public async Task TrackPageViewAsync(string? pagePath = "/", string? ipHash = null, string? userAgent = null)
    {
        await _supabaseClient.From<PageView>().Insert(new PageView
        {
            Id = Guid.NewGuid(),
            PagePath = pagePath ?? "/",
            VisitedAt = DateTime.UtcNow,
            IpHash = ipHash,
            UserAgent = userAgent
        });
    }

    public async Task<IEnumerable<DocumentDto>> GetWeeklyHotDocumentsAsync()
    {
        // Hot = Sorted by Views descending, limited to top 5
        // Ideally filter by updated_at > last 7 days
        var lastWeek = DateTime.UtcNow.AddDays(-7);
        
        var result = await _supabaseClient
            .From<Document>()
            .Order("views", Supabase.Postgrest.Constants.Ordering.Descending)
            .Limit(5)
            .Get();

        // Map uploader names (reuse pattern from DocumentService)
        var documents = result.Models;
        var uploaderIds = documents
            .Where(x => x.UploaderId.HasValue)
            .Select(x => x.UploaderId.Value)
            .Distinct()
            .ToList();
        
        var profilesResult = await _supabaseClient
            .From<Profile>()
            .Filter("id", Supabase.Postgrest.Constants.Operator.In, uploaderIds)
            .Get();
            
        var profileMap = profilesResult.Models.ToDictionary(p => p.Id, p => p);

        return documents.Select(doc => new DocumentDto
        {
            Id = doc.Id,
            Title = doc.Title,
            Description = doc.Description,
            FileUrl = doc.FileUrl,
            UploaderId = doc.UploaderId ?? Guid.Empty, // Or handle as nullable in DTO if preferred
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

    public async Task<IEnumerable<UserRankingDto>> GetUserRankingsAsync(int limit = 10)
    {
        var result = await _supabaseClient
            .From<Profile>()
            .Order("points", Supabase.Postgrest.Constants.Ordering.Descending)
            .Limit(limit)
            .Get();

        return result.Models.Select((p, index) => new UserRankingDto
        {
            FullName = p.FullName,
            PublicId = p.PublicId,
            AvatarUrl = p.AvatarUrl,
            Points = p.Points,
            Rank = index + 1
        });
    }
}
