using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace HueSTD.Domain.Entities;

[Table("assistant_messages")]
public class AssistantMessage : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("session_key")]
    public string SessionKey { get; set; } = string.Empty;

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("role")]
    public string Role { get; set; } = string.Empty;

    [Column("content")]
    public string Content { get; set; } = string.Empty;

    [Column("quick_replies_json")]
    public string? QuickRepliesJson { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
