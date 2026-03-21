namespace HueSTD.Application.DTOs.AI;

public class ChatRequest
{
    public required string Message { get; set; }
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

public class UpdateAISettingsRequest
{
    public string? ApiKey { get; set; }
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
    public int? MessageLimit { get; set; }
    public string? ApiKey { get; set; }
    public bool? IsUnlocked { get; set; }
}

public class ResetUserAiUsageRequest
{
    public int MessageLimit { get; set; } = 10;
}

public class CreateUnlockRequestDto
{
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
