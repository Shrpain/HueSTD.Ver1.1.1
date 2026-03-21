using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace HueSTD.Domain.Entities;

[Table("ai_unlock_requests")]
public class AIUnlockRequest : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("message")]
    public string? Message { get; set; }

    [Column("status")]
    public string Status { get; set; } = "pending"; // pending | approved | rejected

    [Column("admin_id")]
    public Guid? AdminId { get; set; }

    [Column("admin_note")]
    public string? AdminNote { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
