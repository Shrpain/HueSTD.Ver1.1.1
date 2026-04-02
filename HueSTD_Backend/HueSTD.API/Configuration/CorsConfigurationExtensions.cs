using Microsoft.Extensions.Configuration;

namespace HueSTD.API.Configuration;

public static class CorsConfigurationExtensions
{
    public const string AllowFrontendPolicy = "AllowFrontend";

    private static readonly string[] DefaultDevelopmentOrigins =
    {
        "http://localhost:3000",
        "http://localhost:5173",
        "https://localhost:3000",
        "https://localhost:5173"
    };

    private static readonly string[] AllowedProductionDomains =
    {
        "huestd-frontend.vercel.app"
    };

    public static IServiceCollection AddFrontendCors(this IServiceCollection services, IConfiguration configuration)
    {
        var allowedOrigins = BuildAllowedOrigins(configuration);

        services.AddCors(options =>
        {
            options.AddPolicy(AllowFrontendPolicy, policy =>
            {
                policy.SetIsOriginAllowed(origin => IsAllowedOrigin(origin, allowedOrigins))
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            });
        });

        return services;
    }

    private static HashSet<string> BuildAllowedOrigins(IConfiguration configuration)
    {
        var allowedOrigins = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        AddOrigins(allowedOrigins, configuration.GetSection("AllowedOrigins").Get<string[]>());
        AddOrigins(allowedOrigins, SplitOrigins(configuration["AllowedOrigins"]));
        AddOrigins(allowedOrigins, SplitOrigins(Environment.GetEnvironmentVariable("ALLOWED_ORIGINS")));
        AddOrigins(allowedOrigins, DefaultDevelopmentOrigins);

        return allowedOrigins;
    }

    private static bool IsAllowedOrigin(string origin, HashSet<string> allowedOrigins)
    {
        if (allowedOrigins.Contains(origin))
        {
            return true;
        }

        if (origin.StartsWith("http://localhost:", StringComparison.OrdinalIgnoreCase) ||
            origin.StartsWith("https://localhost:", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (origin.Contains(".vercel.app", StringComparison.OrdinalIgnoreCase) ||
            origin.Contains("vercel.app", StringComparison.OrdinalIgnoreCase))
        {
            return AllowedProductionDomains.Any(domain => origin.Contains(domain, StringComparison.OrdinalIgnoreCase));
        }

        return false;
    }

    private static IEnumerable<string> SplitOrigins(string? rawOrigins)
    {
        if (string.IsNullOrWhiteSpace(rawOrigins))
        {
            return Array.Empty<string>();
        }

        return rawOrigins
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(origin => !string.IsNullOrWhiteSpace(origin));
    }

    private static void AddOrigins(ISet<string> target, IEnumerable<string>? origins)
    {
        if (origins is null)
        {
            return;
        }

        foreach (var origin in origins)
        {
            if (!string.IsNullOrWhiteSpace(origin))
            {
                target.Add(origin);
            }
        }
    }
}
