using System.ComponentModel.DataAnnotations;

namespace HueSTD.Application.DTOs.AI;

public class AssistantSessionJoinRequest
{
    [Required]
    [StringLength(100, MinimumLength = 2)]
    public string SessionId { get; set; } = string.Empty;
    [StringLength(16)]
    public string? Locale { get; set; }
    [StringLength(32)]
    public string? Persona { get; set; }
    [StringLength(200)]
    public string? PagePath { get; set; }
    [StringLength(200)]
    public string? PageTitle { get; set; }
    [StringLength(64)]
    public string? Module { get; set; }
    [StringLength(500)]
    public string? ContextSummary { get; set; }
    public Dictionary<string, string>? Metadata { get; set; }
}

public class AssistantSessionJoinedDto
{
    public string SessionId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string WelcomeMessage { get; set; } = string.Empty;
    public string[] Capabilities { get; set; } = Array.Empty<string>();
    public string Locale { get; set; } = "vi-VN";
    public string Persona { get; set; } = "default";
    public string? SessionSummary { get; set; }
    public bool HumanHandoverAvailable { get; set; }
    public Dictionary<string, bool> FeatureFlags { get; set; } = new();
    public string[] SuggestedReplies { get; set; } = Array.Empty<string>();
    public List<AssistantChatMessageDto> Messages { get; set; } = new();
}

public class AssistantSendMessageRequest
{
    [Required]
    [StringLength(100, MinimumLength = 2)]
    public string SessionId { get; set; } = string.Empty;
    [Required]
    [StringLength(4000, MinimumLength = 1)]
    public string Message { get; set; } = string.Empty;
    [StringLength(16)]
    public string? Locale { get; set; }
    [StringLength(32)]
    public string? Persona { get; set; }
    [StringLength(200)]
    public string? PagePath { get; set; }
    [StringLength(200)]
    public string? PageTitle { get; set; }
    [StringLength(64)]
    public string? Module { get; set; }
    [StringLength(500)]
    public string? ContextSummary { get; set; }
    public Dictionary<string, string>? Metadata { get; set; }
}

public class AssistantChatMessageDto
{
    public string Id { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string[] QuickReplies { get; set; } = Array.Empty<string>();
}
