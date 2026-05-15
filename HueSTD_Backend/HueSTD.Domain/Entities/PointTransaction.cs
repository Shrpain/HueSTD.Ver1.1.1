using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace HueSTD.Domain.Entities;

[Table("point_transactions")]
public class PointTransaction : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("points_delta")]
    public int PointsDelta { get; set; }

    [Column("reason")]
    public string Reason { get; set; } = string.Empty;

    [Column("reference_type")]
    public string? ReferenceType { get; set; }

    [Column("reference_id")]
    public Guid? ReferenceId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
