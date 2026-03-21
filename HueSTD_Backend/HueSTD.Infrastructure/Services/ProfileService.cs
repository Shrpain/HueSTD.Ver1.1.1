using HueSTD.Application.DTOs.Profile;
using HueSTD.Application.Interfaces;
using HueSTD.Domain.Entities;
using Supabase;

namespace HueSTD.Infrastructure.Services;

public class ProfileService : IProfileService
{
    private readonly Client _supabaseClient;

    public ProfileService(Client supabaseClient)
    {
        _supabaseClient = supabaseClient;
    }

    public async Task<PaginatedResult<DocumentDto>> GetUserDocumentsAsync(string userId, int page, int pageSize)
    {
        if (!Guid.TryParse(userId, out var userGuid))
            return new PaginatedResult<DocumentDto> { Page = page, PageSize = pageSize };

        var result = await _supabaseClient
            .From<Document>()
            .Where(x => x.UploaderId == userGuid)
            .Order(x => x.CreatedAt, Supabase.Postgrest.Constants.Ordering.Descending)
            .Range((page - 1) * pageSize, page * pageSize - 1)
            .Get();

        var totalCount = await _supabaseClient
            .From<Document>()
            .Where(x => x.UploaderId == userGuid)
            .Count(Supabase.Postgrest.Constants.CountType.Exact);

        return new PaginatedResult<DocumentDto>
        {
            Items = result.Models.Select(x => new DocumentDto
            {
                Id = x.Id,
                Title = x.Title,
                Description = x.Description,
                FileUrl = x.FileUrl,
                School = x.School,
                Subject = x.Subject,
                Type = x.Type,
                Year = x.Year,
                Views = x.Views,
                Downloads = x.Downloads,
                Status = x.IsApproved ? "active" : "pending",
                CreatedAt = x.CreatedAt
            }).ToList(),
            TotalCount = (int)totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<ProfileStatsDto> GetUserProfileStatsAsync(string userId)
    {
        if (!Guid.TryParse(userId, out var userGuid))
            return new ProfileStatsDto();

        var documents = await _supabaseClient
            .From<Document>()
            .Where(x => x.UploaderId == userGuid)
            .Get();

        var totalDocs = documents.Models.Count;
        var totalDownloads = documents.Models.Sum(x => x.Downloads);
        
        // Since rating is not in the DB yet, we'll return 0 or a placeholder. 
        // If the user wants to "tính đánh giá", maybe we just return 0 for now.
        var avgRating = 0.0; 

        return new ProfileStatsDto
        {
            TotalDocuments = totalDocs,
            TotalDownloads = totalDownloads,
            AverageRating = avgRating
        };
    }

    public async Task<int> GetUserRankAsync(Guid userId)
    {
        // Get current user's points
        var currentUser = await _supabaseClient
            .From<Profile>()
            .Where(x => x.Id == userId)
            .Single();

        if (currentUser == null)
            return 0;

        var userPoints = currentUser.Points;

        // Count users with more points than current user
        // Rank = 1 + number of users with higher points
        var higherRankedCount = await _supabaseClient
            .From<Profile>()
            .Filter("points", Supabase.Postgrest.Constants.Operator.GreaterThan, userPoints.ToString())
            .Count(Supabase.Postgrest.Constants.CountType.Exact);

        return (int)higherRankedCount + 1;
    }
}
