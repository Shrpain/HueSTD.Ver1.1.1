using Microsoft.AspNetCore.Mvc;

namespace HueSTD.API.Controllers;

/// <summary>
/// Cấu hình công khai (Supabase URL, Anon Key) để MCP hoặc client lấy từ backend thay vì hardcode.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ConfigController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public ConfigController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [HttpGet("supabase")]
    public IActionResult GetSupabaseConfig()
    {
        var url = _configuration["Supabase:Url"] ?? Environment.GetEnvironmentVariable("SUPABASE_URL");
        var anonKey = _configuration["Supabase:AnonKey"] ?? Environment.GetEnvironmentVariable("SUPABASE_ANON_KEY");

        if (string.IsNullOrEmpty(url))
            return NotFound(new { message = "Supabase URL not configured." });

        return Ok(new
        {
            url,
            anonKey = anonKey ?? string.Empty
        });
    }
}
