using HueSTD.Application;
using HueSTD.Application.Interfaces;
using HueSTD.Infrastructure;
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpClient();

// Clean Architecture Dependencies
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// Context: Enable CORS for Frontend (Vite defaults to port 5173)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            // CORS Configuration - Read from appsettings.json with environment variable fallback
            var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<List<string>>() ?? new List<string>();

            // Add environment variable support for CORS (comma-separated list)
            var envOrigins = Environment.GetEnvironmentVariable("ALLOWED_ORIGINS");
            if (!string.IsNullOrEmpty(envOrigins))
            {
                var envOriginList = envOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries);
                allowedOrigins.AddRange(envOriginList);
            }

            // Also allow localhost for development (always add common ports)
            allowedOrigins.Add("http://localhost:3000");
            allowedOrigins.Add("http://localhost:5173");
            allowedOrigins.Add("https://localhost:3000");
            allowedOrigins.Add("https://localhost:5173");

            policy.SetIsOriginAllowed(origin =>
            {
                // Check if origin is in allowed list
                if (allowedOrigins.Any(allowed => origin.Equals(allowed, StringComparison.OrdinalIgnoreCase)))
                    return true;

                // For development: allow localhost with any port
                if (origin.StartsWith("http://localhost:", StringComparison.OrdinalIgnoreCase) ||
                    origin.StartsWith("https://localhost:", StringComparison.OrdinalIgnoreCase))
                    return true;

                // For production: strict check for specific domains (no wildcards)
                if (origin.Contains(".vercel.app") || origin.Contains("vercel.app"))
                {
                    // Only allow specific production domains - ADD YOUR DOMAIN HERE
                    string[] allowedProductionDomains = {
                        "huestd-frontend.vercel.app"
                    };
                    return allowedProductionDomains.Any(domain => origin.Contains(domain, StringComparison.OrdinalIgnoreCase));
                }

                return false;
            })
            .AllowAnyHeader()
            .AllowAnyMethod();
        });
});

var app = builder.Build();

// Pre-initialize Supabase Client
using (var scope = app.Services.CreateScope())
{
    var supabaseClient = scope.ServiceProvider.GetRequiredService<Supabase.Client>();
    try {
        await supabaseClient.InitializeAsync();
        Console.WriteLine("✅ Supabase Client Initialized Successfully");
    } catch (Exception ex) {
        Console.WriteLine($"❌ Failed to initialize Supabase Client: {ex.Message}");
    }
}

// Configure the HTTP request pipeline.
app.UseSwagger();
app.UseSwaggerUI();

//app.UseHttpsRedirection();

app.UseCors("AllowFrontend");

app.UseAuthorization();
app.MapControllers();

// Global Exception Handler
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        context.Response.StatusCode = 500;
        context.Response.ContentType = "application/json";
        
        var exceptionHandlerPathFeature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerPathFeature>();
        var exception = exceptionHandlerPathFeature?.Error;
        
        var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
        logger.LogError(exception, "Unhandled exception occurred");
        
        await context.Response.WriteAsJsonAsync(new { 
            message = "An error occurred while processing your request.",
            detail = app.Environment.IsDevelopment() ? exception?.Message : null
        });
    });
});

app.Run();
