namespace HueSTD.Application.DTOs.Profile;

public class ProfileStatsDto
{
    public int TotalDocuments { get; set; }
    public int TotalDownloads { get; set; }
    public double AverageRating { get; set; }
}

public class PaginatedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
}

public class DocumentDto
{
    public Guid Id { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? FileUrl { get; set; }
    public string? School { get; set; }
    public string? Subject { get; set; }
    public string? Type { get; set; }
    public string? Year { get; set; }
    public int Views { get; set; }
    public int Downloads { get; set; }
    public string? Status { get; set; }
    public DateTime CreatedAt { get; set; }
}
