using System.Globalization;
using HueSTD.API.Configuration;
using HueSTD.API.Hubs;
using HueSTD.Application;
using Microsoft.AspNetCore.Mvc;
using HueSTD.Infrastructure;

// Force InvariantCulture to prevent decimal parsing errors in non-US locales
CultureInfo.DefaultThreadCurrentCulture = CultureInfo.InvariantCulture;
CultureInfo.DefaultThreadCurrentUICulture = CultureInfo.InvariantCulture;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });
builder.Services.AddProblemDetails(options =>
{
    // Always return a generic error message to avoid leaking internal details or secrets.
    options.CustomizeProblemDetails = context =>
    {
        var genericMessage = "Request failed.";
        context.ProblemDetails.Title = genericMessage;
        context.ProblemDetails.Detail = genericMessage;
        context.ProblemDetails.Extensions["message"] = genericMessage;
        context.ProblemDetails.Extensions["error"] = genericMessage;
        context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
    };
});
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var validationProblem = new ValidationProblemDetails(context.ModelState)
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "Validation Failed",
            Detail = "One or more validation errors occurred."
        };

        validationProblem.Extensions["message"] = validationProblem.Detail;
        validationProblem.Extensions["error"] = validationProblem.Detail;
        validationProblem.Extensions["traceId"] = context.HttpContext.TraceIdentifier;

        return new BadRequestObjectResult(validationProblem);
    };
});
builder.Services.AddSupabaseAuthentication(builder.Configuration);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpClient();
builder.Services.AddSignalR();

// Clean Architecture dependencies
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddFrontendCors(builder.Configuration);

var app = builder.Build();

await app.WarmUpSupabaseAsync();

// Configure the HTTP request pipeline.
app.UseExceptionHandler();

app.UseSwagger();
app.UseSwaggerUI();

// app.UseHttpsRedirection();

app.UseCors(CorsConfigurationExtensions.AllowFrontendPolicy);

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<AssistantHub>("/hubs/assistant");

app.Run();
