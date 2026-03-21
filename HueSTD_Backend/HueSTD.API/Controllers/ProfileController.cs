using HueSTD.Application.DTOs.Auth;
using HueSTD.Application.DTOs.Profile;
using HueSTD.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HueSTD.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProfileController : ControllerBase
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
        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
            return Unauthorized(new { message = "Token không hợp lệ" });

        var token = authHeader.Substring("Bearer ".Length);
        var user = await _authService.GetCurrentUserAsync(token);
        if (user == null || string.IsNullOrEmpty(user.Id))
            return Unauthorized(new { message = "Không tìm thấy người dùng" });

        var result = await _profileService.GetUserDocumentsAsync(user.Id, page, pageSize);
        return Ok(result);
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        {
            return Unauthorized(new { message = "Token không hợp lệ" });
        }

        var token = authHeader.Substring("Bearer ".Length);
        var user = await _authService.GetCurrentUserAsync(token);
        
        if (user == null)
        {
            return Unauthorized(new { message = "Không tìm thấy người dùng" });
        }

        return Ok(user);
    }

    [HttpPut("update")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        {
            return Unauthorized(new { message = "Token không hợp lệ" });
        }

        var token = authHeader.Substring("Bearer ".Length);
        var user = await _authService.GetCurrentUserAsync(token);
        
        if (user == null || string.IsNullOrEmpty(user.Id))
        {
            return Unauthorized(new { message = "Không tìm thấy người dùng" });
        }

        var success = await _authService.UpdateProfileAsync(user.Id, request);
        
        if (!success)
        {
            return BadRequest(new { message = "Cập nhật thất bại" });
        }

        // Return updated user data
        var updatedUser = await _authService.GetCurrentUserAsync(token);
        return Ok(new { message = "Cập nhật thành công", user = updatedUser });
    }

    [HttpPost("upload-avatar")]
    public async Task<IActionResult> UploadAvatar(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "Vui lòng chọn file ảnh" });
        }

        // Validate file type
        var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
        {
            return BadRequest(new { message = "Chỉ chấp nhận file ảnh (JPEG, PNG, GIF, WebP)" });
        }

        // Max 5MB
        if (file.Length > 5 * 1024 * 1024)
        {
            return BadRequest(new { message = "File quá lớn. Tối đa 5MB" });
        }

        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
        {
            return Unauthorized(new { message = "Token không hợp lệ" });
        }

        var token = authHeader.Substring("Bearer ".Length);
        var user = await _authService.GetCurrentUserAsync(token);
        
        if (user == null || string.IsNullOrEmpty(user.Id))
        {
            return Unauthorized(new { message = "Không tìm thấy người dùng" });
        }

        try
        {
            var supabaseUrl = _configuration["Supabase:Url"] ?? Environment.GetEnvironmentVariable("SUPABASE_URL");
            var supabaseKey = _configuration["Supabase:Key"] ?? Environment.GetEnvironmentVariable("SUPABASE_KEY");

            // Generate unique filename
            var fileExt = Path.GetExtension(file.FileName);
            var fileName = $"{user.Id}/avatar_{DateTime.UtcNow.Ticks}{fileExt}";

            // Upload to Supabase Storage
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
                var errorBody = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"[ERROR] Upload failed: {errorBody}");
                return BadRequest(new { message = "Upload thất bại" });
            }

            // Construct public URL
            var publicUrl = $"{supabaseUrl}/storage/v1/object/public/avatars/{fileName}";

            // Update user profile with new avatar URL
            await _authService.UpdateProfileAsync(user.Id, new UpdateProfileRequest { AvatarUrl = publicUrl });

            // Return updated user
            var updatedUser = await _authService.GetCurrentUserAsync(token);
            return Ok(new { message = "Upload thành công", avatarUrl = publicUrl, user = updatedUser });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] Upload exception: {ex.Message}");
            return BadRequest(new { message = "Upload thất bại: " + ex.Message });
        }
    }
}
