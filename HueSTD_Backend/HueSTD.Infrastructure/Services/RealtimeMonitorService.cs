using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HueSTD.Infrastructure.Services;

public sealed class RealtimeMonitorService : BackgroundService
{
    private readonly ILogger<RealtimeMonitorService> _logger;
    private readonly string? _supabaseUrl;
    private readonly string? _supabaseKey;
    private Supabase.Client? _client;

    public RealtimeMonitorService(IConfiguration configuration, ILogger<RealtimeMonitorService> logger)
    {
        _logger = logger;
        _supabaseUrl = configuration["Supabase:Url"];
        _supabaseKey = configuration["Supabase:Key"];
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Starting Realtime Monitor Service...");

        if (string.IsNullOrWhiteSpace(_supabaseUrl) || string.IsNullOrWhiteSpace(_supabaseKey))
        {
            _logger.LogWarning("Realtime Monitor Service skipped because Supabase configuration is incomplete.");
            return;
        }

        var options = new Supabase.SupabaseOptions
        {
            AutoConnectRealtime = true
        };

        try
        {
            _client = new Supabase.Client(_supabaseUrl, _supabaseKey, options);
            await _client.InitializeAsync();
            stoppingToken.ThrowIfCancellationRequested();

            await _client.Realtime.ConnectAsync();
            _logger.LogInformation("Backend Realtime Connected to {SupabaseUrl}", _supabaseUrl);

            var channel = _client.Realtime.Channel("system_monitor");
            await channel.Subscribe();
            _logger.LogInformation("Listening on channel 'system_monitor'");

            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            // Expected on host shutdown.
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start Realtime Monitor Service. The application will continue without it.");
        }
        finally
        {
            _client?.Realtime.Disconnect();
        }
    }
}
