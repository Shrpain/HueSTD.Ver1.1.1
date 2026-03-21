using HueSTD.Application.DTOs.Document;
using HueSTD.Application.DTOs.Notification;
using HueSTD.Application.Interfaces;
using HueSTD.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Supabase;

namespace HueSTD.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DocumentsController : ControllerBase
{
    private readonly IDocumentService _documentService;
    private readonly IAuthService _authService;
    private readonly IConfiguration _configuration;
    private readonly INotificationService _notificationService;
    private readonly Client _supabaseClient;

    public DocumentsController(IDocumentService documentService, IAuthService authService, IConfiguration configuration, INotificationService notificationService, Client supabaseClient)
    {
        _documentService = documentService;
        _authService = authService;
        _configuration = configuration;
        _notificationService = notificationService;
        _supabaseClient = supabaseClient;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var documents = await _documentService.GetAllDocumentsAsync();
        return Ok(documents);
    }

    [HttpPost("contribute")]
    public async Task<IActionResult> Contribute([FromBody] CreateDocumentRequest request)
    {
        var authHeader = Request.Headers["Authorization"].ToString();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        {
            return Unauthorized(new { message = "No token provided." });
        }

        var token = authHeader.Substring("Bearer ".Length).Trim();
        var user = await _authService.GetCurrentUserAsync(token);

        if (user == null || string.IsNullOrEmpty(user.Id))
        {
            return Unauthorized(new { message = "Invalid or expired token." });
        }

        if (!Guid.TryParse(user.Id, out var userGuid))
        {
            return BadRequest(new { message = "Invalid user ID format." });
        }

        var result = await _documentService.CreateDocumentAsync(userGuid, request);
        if (result == null)
        {
            return BadRequest(new { message = "Failed to contribute document." });
        }

        // Create notification for ADMIN (notifying about new document pending approval)
        // First, get admin users
        var adminProfiles = await _supabaseClient
            .From<Profile>()
            .Where(p => p.Role == "admin")
            .Get();

        if (adminProfiles.Models.Count > 0)
        {
            foreach (var admin in adminProfiles.Models)
            {
                await _notificationService.CreateNotificationAsync(new CreateNotificationRequest
                {
                    UserId = admin.Id,
                    Title = "Tài liệu mới cần duyệt",
                    Message = $"Người dùng đã tải lên tài liệu \"{request.Title}\" và đang chờ xét duyệt.",
                    Type = "document",
                    ReferenceId = result.Id
                });
            }
        }

        // Also notify user that their document is pending approval
        await _notificationService.CreateNotificationAsync(new CreateNotificationRequest
        {
            UserId = userGuid,
            Title = "Tài liệu đã tải lên",
            Message = $"Tài liệu \"{request.Title}\" đang chờ xét duyệt từ quản trị viên.",
            Type = "document",
            ReferenceId = result.Id
        });

        return Ok(result);
    }

    /// <summary>
    /// Upload file tài liệu lên Supabase Storage và trả về URL
    /// </summary>
    [HttpPost("upload-file")]
    public async Task<IActionResult> UploadFile(IFormFile file)
    {
        var authHeader = Request.Headers["Authorization"].ToString();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        {
            return Unauthorized(new { message = "No token provided." });
        }

        var token = authHeader.Substring("Bearer ".Length).Trim();
        var user = await _authService.GetCurrentUserAsync(token);

        if (user == null || string.IsNullOrEmpty(user.Id))
        {
            return Unauthorized(new { message = "Invalid or expired token." });
        }

        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "No file provided." });
        }

        // Validate file type
        var allowedExtensions = new[] { ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".txt" };
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(ext))
        {
            return BadRequest(new { message = "File type not allowed. Allowed: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT" });
        }

        // Max 50MB
        if (file.Length > 50 * 1024 * 1024)
        {
            return BadRequest(new { message = "File size exceeds 50MB limit." });
        }

        try
        {
            var supabaseUrl = _configuration["Supabase:Url"] ?? Environment.GetEnvironmentVariable("SUPABASE_URL");
            var supabaseKey = _configuration["Supabase:ServiceRoleKey"] ?? _configuration["Supabase:Key"] ?? Environment.GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY") ?? Environment.GetEnvironmentVariable("SUPABASE_KEY");

            // Generate unique file name
            var fileName = $"{Guid.NewGuid()}{ext}";
            var filePath = $"documents/{user.Id}/{fileName}";

            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream);
            var fileBytes = memoryStream.ToArray();

            // Upload to Supabase Storage via REST API
            using var httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {supabaseKey}");
            httpClient.DefaultRequestHeaders.Add("apikey", supabaseKey);

            var content = new ByteArrayContent(fileBytes);
            content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(file.ContentType ?? "application/octet-stream");

            var uploadUrl = $"{supabaseUrl}/storage/v1/object/documents/{filePath}";
            var response = await httpClient.PostAsync(uploadUrl, content);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                return StatusCode(500, new { message = "Failed to upload file to storage.", error = errorContent });
            }

            // Build public URL
            var publicUrl = $"{supabaseUrl}/storage/v1/object/public/documents/{filePath}";

            return Ok(new { fileUrl = publicUrl, fileName = file.FileName });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Upload failed.", error = ex.Message });
        }
    }

    /// <summary>
    /// Danh sách bình luận theo tài liệu (chỉ tài liệu đã duyệt)
    /// </summary>
    [HttpGet("{id}/comments")]
    public async Task<IActionResult> GetComments(Guid id)
    {
        var list = await _documentService.GetDocumentCommentsAsync(id);
        return Ok(list);
    }

    /// <summary>
    /// Thêm bình luận (cần đăng nhập)
    /// </summary>
    [HttpPost("{id}/comments")]
    public async Task<IActionResult> AddComment(Guid id, [FromBody] CreateDocumentCommentRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var authHeader = Request.Headers["Authorization"].ToString();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập để bình luận." });
        }

        var token = authHeader.Substring("Bearer ".Length).Trim();
        var user = await _authService.GetCurrentUserAsync(token);

        if (user == null || string.IsNullOrEmpty(user.Id))
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ." });
        }

        if (!Guid.TryParse(user.Id, out var userGuid))
        {
            return BadRequest(new { message = "Invalid user ID format." });
        }

        var created = await _documentService.AddDocumentCommentAsync(id, userGuid, request.Content);
        if (created == null)
        {
            return BadRequest(new { message = "Không thể thêm bình luận. Tài liệu không tồn tại hoặc chưa được duyệt." });
        }

        return Ok(created);
    }

    /// <summary>
    /// Tăng lượt xem cho tài liệu
    /// </summary>
    [HttpPost("{id}/view")]
    public async Task<IActionResult> IncrementView(Guid id)
    {
        var success = await _documentService.IncrementViewsAsync(id);
        if (!success)
        {
            return NotFound(new { message = "Document not found." });
        }
        return Ok(new { message = "View counted." });
    }

    /// <summary>
    /// Tăng lượt tải về cho tài liệu
    /// </summary>
    [HttpPost("{id}/download")]
    public async Task<IActionResult> IncrementDownload(Guid id)
    {
        var success = await _documentService.IncrementDownloadsAsync(id);
        if (!success)
        {
            return NotFound(new { message = "Document not found." });
        }
        return Ok(new { message = "Download counted." });
    }
}
