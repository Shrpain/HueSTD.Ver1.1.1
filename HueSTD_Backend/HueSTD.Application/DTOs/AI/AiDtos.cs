using System.ComponentModel.DataAnnotations;

namespace HueSTD.Application.DTOs.AI;

public class ChatRequest
{
    [Required]
    [StringLength(20000)]
    public required string Message { get; set; }

    [Required]
    [StringLength(32000)]
    public required string Context { get; set; }

    public bool IsSystemPrompt { get; set; } = false;
    public string? UserId { get; set; }
}

public class ChatResponse
{
    public bool Success { get; set; }
    public string? Content { get; set; }
    public string? Error { get; set; }
    public string? ErrorCode { get; set; } // e.g. "limit_exceeded"
}

public class AiCompletionRequest
{
    [Required]
    [StringLength(12000)]
    public string SystemPrompt { get; set; } = string.Empty;

    [Required]
    [StringLength(30000)]
    public string UserPrompt { get; set; } = string.Empty;

    [Range(0, 2)]
    public decimal Temperature { get; set; } = 0.2m;

    [Range(1, 4000)]
    public int MaxTokens { get; set; } = 1600;
}

public class UpdateAISettingsRequest
{
    [StringLength(500)]
    public string? ApiKey { get; set; }

    [StringLength(100)]
    public string? Model { get; set; }
}

// ===== User AI Usage DTOs =====

public class UserAiUsageDto
{
    public string UserId { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? Email { get; set; }
    public string? AvatarUrl { get; set; }
    public string? ApiKey { get; set; }
    public int MessageLimit { get; set; }
    public int MessagesUsed { get; set; }
    public bool IsUnlocked { get; set; }
    public int Remaining => MessageLimit - MessagesUsed;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class UpdateUserAiUsageRequest
{
    [Range(0, 100000)]
    public int? MessageLimit { get; set; }

    [StringLength(500)]
    public string? ApiKey { get; set; }

    public bool? IsUnlocked { get; set; }
}

public class ResetUserAiUsageRequest
{
    [Range(0, 100000)]
    public int MessageLimit { get; set; } = 10;
}

// ===== AI Exam Generation DTOs =====

public class GenerateExamRequest
{
    [Required]
    public string Content { get; set; } = string.Empty;

    [Range(1, 50)]
    public int QuestionCount { get; set; } = 5;
}

public class GeneratedExamDto
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<GeneratedQuestionDto> Questions { get; set; } = new();
}

public class GeneratedQuestionDto
{
    public string Text { get; set; } = string.Empty;
    public double Points { get; set; } = 1.0;
    public List<GeneratedOptionDto> Options { get; set; } = new();
}

public class GeneratedOptionDto
{
    public string Key { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
}

public class CreateUnlockRequestDto
{
    [StringLength(2000)]
    public string? Message { get; set; }
}

public class UnlockRequestDto
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string? UserFullName { get; set; }
    public string? UserEmail { get; set; }
    public string? Message { get; set; }
    public string Status { get; set; } = "pending";
    public string? AdminNote { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class PaginatedUserAiUsageResponse
{
    public List<UserAiUsageDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling((double)TotalCount / PageSize) : 0;
}
