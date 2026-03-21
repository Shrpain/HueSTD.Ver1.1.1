using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace HueSTD.Domain.Entities;

[Table("profiles")]
public class Profile : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("full_name")]
    public string? FullName { get; set; }

    [Column("email")]
    public string? Email { get; set; }

    [Column("school")]
    public string? School { get; set; }

    [Column("major")]
    public string? Major { get; set; }

    [Column("avatar_url")]
    public string? AvatarUrl { get; set; }

    [Column("points")]
    public int Points { get; set; }

    [Column("badge")]
    public string? Badge { get; set; }

    [Column("role")]
    public string Role { get; set; } = "user";

    [Column("public_id")]
    public string? PublicId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
