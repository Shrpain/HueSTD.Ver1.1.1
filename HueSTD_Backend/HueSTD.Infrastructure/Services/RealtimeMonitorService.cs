using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Supabase;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace HueSTD.Infrastructure.Services
{
    public class RealtimeMonitorService : IHostedService, IDisposable
    {
        private readonly ILogger<RealtimeMonitorService> _logger;
        private readonly string _supabaseUrl;
        private readonly string _supabaseKey;
        private Supabase.Client _client;

        public RealtimeMonitorService(IConfiguration configuration, ILogger<RealtimeMonitorService> logger)
        {
            _logger = logger;
            _supabaseUrl = configuration["Supabase:Url"];
            _supabaseKey = configuration["Supabase:Key"];
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("🚀 Starting Realtime Monitor Service...");

            var options = new Supabase.SupabaseOptions
            {
                AutoConnectRealtime = true
            };

            try
            {
                _client = new Supabase.Client(_supabaseUrl, _supabaseKey, options);
                await _client.InitializeAsync();

                await _client.Realtime.ConnectAsync();
                
                _logger.LogInformation($"✅ Backend Realtime Connected to {_supabaseUrl}");

                var channel = _client.Realtime.Channel("system_monitor");
                await channel.Subscribe();
                
                _logger.LogInformation($"📡 Listening on channel 'system_monitor'");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Failed to start Realtime Monitor Service. The application will continue without it.");
            }
        }

        public Task StopAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("🛑 Stopping Realtime Monitor Service...");
            if (_client?.Realtime != null)
            {
                _client.Realtime.Disconnect();
            }
            return Task.CompletedTask;
        }

        public void Dispose()
        {
            // Calculate resource cleanup if needed
        }
    }
}
