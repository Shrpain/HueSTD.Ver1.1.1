using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace HueSTD.Domain.Entities;

[Table("exams")]
public class Exam : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("user_id")]
    public Guid UserId { get; set; }

    [Column("title")]
    public string Title { get; set; } = string.Empty;

    [Column("description")]
    public string? Description { get; set; }

    [Column("duration_minutes")]
    public int DurationMinutes { get; set; }

    [Column("status")]
    public string Status { get; set; } = "draft";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; }
}

[Table("exam_questions")]
public class ExamQuestion : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("exam_id")]
    public Guid ExamId { get; set; }

    [Column("text")]
    public string Text { get; set; } = string.Empty;

    [Column("points")]
    public float Points { get; set; } = 1.0f;

    [Column("order_index")]
    public int OrderIndex { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}

[Table("exam_options")]
public class ExamOption : BaseModel
{
    [PrimaryKey("id", false)]
    public Guid Id { get; set; }

    [Column("question_id")]
    public Guid QuestionId { get; set; }

    [Column("text")]
    public string Text { get; set; } = string.Empty;

    [Column("is_correct")]
    public bool IsCorrect { get; set; }

    [Column("option_key")]
    public string OptionKey { get; set; } = string.Empty;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}
