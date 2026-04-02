using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace HueSTD.Domain.Entities;

[Table("assistant_sessions")]
public class AssistantSession : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("session_key")]
    public string SessionKey { get; set; } = string.Empty;

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("user_name")]
    public string UserName { get; set; } = string.Empty;

    [Column("page_context")]
    public string? PageContext { get; set; }

    [Column("module")]
    public string? Module { get; set; }

    [Column("locale")]
    public string Locale { get; set; } = "vi-VN";

    [Column("persona")]
    public string Persona { get; set; } = "default";

    [Column("summary")]
    public string? Summary { get; set; }

    [Column("metadata_json")]
    public string? MetadataJson { get; set; }

    [Column("last_activity_at")]
    public DateTime LastActivityAt { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
