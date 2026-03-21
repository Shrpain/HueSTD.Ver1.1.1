
namespace HueSTD.Application.DTOs.Statistics;

public class DashboardStatsDto
{
    public int TotalDocuments { get; set; }
    public int TotalViews { get; set; }
    public int TotalDownloads { get; set; }
    public int WeeklyViews { get; set; }
    public int WeeklyDownloads { get; set; }
    public int TotalMembers { get; set; }
}

public class UserRankingDto
{
    public string? FullName { get; set; }
    public string? PublicId { get; set; }
    public string? AvatarUrl { get; set; }
    public int Points { get; set; }
    public int Rank { get; set; }
}
