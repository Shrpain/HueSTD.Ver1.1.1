using System.Security.Claims;
using System.Text;
using HueSTD.API.Auth;
using HueSTD.Application.Interfaces;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

namespace HueSTD.API.Configuration;

public static class SupabaseAuthenticationExtensions
{
    public static IServiceCollection AddSupabaseAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        var supabaseUrl = configuration["Supabase:Url"] ?? Environment.GetEnvironmentVariable("SUPABASE_URL");
        if (string.IsNullOrWhiteSpace(supabaseUrl))
        {
            throw new InvalidOperationException("Supabase:Url is required to configure JWT authentication.");
        }

        var issuer = BuildIssuer(supabaseUrl);
        var jwtSecret = NormalizeSecret(configuration["Supabase:JwtSecret"] ?? Environment.GetEnvironmentVariable("SUPABASE_JWT_SECRET"));

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.MapInboundClaims = false;
                options.RequireHttpsMetadata = issuer.StartsWith("https://", StringComparison.OrdinalIgnoreCase);

                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = issuer,
                    ValidateAudience = true,
                    ValidAudiences = ["authenticated"],
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    NameClaimType = ClaimTypes.Email,
                    RoleClaimType = ClaimTypes.Role
                };

                if (!string.IsNullOrWhiteSpace(jwtSecret))
                {
                    options.TokenValidationParameters.IssuerSigningKey =
                        new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));
                }
                else
                {
                    options.Authority = issuer;
                }

                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = async context =>
                    {
                        // Extract user ID from the validated token
                        var userIdClaim = context.Principal?.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userIdClaim)) return;

                        try
                        {
                            // Get AuthService to fetch the actual role from database
                            var authService = context.HttpContext.RequestServices.GetRequiredService<IAuthService>();
                            var user = await authService.GetCurrentUserAsync(userIdClaim);

                            if (user != null && !string.IsNullOrEmpty(user.Role))
                            {
                                var appIdentity = new ClaimsIdentity();
                                appIdentity.AddClaim(new System.Security.Claims.Claim(ClaimTypes.Role, user.Role));

                                // Add additional claims if needed
                                appIdentity.AddClaim(new System.Security.Claims.Claim("app_role", user.Role));

                                context.Principal?.AddIdentity(appIdentity);
                            }
                        }
                        catch (Exception)
                        {
                            // If we can't fetch role, just continue with standard authenticated role
                        }
                    },
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"];
                        var path = context.HttpContext.Request.Path;

                        if (!string.IsNullOrWhiteSpace(accessToken) &&
                            path.StartsWithSegments("/hubs/assistant"))
                        {
                            context.Token = accessToken;
                        }

                        return Task.CompletedTask;
                    },
                    OnChallenge = context =>
                    {
                        context.HandleResponse();

                        return ProblemDetailsResponseWriter.WriteAsync(
                            context.HttpContext,
                            StatusCodes.Status401Unauthorized,
                            "Unauthorized",
                            "Authentication is required to access this resource.");
                    },
                    OnForbidden = context =>
                    {
                        return ProblemDetailsResponseWriter.WriteAsync(
                            context.HttpContext,
                            StatusCodes.Status403Forbidden,
                            "Forbidden",
                            "You do not have permission to perform this action.");
                    }
                };
            });

        services.AddAuthorization(options =>
        {
            options.AddPolicy(AppPolicies.Admin, policy =>
                policy.RequireAuthenticatedUser().RequireRole("admin"));

            options.AddPolicy(AppPolicies.ModeratorOrAdmin, policy =>
                policy.RequireAuthenticatedUser().RequireRole("admin", "moderator"));
        });

        return services;
    }

    private static string BuildIssuer(string supabaseUrl)
    {
        return $"{supabaseUrl.TrimEnd('/')}/auth/v1";
    }

    private static string? NormalizeSecret(string? rawSecret)
    {
        if (string.IsNullOrWhiteSpace(rawSecret))
        {
            return null;
        }

        return rawSecret.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase)
            ? null
            : rawSecret;
    }
}
