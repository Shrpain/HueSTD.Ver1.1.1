using HueSTD.Application.DTOs.Auth;
using HueSTD.Application.Exceptions;
using HueSTD.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HueSTD.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ProfileController : ApiControllerBase
{
    private readonly IAuthService _authService;
    private readonly IConfiguration _configuration;
    private readonly IProfileService _profileService;

    public ProfileController(IAuthService authService, IConfiguration configuration, IProfileService profileService)
    {
        _authService = authService;
        _configuration = configuration;
        _profileService = profileService;
    }

    [HttpGet("my-documents")]
    public async Task<IActionResult> GetMyDocuments([FromQuery] int page = 1, [FromQuery] int pageSize = 3)
    {
        var result = await _profileService.GetUserDocumentsAsync(CurrentUserIdValue, page, pageSize);
        return Ok(result);
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var user = await _authService.GetCurrentUserAsync(CurrentUserIdValue, CurrentUserEmail);
        if (user == null)
        {
            throw new UnauthorizedException("Không tìm thấy người dùng.");
        }

        return Ok(user);
    }

    [HttpPut("update")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var success = await _authService.UpdateProfileAsync(CurrentUserIdValue, request);
        if (!success)
        {
            throw new BadRequestException("Cập nhật thất bại.");
        }

        var updatedUser = await _authService.GetCurrentUserAsync(CurrentUserIdValue, CurrentUserEmail);
        return Ok(new { message = "Cập nhật thành công", user = updatedUser });
    }

    [HttpPost("upload-avatar")]
    public async Task<IActionResult> UploadAvatar(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            throw new BadRequestException("Vui lòng chọn file ảnh.");
        }

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
        if (!allowedTypes.Contains(file.ContentType.ToLowerInvariant()))
        {
            throw new BadRequestException("Chỉ chấp nhận file ảnh (JPEG, PNG, GIF, WebP).");
        }

        if (file.Length > 5 * 1024 * 1024)
        {
            throw new BadRequestException("File quá lớn. Tối đa 5MB.");
        }

        var supabaseUrl = _configuration["Supabase:Url"] ?? Environment.GetEnvironmentVariable("SUPABASE_URL");
        var supabaseKey = _configuration["Supabase:Key"] ?? Environment.GetEnvironmentVariable("SUPABASE_KEY");

        var fileExt = Path.GetExtension(file.FileName);
        var fileName = $"{CurrentUserIdValue}/avatar_{DateTime.UtcNow.Ticks}{fileExt}";

        using var httpClient = new HttpClient();
        httpClient.DefaultRequestHeaders.Add("apikey", supabaseKey);
        httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {supabaseKey}");

        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream);
        var fileBytes = memoryStream.ToArray();

        var uploadUrl = $"{supabaseUrl}/storage/v1/object/avatars/{fileName}";
        var content = new ByteArrayContent(fileBytes);
        content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(file.ContentType);

        var response = await httpClient.PostAsync(uploadUrl, content);
        if (!response.IsSuccessStatusCode)
        {
            throw new BadRequestException("Upload thất bại.");
        }

        var publicUrl = $"{supabaseUrl}/storage/v1/object/public/avatars/{fileName}";
        await _authService.UpdateProfileAsync(CurrentUserIdValue, new UpdateProfileRequest { AvatarUrl = publicUrl });

        var updatedUser = await _authService.GetCurrentUserAsync(CurrentUserIdValue, CurrentUserEmail);
        return Ok(new { message = "Upload thành công", avatarUrl = publicUrl, user = updatedUser });
    }
}
