using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace HueSTD.Domain.Entities;

[Table("document_comments")]
public class DocumentComment : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("document_id")]
    public Guid DocumentId { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("content")]
    public string Content { get; set; } = string.Empty;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
