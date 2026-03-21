using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace HueSTD.Domain.Entities;

[Table("page_views")]
public class PageView : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("page_path")]
    public string PagePath { get; set; } = "/";

    [Column("visited_at")]
    public DateTime VisitedAt { get; set; } = DateTime.UtcNow;

    [Column("ip_hash")]
    public string? IpHash { get; set; }

    [Column("user_agent")]
    public string? UserAgent { get; set; }
}
