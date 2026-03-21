using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace HueSTD.Domain.Entities;

[Table("documents")]
public class Document : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("title")]
    public string? Title { get; set; }

    [Column("description")]
    public string? Description { get; set; }

    [Column("file_url")]
    public string? FileUrl { get; set; }

    [Column("uploader_id")]
    public Guid? UploaderId { get; set; }

    [Column("school")]
    public string? School { get; set; }

    [Column("subject")]
    public string? Subject { get; set; }

    [Column("type")]
    public string? Type { get; set; }

    [Column("year")]
    public string? Year { get; set; }

    [Column("status")]
    public string? Status { get; set; }

    [Column("views")]
    public int Views { get; set; }

    [Column("downloads")]
    public int Downloads { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }

    [Column("is_approved")]
    public bool IsApproved { get; set; } = false;
}
