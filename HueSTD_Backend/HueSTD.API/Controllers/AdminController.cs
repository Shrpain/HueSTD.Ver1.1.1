using HueSTD.Application.DTOs.Notification;
using HueSTD.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HueSTD.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AdminController : ControllerBase
{
    private readonly IAdminService _adminService;
    private readonly INotificationService _notificationService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AdminController> _logger;

    public AdminController(
        IAdminService adminService,
        INotificationService notificationService,
        IConfiguration configuration,
        ILogger<AdminController> logger)
    {
        _adminService = adminService;
        _notificationService = notificationService;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Helper method to check if current user is admin
    /// </summary>
    private async Task<bool> IsCurrentUserAdmin()
    {
        var authHeader = Request.Headers["Authorization"].ToString();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
            return false;

        var token = authHeader.Substring("Bearer ".Length).Trim();

        using var scope = HttpContext.RequestServices.CreateScope();
        var authService = scope.ServiceProvider.GetRequiredService<IAuthService>();
        var user = await authService.GetCurrentUserAsync(token);

        return user?.Role == "admin";
    }

    /// <summary>
    /// Require admin role for all actions
    /// </summary>
    private async Task<IActionResult> RequireAdmin()
    {
        if (!await IsCurrentUserAdmin())
        {
            return Forbid();
        }
        return Ok();
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var adminCheck = await RequireAdmin();
        if (adminCheck is ForbidResult) return adminCheck;

        try
        {
            var stats = await _adminService.GetDashboardStatsAsync();
            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminController] Error getting stats");
            return StatusCode(500, new { error = "Failed to get statistics. Please try again." });
        }
    }

    // ===== USER MANAGEMENT =====
    [HttpGet("users")]
    public async Task<IActionResult> GetAllUsers([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var adminCheck = await RequireAdmin();
        if (adminCheck is ForbidResult) return adminCheck;

        try
        {
            var users = await _adminService.GetAllUsersAsync();
            var totalCount = users.Count;
            var paginatedUsers = users.Skip((page - 1) * pageSize).Take(pageSize).ToList();
            return Ok(new { data = paginatedUsers, totalCount, page, pageSize });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminController] Error getting users");
            return StatusCode(500, new { error = "Failed to get users. Please try again." });
        }
    }

    [HttpGet("users/{id}")]
    public async Task<IActionResult> GetUserById(string id)
    {
        var adminCheck = await RequireAdmin();
        if (adminCheck is ForbidResult) return adminCheck;

        try
        {
            var user = await _adminService.GetUserByIdAsync(id);
            if (user == null) return NotFound(new { error = "User not found" });
            return Ok(user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminController] Error getting user {UserId}", id);
            return StatusCode(500, new { error = "Failed to get user. Please try again." });
        }
    }

    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] HueSTD.Application.DTOs.Admin.CreateUserRequest request)
    {
        var adminCheck = await RequireAdmin();
        if (adminCheck is ForbidResult) return adminCheck;

        try
        {
            var user = await _adminService.CreateUserAsync(request);
            return CreatedAtAction(nameof(GetUserById), new { id = user.Id }, user);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminController] Error creating user");
            return StatusCode(500, new { error = "Failed to create user. Please try again." });
        }
    }

    [HttpPut("users/{id}")]
    public async Task<IActionResult> UpdateUser(string id, [FromBody] HueSTD.Application.DTOs.Admin.UpdateUserRequest request)
    {
        var adminCheck = await RequireAdmin();
        if (adminCheck is ForbidResult) return adminCheck;

        try
        {
            var user = await _adminService.UpdateUserAsync(id, request);
            if (user == null) return NotFound(new { error = "User not found" });
            return Ok(user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminController] Error updating user {UserId}", id);
            return StatusCode(500, new { error = "Failed to update user. Please try again." });
        }
    }

    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(string id)
    {
        var adminCheck = await RequireAdmin();
        if (adminCheck is ForbidResult) return adminCheck;

        try
        {
            var success = await _adminService.DeleteUserAsync(id);
            if (!success) return NotFound(new { error = "User not found or delete failed" });
            return Ok(new { message = "User deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminController] Error deleting user {UserId}", id);
            return StatusCode(500, new { error = "Failed to delete user. Please try again." });
        }
    }

    // ===== DOCUMENT MANAGEMENT =====
    [HttpGet("documents")]
    public async Task<IActionResult> GetAllDocuments(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] bool? isApproved = null,
        [FromQuery] string? search = null,
        [FromQuery] string? documentType = null,
        [FromQuery] string? school = null)
    {
        var adminCheck = await RequireAdmin();
        if (adminCheck is ForbidResult) return adminCheck;

        try
        {
            var result = await _adminService.GetDocumentsPaginatedAsync(page, pageSize, isApproved, search, documentType, school);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminController] Error getting documents");
            return StatusCode(500, new { error = "Failed to get documents. Please try again." });
        }
    }

    [HttpGet("documents/{id}")]
    public async Task<IActionResult> GetDocument(string id)
    {
        var adminCheck = await RequireAdmin();
        if (adminCheck is ForbidResult) return adminCheck;

        try
        {
            var document = await _adminService.GetDocumentByIdAsync(id);
            if (document == null) return NotFound(new { error = "Document not found" });
            return Ok(document);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminController] Error getting document {DocumentId}", id);
            return StatusCode(500, new { error = "Failed to get document. Please try again." });
        }
    }

    [HttpPut("documents/{id}")]
    public async Task<IActionResult> UpdateDocument(string id, [FromBody] HueSTD.Application.DTOs.Admin.UpdateDocumentRequest request)
    {
        var adminCheck = await RequireAdmin();
        if (adminCheck is ForbidResult) return adminCheck;

        try
        {
            var document = await _adminService.UpdateDocumentAsync(id, request);
            if (document == null) return NotFound(new { error = "Document not found" });
            return Ok(document);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminController] Error updating document {DocumentId}", id);
            return StatusCode(500, new { error = "Failed to update document. Please try again." });
        }
    }

    [HttpPut("documents/{id}/approve")]
    public async Task<IActionResult> ApproveDocument(string id)
    {
        var adminCheck = await RequireAdmin();
        if (adminCheck is ForbidResult) return adminCheck;

        try
        {
            var result = await _adminService.ApproveDocumentAsync(id);
            if (!result) return NotFound(new { error = "Document not found" });
            return Ok(new { message = "Document approved successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminController] Error approving document {DocumentId}", id);
            return StatusCode(500, new { error = "Failed to approve document. Please try again." });
        }
    }

    [HttpPut("documents/{id}/reject")]
    public async Task<IActionResult> RejectDocument(string id)
    {
        var adminCheck = await RequireAdmin();
        if (adminCheck is ForbidResult) return adminCheck;

        try
        {
            var result = await _adminService.RejectDocumentAsync(id);
            if (!result) return NotFound(new { error = "Document not found" });
            return Ok(new { message = "Document rejected successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminController] Error rejecting document {DocumentId}", id);
            return StatusCode(500, new { error = "Failed to reject document. Please try again." });
        }
    }

    [HttpDelete("documents/{id}")]
    public async Task<IActionResult> DeleteDocument(string id)
    {
        var adminCheck = await RequireAdmin();
        if (adminCheck is ForbidResult) return adminCheck;

        try
        {
            var result = await _adminService.DeleteDocumentAsync(id);
            if (!result) return NotFound(new { error = "Document not found" });
            return Ok(new { message = "Document deleted successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminController] Error deleting document {DocumentId}", id);
            return StatusCode(500, new { error = "Failed to delete document. Please try again." });
        }
    }

    // ===== API SETTINGS MANAGEMENT =====
    [HttpGet("settings/{keyName}")]
    public async Task<IActionResult> GetApiSetting(string keyName)
    {
        var adminCheck = await RequireAdmin();
        if (adminCheck is ForbidResult) return adminCheck;

        try
        {
            var setting = await _adminService.GetApiSettingAsync(keyName);
            if (setting == null) return NotFound(new { error = "Setting not found" });
            return Ok(setting);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminController] Error getting API setting {KeyName}", keyName);
            return StatusCode(500, new { error = "Failed to get setting. Please try again." });
        }
    }

    [HttpPut("settings/{keyName}")]
    public async Task<IActionResult> UpdateApiSetting(string keyName, [FromBody] HueSTD.Application.DTOs.Admin.UpdateApiSettingRequest request)
    {
        var adminCheck = await RequireAdmin();
        if (adminCheck is ForbidResult) return adminCheck;

        try
        {
            var result = await _adminService.UpdateApiSettingAsync(keyName, request);
            if (!result) return StatusCode(500, new { error = "Failed to update setting" });
            return Ok(new { message = "Setting updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminController] Error updating API setting {KeyName}", keyName);
            return StatusCode(500, new { error = "Failed to update setting. Please try again." });
        }
    }
}
