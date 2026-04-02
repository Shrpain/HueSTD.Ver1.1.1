using Supabase;

namespace HueSTD.API.Configuration;

public static class SupabaseWarmupExtensions
{
    public static async Task WarmUpSupabaseAsync(this WebApplication app)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        var supabaseClient = scope.ServiceProvider.GetRequiredService<Client>();

        try
        {
            await supabaseClient.InitializeAsync();
            logger.LogInformation("Supabase client initialized successfully.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to initialize Supabase client during application startup.");
        }
    }
}
