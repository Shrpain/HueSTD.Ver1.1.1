using HueSTD.Application.DTOs.Document;
using HueSTD.Application.DTOs.Notification;
using HueSTD.Application.Exceptions;
using HueSTD.Application.Interfaces;
using HueSTD.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;
using Supabase;

namespace HueSTD.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DocumentsController : ApiControllerBase
{
    private readonly IDocumentService _documentService;
    private readonly IConfiguration _configuration;
    private readonly INotificationService _notificationService;
    private readonly Client _supabaseClient;
    private readonly HueSTD.Application.Interfaces.IFileUploadService _fileUploadService;

    public DocumentsController(
        IDocumentService documentService,
        IConfiguration configuration,
        INotificationService notificationService,
        Client supabaseClient,
        HueSTD.Application.Interfaces.IFileUploadService fileUploadService)
    {
        _documentService = documentService;
        _configuration = configuration;
        _notificationService = notificationService;
        _supabaseClient = supabaseClient;
        _fileUploadService = fileUploadService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var documents = await _documentService.GetAllDocumentsAsync();
        return Ok(documents);
    }

    [Authorize]
    [HttpPost("contribute")]
    public async Task<IActionResult> Contribute([FromBody] CreateDocumentRequest request)
    {
        var result = await _documentService.CreateDocumentAsync(CurrentUserId, request);
        if (result == null)
        {
            throw new BadRequestException("Failed to contribute document.");
        }

        var adminProfiles = await _supabaseClient
            .From<Profile>()
            .Where(p => p.Role == "admin")
            .Get();

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

        await _notificationService.CreateNotificationAsync(new CreateNotificationRequest
        {
            UserId = CurrentUserId,
            Title = "Tài liệu đã tải lên",
            Message = $"Tài liệu \"{request.Title}\" đang chờ xét duyệt từ quản trị viên.",
            Type = "document",
            ReferenceId = result.Id
        });

        return Ok(result);
    }

    [Authorize]
    [HttpPost("upload-file")]
    public async Task<IActionResult> UploadFile(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            throw new BadRequestException("No file provided.");
        }

        using var stream = file.OpenReadStream();

        try
        {
            // Use injected FileUploadService to handle storage securely, including magic bytes validation
            var (publicUrl, storedFileName) = await _fileUploadService.UploadAsync(stream, file.FileName, CurrentUserIdValue);
            return Ok(new { fileUrl = publicUrl, fileName = file.FileName });
        }
        catch (InvalidOperationException ex)
        {
            throw new BadRequestException(ex.Message);
        }
    }

    [HttpGet("{id}/comments")]
    public async Task<IActionResult> GetComments(Guid id)
    {
        var list = await _documentService.GetDocumentCommentsAsync(id);
        return Ok(list);
    }

    [Authorize]
    [HttpPost("{id}/comments")]
    public async Task<IActionResult> AddComment(Guid id, [FromBody] CreateDocumentCommentRequest request)
    {
        var created = await _documentService.AddDocumentCommentAsync(id, CurrentUserId, request.Content);
        if (created == null)
        {
            throw new BadRequestException("Không thể thêm bình luận. Tài liệu không tồn tại hoặc chưa được duyệt.");
        }

        return Ok(created);
    }

    [HttpPost("{id}/view")]
    public async Task<IActionResult> IncrementView(Guid id)
    {
        var success = await _documentService.IncrementViewsAsync(id);
        if (!success)
        {
            throw new NotFoundException("Document not found.");
        }

        return Ok(new { message = "View counted." });
    }

    [HttpPost("{id}/download")]
    public async Task<IActionResult> IncrementDownload(Guid id)
    {
        var success = await _documentService.IncrementDownloadsAsync(id);
        if (!success)
        {
            throw new NotFoundException("Document not found.");
        }

        return Ok(new { message = "Download counted." });
    }
}
