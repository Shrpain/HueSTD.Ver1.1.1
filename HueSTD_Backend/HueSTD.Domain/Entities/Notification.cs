using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace HueSTD.Domain.Entities;

[Table("notifications")]
public class Notification : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("title")]
    public string Title { get; set; } = string.Empty;

    [Column("message")]
    public string Message { get; set; } = string.Empty;

    [Column("type")]
    public string Type { get; set; } = string.Empty;

    [Column("reference_id")]
    public Guid? ReferenceId { get; set; }

    [Column("is_read")]
    public bool IsRead { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
