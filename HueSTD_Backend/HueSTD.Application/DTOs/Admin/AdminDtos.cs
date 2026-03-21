using System.ComponentModel.DataAnnotations;

namespace HueSTD.Application.DTOs.Admin;

public class AdminStatsDto
{
    public int TotalUsers { get; set; }
    public int TotalDocuments { get; set; }
    public int TotalViews { get; set; }
    public int TotalDownloads { get; set; }
    public int ReportsCount { get; set; }
    public List<RecentActivityDto> RecentActivities { get; set; } = new();
}

public class RecentActivityDto
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty; // "user_registered", "document_uploaded", etc.
    public string Description { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string? UserAvatar { get; set; }
    public DateTime Timestamp { get; set; }
}

// User Management DTOs
public class UserListItemDto
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? School { get; set; }
    public string? Major { get; set; }
    public int Points { get; set; }
    public string Role { get; set; } = "user";
    public DateTime CreatedAt { get; set; }
}

public class UserDetailDto
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? School { get; set; }
    public string? Major { get; set; }
    public string? AvatarUrl { get; set; }
    public int Points { get; set; }
    public string? Badge { get; set; }
    public string Role { get; set; } = "user";
    public DateTime CreatedAt { get; set; }
}

public class CreateUserRequest
{
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email format")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required")]
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters")]
    public string Password { get; set; } = string.Empty;

    [StringLength(100, ErrorMessage = "FullName cannot exceed 100 characters")]
    public string? FullName { get; set; }

    [StringLength(200, ErrorMessage = "School cannot exceed 200 characters")]
    public string? School { get; set; }

    [StringLength(100, ErrorMessage = "Major cannot exceed 100 characters")]
    public string? Major { get; set; }

    [RegularExpression("^(user|moderator|admin)$", ErrorMessage = "Role must be user, moderator, or admin")]
    public string Role { get; set; } = "user";
}

public class UpdateUserRequest
{
    [StringLength(100, ErrorMessage = "FullName cannot exceed 100 characters")]
    public string? FullName { get; set; }

    [StringLength(200, ErrorMessage = "School cannot exceed 200 characters")]
    public string? School { get; set; }

    [StringLength(100, ErrorMessage = "Major cannot exceed 100 characters")]
    public string? Major { get; set; }

    [Range(0, int.MaxValue, ErrorMessage = "Points must be a positive number")]
    public int? Points { get; set; }

    [RegularExpression("^(user|moderator|admin)$", ErrorMessage = "Role must be user, moderator, or admin")]
    public string? Role { get; set; }
}

// Document Management DTOs
public class DocumentListItemDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? UploaderName { get; set; }
    public string? School { get; set; }
    public string? Subject { get; set; }
    public string? Type { get; set; }
    public bool IsApproved { get; set; }
    public int Views { get; set; }
    public int Downloads { get; set; }
    public DateTime CreatedAt { get; set; }
}

// Pagination support for document list
public class PaginatedDocumentsResponse
{
    public List<DocumentListItemDto> Documents { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
    public bool HasNextPage => Page < TotalPages;
    public bool HasPreviousPage => Page > 1;
}

public class DocumentDetailDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? FileUrl { get; set; }
    public string UploaderId { get; set; } = string.Empty;
    public string? UploaderName { get; set; }
    public string? School { get; set; }
    public string? Subject { get; set; }
    public string? Type { get; set; }
    public string? Year { get; set; }
    public bool IsApproved { get; set; }
    public int Views { get; set; }
    public int Downloads { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class UpdateDocumentRequest
{
    [StringLength(500, ErrorMessage = "Title cannot exceed 500 characters")]
    public string? Title { get; set; }

    [StringLength(2000, ErrorMessage = "Description cannot exceed 2000 characters")]
    public string? Description { get; set; }

    [StringLength(200, ErrorMessage = "School cannot exceed 200 characters")]
    public string? School { get; set; }

    [StringLength(100, ErrorMessage = "Subject cannot exceed 100 characters")]
    public string? Subject { get; set; }

    [StringLength(50, ErrorMessage = "Type cannot exceed 50 characters")]
    public string? Type { get; set; }

    [StringLength(10, ErrorMessage = "Year cannot exceed 10 characters")]
    public string? Year { get; set; }

    public bool? IsApproved { get; set; }
}

// API Settings DTOs
public class ApiSettingDto
{
    public string KeyName { get; set; } = string.Empty;
    public string KeyValue { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class UpdateApiSettingRequest
{
    [Required(ErrorMessage = "KeyValue is required")]
    public string KeyValue { get; set; } = string.Empty;
}
