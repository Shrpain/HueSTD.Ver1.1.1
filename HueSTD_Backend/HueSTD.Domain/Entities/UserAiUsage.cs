using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace HueSTD.Domain.Entities;

[Table("user_ai_usages")]
public class UserAiUsage : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("api_key")]
    public string? ApiKey { get; set; }

    [Column("message_limit")]
    public int MessageLimit { get; set; } = 10;

    [Column("messages_used")]
    public int MessagesUsed { get; set; } = 0;

    [Column("is_unlocked")]
    public bool IsUnlocked { get; set; } = false;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
