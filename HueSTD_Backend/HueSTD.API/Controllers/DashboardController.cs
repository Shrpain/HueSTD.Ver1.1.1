using HueSTD.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HueSTD.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;

    public DashboardController(IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var stats = await _dashboardService.GetGlobalStatsAsync();
        return Ok(stats);
    }

    /// <summary>
    /// Track a page view. Called client-side on every HueSTD page load.
    /// </summary>
    [HttpPost("track-view")]
    public async Task<IActionResult> TrackView([FromQuery] string? pagePath = "/")
    {
        var ipHash = Request.Headers.TryGetValue("X-Forwarded-For", out var fwd)
            ? Convert.ToBase64String(
                System.Security.Cryptography.SHA256.HashData(
                    System.Text.Encoding.UTF8.GetBytes(fwd.ToString())))
            : null;
        var userAgent = Request.Headers.UserAgent.ToString();
        await _dashboardService.TrackPageViewAsync(pagePath, ipHash, userAgent);
        return Ok(new { tracked = true });
    }

    [HttpGet("hot-documents")]
    public async Task<IActionResult> GetHotDocuments()
    {
        var hotDocs = await _dashboardService.GetWeeklyHotDocumentsAsync();
        return Ok(hotDocs);
    }

    [HttpGet("rankings")]
    public async Task<IActionResult> GetRankings([FromQuery] int limit = 10)
    {
        var rankings = await _dashboardService.GetUserRankingsAsync(limit);
        return Ok(rankings);
    }
}
