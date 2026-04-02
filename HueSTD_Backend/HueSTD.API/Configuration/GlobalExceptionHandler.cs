using HueSTD.Application.Exceptions;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace HueSTD.API.Configuration;

public sealed class GlobalExceptionHandler(
    IProblemDetailsService problemDetailsService,
    ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        logger.LogError(exception, "Unhandled exception occurred");

        var (statusCode, title, detail) = MapException(exception);
        httpContext.Response.StatusCode = statusCode;

        await problemDetailsService.WriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = new ProblemDetails
            {
                Status = statusCode,
                Title = title,
                Detail = detail
            },
            Exception = exception
        });

        return true;
    }

    private static (int StatusCode, string Title, string Detail) MapException(Exception exception)
    {
        return exception switch
        {
            AppException appException => (appException.StatusCode, appException.Title, appException.Detail),
            UnauthorizedAccessException ex => (StatusCodes.Status401Unauthorized, "Unauthorized", ex.Message),
            ArgumentException ex => (StatusCodes.Status400BadRequest, "Bad Request", ex.Message),
            KeyNotFoundException ex => (StatusCodes.Status404NotFound, "Not Found", ex.Message),
            _ => (StatusCodes.Status500InternalServerError, "Internal Server Error", "An unexpected error occurred while processing the request.")
        };
    }
}
