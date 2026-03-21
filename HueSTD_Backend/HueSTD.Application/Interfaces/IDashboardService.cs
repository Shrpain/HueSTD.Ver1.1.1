using HueSTD.Application.DTOs.Document;
using HueSTD.Application.DTOs.Statistics;

namespace HueSTD.Application.Interfaces;

public interface IDashboardService
{
    Task<DashboardStatsDto> GetGlobalStatsAsync();
    Task<IEnumerable<DocumentDto>> GetWeeklyHotDocumentsAsync();
    Task<IEnumerable<UserRankingDto>> GetUserRankingsAsync(int limit = 10);
    Task TrackPageViewAsync(string? pagePath = "/", string? ipHash = null, string? userAgent = null);
}
