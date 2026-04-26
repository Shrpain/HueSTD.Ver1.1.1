namespace HueSTD.Application.DTOs.Exam;

public class ExamDto
{
    public Guid? Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DurationMinutes { get; set; }
    public string Status { get; set; } = "draft";
    public DateTime? CreatedAt { get; set; }
    public List<ExamQuestionDto> Questions { get; set; } = new();
}

public class ExamQuestionDto
{
    public Guid? Id { get; set; }
    public string Text { get; set; } = string.Empty;
    public float Points { get; set; } = 1.0f;
    public List<ExamOptionDto> Options { get; set; } = new();
}

public class ExamOptionDto
{
    public Guid? Id { get; set; }
    public string Key { get; set; } = string.Empty; // A, B, C, D
    public string Text { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
}
