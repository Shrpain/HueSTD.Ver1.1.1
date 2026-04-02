using System.ComponentModel.DataAnnotations;

namespace HueSTD.Application.DTOs.Document;

public class DocumentDto
{
    public Guid Id { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? FileUrl { get; set; }
    public Guid UploaderId { get; set; }
    public string? UploaderName { get; set; }
    public string? UploaderPublicId { get; set; }
    public string? UploaderAvatar { get; set; }
    public string? School { get; set; }
    public string? Subject { get; set; }
    public string? Type { get; set; }
    public string? Year { get; set; }
    public int Views { get; set; }
    public int Downloads { get; set; }
    public string? Status { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class DocumentQueryRequest
{
    public string? Query { get; set; }
    public string? School { get; set; }
    public string? Subject { get; set; }
    public string? Type { get; set; }
    public string? Year { get; set; }
    public string SortBy { get; set; } = "relevance";
    public int Limit { get; set; } = 5;
}

public class DocumentQueryResultDto
{
    public int TotalCount { get; set; }
    public List<DocumentDto> Documents { get; set; } = new();
}


public class CreateDocumentRequest
{
    [Required(ErrorMessage = "Title is required")]
    [StringLength(500, ErrorMessage = "Title cannot exceed 500 characters")]
    public required string Title { get; set; }

    [StringLength(2000, ErrorMessage = "Description cannot exceed 2000 characters")]
    public string? Description { get; set; }

    [Required(ErrorMessage = "FileUrl is required")]
    [Url(ErrorMessage = "Invalid file URL format")]
    public required string FileUrl { get; set; }

    [StringLength(200, ErrorMessage = "School cannot exceed 200 characters")]
    public string? School { get; set; }

    [StringLength(100, ErrorMessage = "Subject cannot exceed 100 characters")]
    public string? Subject { get; set; }

    [StringLength(50, ErrorMessage = "Type cannot exceed 50 characters")]
    public string? Type { get; set; }

    [StringLength(10, ErrorMessage = "Year cannot exceed 10 characters")]
    public string? Year { get; set; }
}

public class DocumentCommentDto
{
    public Guid Id { get; set; }
    public Guid DocumentId { get; set; }
    public Guid UserId { get; set; }
    public string AuthorName { get; set; } = string.Empty;
    public string? AuthorAvatar { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class CreateDocumentCommentRequest
{
    [Required(ErrorMessage = "Nội dung bình luận là bắt buộc")]
    [StringLength(2000, MinimumLength = 1, ErrorMessage = "Bình luận từ 1 đến 2000 ký tự")]
    public required string Content { get; set; }
}
