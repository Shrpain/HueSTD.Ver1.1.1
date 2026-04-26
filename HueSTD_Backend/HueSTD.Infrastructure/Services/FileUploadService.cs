using System.Net.Http;
using System.Net.Http.Headers;
using HueSTD.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace HueSTD.Infrastructure.Services;

public class FileUploadService : IFileUploadService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<FileUploadService> _logger;
    private readonly string _supabaseUrl;
    private readonly string _supabaseKey;

    // Allowed extensions with their expected magic bytes signatures
    private static readonly Dictionary<string, Func<byte[], bool>> MagicByteValidators = new()
    {
        { ".pdf", bytes => bytes.Length >= 4 && bytes[0] == 0x25 && bytes[1] == 0x50 && bytes[2] == 0x44 && bytes[3] == 0x46 }, // %PDF
        { ".png", bytes => bytes.Length >= 8 && bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47 },
        { ".jpg", bytes => bytes.Length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF },
        { ".jpeg", bytes => bytes.Length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF },
        { ".gif", bytes => bytes.Length >= 6 && bytes[0] == 0x47 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x38 }, // GIF8
    };

    public FileUploadService(HttpClient httpClient, ILogger<FileUploadService> logger, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _logger = logger;
        _supabaseUrl = configuration["Supabase:Url"] ?? Environment.GetEnvironmentVariable("SUPABASE_URL")
            ?? throw new InvalidOperationException("SUPABASE_URL not configured");
        _supabaseKey = configuration["Supabase:ServiceRoleKey"]
            ?? configuration["Supabase:Key"]
            ?? Environment.GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY")
            ?? Environment.GetEnvironmentVariable("SUPABASE_KEY")
            ?? throw new InvalidOperationException("Supabase key not configured");
    }

    public async Task<(string fileUrl, string storedFileName)> UploadAsync(Stream file, string fileName, string userId)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        var storedFileName = $"{Guid.NewGuid()}{ext}";
        var filePath = $"documents/{userId}/{storedFileName}";

        // Validate file size (50MB limit)
        if (file.Length > 50 * 1024 * 1024)
        {
            throw new InvalidOperationException("File size exceeds 50MB limit.");
        }

        // Read file bytes for magic byte validation
        var fileBytes = new byte[file.Length];
        file.Position = 0;
        await file.ReadAsync(fileBytes.AsMemory(0, (int)file.Length));

        // Validate magic bytes for known types
        if (MagicByteValidators.TryGetValue(ext, out var validator))
        {
            if (!validator(fileBytes))
            {
                _logger.LogWarning("[FileUpload] Magic byte validation failed for {FileName} (ext: {Ext})", fileName, ext);
                throw new InvalidOperationException($"File content does not match {ext} format.");
            }
        }

        // Upload to Supabase Storage using PUT with StreamContent
        var uploadUrl = $"{_supabaseUrl}/storage/v1/object/documents/{filePath}";

        using var request = new HttpRequestMessage(HttpMethod.Put, uploadUrl)
        {
            Content = new ByteArrayContent(fileBytes)
        };
        request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");

        // Set auth headers only on this request (not global)
        request.Headers.Add("Authorization", $"Bearer {_supabaseKey}");
        request.Headers.Add("apikey", _supabaseKey);

        _logger.LogInformation("[FileUpload] Uploading {FileName} to {FilePath}", fileName, filePath);

        var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);

        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            _logger.LogError("[FileUpload] Upload failed: {StatusCode} - {Error}", response.StatusCode, errorContent);
            throw new InvalidOperationException($"Failed to upload file to storage. Status: {response.StatusCode}");
        }

        var publicUrl = $"{_supabaseUrl}/storage/v1/object/public/documents/{filePath}";
        _logger.LogInformation("[FileUpload] Upload successful: {FileName} -> {Url}", fileName, MaskUrlForLog(publicUrl));

        return (publicUrl, storedFileName);
    }

    /// <summary>
    /// Mask URL for logging to avoid leaking any potential query params.
    /// </summary>
    private static string MaskUrlForLog(string url)
    {
        try
        {
            if (Uri.TryCreate(url, UriKind.Absolute, out var uri))
            {
                var builder = new UriBuilder(uri) { Query = string.Empty };
                return builder.Uri.ToString();
            }
        }
        catch { }
        return url;
    }
}
