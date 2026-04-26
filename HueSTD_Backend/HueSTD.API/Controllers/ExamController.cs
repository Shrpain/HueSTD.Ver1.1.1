using HueSTD.Application.DTOs.Exam;
using HueSTD.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace HueSTD.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ExamController : ControllerBase
{
    private readonly IExamService _examService;

    public ExamController(IExamService examService)
    {
        _examService = examService;
    }

    [HttpGet("my-exams")]
    public async Task<IActionResult> GetMyExams()
    {
        var userId = GetUserId();
        var result = await _examService.GetMyExamsAsync(userId);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetExam(Guid id)
    {
        var userId = GetUserId();
        var result = await _examService.GetExamByIdAsync(id, userId);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpPost("manual")]
    public async Task<IActionResult> CreateManual([FromBody] ExamDto examDto)
    {
        var userId = GetUserId();
        var result = await _examService.CreateManualExamAsync(examDto, userId);
        return Ok(result);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateManual(Guid id, [FromBody] ExamDto examDto)
    {
        var userId = GetUserId();
        var result = await _examService.UpdateManualExamAsync(id, examDto, userId);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = GetUserId();
        var success = await _examService.DeleteExamAsync(id, userId);
        if (!success) return NotFound();
        return Ok(new { message = "Xóa đề thi thành công" });
    }

    private Guid GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                          ?? User.FindFirst("sub")?.Value;
        return Guid.Parse(userIdClaim!);
    }
}
