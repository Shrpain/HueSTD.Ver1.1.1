using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace HueSTD.Domain.Entities;

[Table("api_settings")]
public class ApiSettings : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("key_name")]
    public string KeyName { get; set; } = string.Empty;

    [Column("key_value")]
    public string KeyValue { get; set; } = string.Empty;

    [Column("description")]
    public string? Description { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}
