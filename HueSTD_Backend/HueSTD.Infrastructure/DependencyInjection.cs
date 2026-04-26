using HueSTD.Application.Interfaces;
using HueSTD.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication;
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
        var assistantDocumentsReadKey = configuration["Supabase:AssistantDocumentsReadKey"] ?? Environment.GetEnvironmentVariable("SUPABASE_ASSISTANT_DOCUMENTS_READ_KEY");

        static bool IsPlaceholder(string? v) =>
            string.IsNullOrWhiteSpace(v) ||
            v.StartsWith("YOUR_", StringComparison.Ordinal);

        // ServiceRoleKey > Key > AnonKey — tránh chọn Anon khi Key đã là service (lỗi cũ gây INSERT bị RLS chặn).
        var clientKey =
            !IsPlaceholder(supabaseServiceRoleKey) ? supabaseServiceRoleKey :
            !IsPlaceholder(supabaseKey) ? supabaseKey :
            !IsPlaceholder(supabaseAnonKey) ? supabaseAnonKey : null;

        if (string.IsNullOrEmpty(supabaseUrl) || string.IsNullOrEmpty(clientKey))
        {
            throw new InvalidOperationException(
                "Supabase chưa cấu hình đủ. Cần Supabase:Url và một trong: ServiceRoleKey (khuyến nghị), Key (service role), hoặc AnonKey tạm dev.");
        }

        if (!IsPlaceholder(supabaseAnonKey) &&
            string.Equals(clientKey, supabaseAnonKey, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                "Backend không được dùng Supabase AnonKey làm key chính (RLS sẽ chặn INSERT/UPDATE). Đặt Supabase:ServiceRoleKey hoặc Supabase:Key = service_role secret từ Supabase Dashboard → Settings → API.");
        }

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
        services.AddScoped<IDocumentReadGateway>(provider =>
        {
            var logger = provider.GetRequiredService<Microsoft.Extensions.Logging.ILogger<DocumentReadGateway>>();
            var readClient = new Client(
                supabaseUrl,
                string.IsNullOrWhiteSpace(assistantDocumentsReadKey) ? clientKey : assistantDocumentsReadKey,
                new SupabaseOptions
                {
                    AutoRefreshToken = true,
                    AutoConnectRealtime = false
                });
            return new DocumentReadGateway(readClient, logger);
        });
        services.AddScoped<IDashboardService, DashboardService>();
        services.AddScoped<IAdminService, AdminService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IChatService, ChatService>();
        services.AddScoped<IExamService, ExamService>();
        services.AddScoped<IAssistantRealtimeService, PersistentAssistantRealtimeService>();
        services.AddHttpClient<IAiService, AiService>();
        services.AddHttpClient<IFileUploadService, FileUploadService>();
        services.AddMemoryCache(); // Add memory cache for AI service
        
        // Add Realtime Monitor Background Service
        services.AddHostedService<RealtimeMonitorService>();

        return services;
    }
}
