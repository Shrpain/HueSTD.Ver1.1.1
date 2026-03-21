using HueSTD.Application.Interfaces;
using HueSTD.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Supabase;

namespace HueSTD.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // Read from appsettings.json with environment variable fallback
        var supabaseUrl = configuration["Supabase:Url"] ?? Environment.GetEnvironmentVariable("SUPABASE_URL");
        var supabaseKey = configuration["Supabase:Key"] ?? Environment.GetEnvironmentVariable("SUPABASE_KEY");
        var supabaseAnonKey = configuration["Supabase:AnonKey"] ?? Environment.GetEnvironmentVariable("SUPABASE_ANON_KEY");
        var supabaseServiceRoleKey = configuration["Supabase:ServiceRoleKey"] ?? Environment.GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY");

        if (string.IsNullOrEmpty(supabaseUrl) || string.IsNullOrEmpty(supabaseKey))
        {
            throw new Exception("Supabase configuration is missing. Please check appsettings.json or set environment variables (SUPABASE_URL, SUPABASE_KEY).");
        }

        // Use service role key for backend (bypasses RLS), anon key for frontend client
        // Priority: ServiceRoleKey > AnonKey > Key
        var clientKey = !string.IsNullOrEmpty(supabaseServiceRoleKey) 
            ? supabaseServiceRoleKey 
            : (!string.IsNullOrEmpty(supabaseAnonKey) ? supabaseAnonKey : supabaseKey);

        services.AddScoped<Client>(provider => 
        {
            var options = new SupabaseOptions
            {
                AutoRefreshToken = true,
                AutoConnectRealtime = false
            };
            return new Client(supabaseUrl, clientKey, options);
        });

        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IProfileService, ProfileService>();
        services.AddScoped<IDocumentService, DocumentService>();
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<IAdminService, AdminService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IAiService, AiService>();
        
        // Add Realtime Monitor Background Service
        services.AddHostedService<RealtimeMonitorService>();

        return services;
    }
}
