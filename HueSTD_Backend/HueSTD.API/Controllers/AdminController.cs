using HueSTD.API.Auth;
using HueSTD.Application.DTOs.Admin;
using HueSTD.Application.Exceptions;
using HueSTD.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HueSTD.API.Controllers;

[Authorize(Policy = AppPolicies.Admin)]
[ApiController]
[Route("api/[controller]")]
public class AdminController : ApiControllerBase
{
    private readonly IAdminService _adminService;

    public AdminController(IAdminService adminService)
    {
        _adminService = adminService;
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var stats = await _adminService.GetDashboardStatsAsync();
        return Ok(stats);
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetAllUsers([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var users = await _adminService.GetAllUsersAsync();
        var totalCount = users.Count;
        var paginatedUsers = users.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        return Ok(new { data = paginatedUsers, totalCount, page, pageSize });
    }

    [HttpGet("users/{id}")]
    public async Task<IActionResult> GetUserById(string id)
    {
        var user = await _adminService.GetUserByIdAsync(id);
        if (user == null)
        {
            throw new NotFoundException("User not found.");
        }

        return Ok(user);
    }

    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        var user = await _adminService.CreateUserAsync(request);
        return CreatedAtAction(nameof(GetUserById), new { id = user.Id }, user);
    }

    [HttpPut("users/{id}")]
    public async Task<IActionResult> UpdateUser(string id, [FromBody] UpdateUserRequest request)
    {
        var user = await _adminService.UpdateUserAsync(id, request);
        if (user == null)
        {
            throw new NotFoundException("User not found.");
        }

        return Ok(user);
    }

    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(string id)
    {
        var success = await _adminService.DeleteUserAsync(id);
        if (!success)
        {
            throw new NotFoundException("User not found or delete failed.");
        }

        return Ok(new { message = "User deleted successfully" });
    }

    [HttpGet("documents")]
    public async Task<IActionResult> GetAllDocuments(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] bool? isApproved = null,
        [FromQuery] string? search = null,
        [FromQuery] string? documentType = null,
        [FromQuery] string? school = null)
    {
        var result = await _adminService.GetDocumentsPaginatedAsync(page, pageSize, isApproved, search, documentType, school);
        return Ok(result);
    }

    [HttpGet("documents/{id}")]
    public async Task<IActionResult> GetDocument(string id)
    {
        var document = await _adminService.GetDocumentByIdAsync(id);
        if (document == null)
        {
            throw new NotFoundException("Document not found.");
        }

        return Ok(document);
    }

    [HttpPut("documents/{id}")]
    public async Task<IActionResult> UpdateDocument(string id, [FromBody] UpdateDocumentRequest request)
    {
        var document = await _adminService.UpdateDocumentAsync(id, request);
        if (document == null)
        {
            throw new NotFoundException("Document not found.");
        }

        return Ok(document);
    }

    [HttpPut("documents/{id}/approve")]
    public async Task<IActionResult> ApproveDocument(string id)
    {
        var success = await _adminService.ApproveDocumentAsync(id);
        if (!success)
        {
            throw new NotFoundException("Document not found.");
        }

        return Ok(new { message = "Document approved successfully" });
    }

    [HttpPut("documents/{id}/reject")]
    public async Task<IActionResult> RejectDocument(string id)
    {
        var success = await _adminService.RejectDocumentAsync(id);
        if (!success)
        {
            throw new NotFoundException("Document not found.");
        }

        return Ok(new { message = "Document rejected successfully" });
    }

    [HttpDelete("documents/{id}")]
    public async Task<IActionResult> DeleteDocument(string id)
    {
        var success = await _adminService.DeleteDocumentAsync(id);
        if (!success)
        {
            throw new NotFoundException("Document not found.");
        }

        return Ok(new { message = "Document deleted successfully" });
    }

    [HttpGet("settings/{keyName}")]
    public async Task<IActionResult> GetApiSetting(string keyName)
    {
        var setting = await _adminService.GetApiSettingAsync(keyName);
        if (setting == null)
        {
            throw new NotFoundException("Setting not found.");
        }

        return Ok(setting);
    }

    [HttpPut("settings/{keyName}")]
    public async Task<IActionResult> UpdateApiSetting(string keyName, [FromBody] UpdateApiSettingRequest request)
    {
        var updated = await _adminService.UpdateApiSettingAsync(keyName, request);
        if (!updated)
        {
            throw new BadRequestException("Failed to update setting.");
        }

        return Ok(new { message = "Setting updated successfully" });
    }
}
