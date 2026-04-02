using Microsoft.AspNetCore.Mvc;

namespace HueSTD.API.Configuration;

public static class ProblemDetailsResponseWriter
{
    public static async Task WriteAsync(HttpContext httpContext, int statusCode, string title, string detail)
    {
        httpContext.Response.StatusCode = statusCode;

        var problemDetailsService = httpContext.RequestServices.GetRequiredService<IProblemDetailsService>();
        await problemDetailsService.WriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = new ProblemDetails
            {
                Status = statusCode,
                Title = title,
                Detail = detail
            }
        });
    }
}
