using HueSTD.Application.DTOs.Admin;
using HueSTD.Application.DTOs.AI;
using HueSTD.Application.Interfaces;
using HueSTD.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Supabase;
using Supabase.Postgrest.Interfaces;

namespace HueSTD.Infrastructure.Services;

public class AdminService : IAdminService
{
    private readonly Supabase.Client _supabaseClient;
    private readonly IConfiguration _configuration;
    private readonly INotificationService _notificationService;
    private readonly ILogger<AdminService> _logger;

    public AdminService(Supabase.Client supabaseClient, IConfiguration configuration, INotificationService notificationService, ILogger<AdminService> logger)
    {
        _supabaseClient = supabaseClient;
        _configuration = configuration;
        _notificationService = notificationService;
        _logger = logger;
    }

    public async Task<AdminStatsDto> GetDashboardStatsAsync()
    {
        var stats = new AdminStatsDto();

        try
        {
            // Total Users
            var usersCount = await _supabaseClient
                .From<Profile>()
                .Count(Supabase.Postgrest.Constants.CountType.Exact);
            stats.TotalUsers = (int)usersCount;

            // Total Documents
            var docsResult = await _supabaseClient
                .From<Document>()
                .Get();
            stats.TotalDocuments = docsResult.Models.Count;

            // Total Views and Downloads
            stats.TotalViews = docsResult.Models.Any() ? docsResult.Models.Sum(d => d.Views) : 0;
            stats.TotalDownloads = docsResult.Models.Any() ? docsResult.Models.Sum(d => d.Downloads) : 0;

            // Reports Count - Currently not used
            stats.ReportsCount = 0;

            // Recent Activities - Get latest 5 users and latest 5 documents
            var recentUsers = await _supabaseClient
                .From<Profile>()
                .Order("created_at", Supabase.Postgrest.Constants.Ordering.Descending)
                .Limit(3)
                .Get();

            var recentDocs = await _supabaseClient
                .From<Document>()
                .Order("created_at", Supabase.Postgrest.Constants.Ordering.Descending)
                .Limit(2)
                .Get();

            // Combine and sort by timestamp
            var activities = new List<RecentActivityDto>();

            foreach (var user in recentUsers.Models)
            {
                activities.Add(new RecentActivityDto
                {
                    Id = user.Id.ToString(),
                    Type = "user_registered",
                    Description = "Người dùng mới đăng ký",
                    UserName = user.FullName ?? user.Email ?? "Unknown",
                    UserAvatar = user.AvatarUrl,
                    Timestamp = user.CreatedAt
                });
            }

            foreach (var doc in recentDocs.Models)
            {
                // Fetch uploader info safely
                Profile? uploader = null;
                if (doc.UploaderId.HasValue && doc.UploaderId != Guid.Empty)
                {
                    try
                    {
                        var uploaderResult = await _supabaseClient
                            .From<Profile>()
                            .Where(p => p.Id == doc.UploaderId.Value)
                            .Get();
                        
                        if (uploaderResult.Models.Any())
                        {
                            uploader = uploaderResult.Models[0];
                        }
                    }
                    catch (Exception uploaderEx)
                    {
                        _logger.LogWarning("[AdminService] Could not fetch uploader {UploaderId}: {Message}", doc.UploaderId, uploaderEx.Message);
                    }
                }

                activities.Add(new RecentActivityDto
                {
                    Id = doc.Id.ToString(),
                    Type = "document_uploaded",
                    Description = $"Tài liệu mới: {doc.Title ?? "Không có tiêu đề"}",
                    UserName = uploader?.FullName ?? uploader?.Email ?? "Người dùng ẩn danh",
                    UserAvatar = uploader?.AvatarUrl,
                    Timestamp = doc.CreatedAt
                });
            }

            stats.RecentActivities = activities
                .OrderByDescending(a => a.Timestamp)
                .Take(5)
                .ToList();

            return stats;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error getting stats");
            return stats; // Return empty stats on error
        }
    }

    // ===== USER MANAGEMENT =====
    public async Task<List<UserListItemDto>> GetAllUsersAsync()
    {
        try
        {
            var profiles = await _supabaseClient
                .From<Profile>()
                .Order("created_at", Supabase.Postgrest.Constants.Ordering.Descending)
                .Get();

            return profiles.Models.Select(p => new UserListItemDto
            {
                Id = p.Id.ToString(),
                Email = p.Email ?? "",
                FullName = p.FullName,
                School = p.School,
                Major = p.Major,
                Points = p.Points,
                Role = p.Role,
                CreatedAt = p.CreatedAt
            }).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error getting users");
            return new List<UserListItemDto>();
        }
    }

    public async Task<UserDetailDto?> GetUserByIdAsync(string id)
    {
        try
        {
            var userId = Guid.Parse(id);
            var profile = await _supabaseClient
                .From<Profile>()
                .Where(p => p.Id == userId)
                .Single();

            if (profile == null) return null;

            return new UserDetailDto
            {
                Id = profile.Id.ToString(),
                Email = profile.Email ?? "",
                FullName = profile.FullName,
                School = profile.School,
                Major = profile.Major,
                AvatarUrl = profile.AvatarUrl,
                Points = profile.Points,
                Badge = profile.Badge,
                Role = profile.Role,
                CreatedAt = profile.CreatedAt
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error getting user {Id}", id);
            return null;
        }
    }

    public async Task<UserDetailDto> CreateUserAsync(CreateUserRequest request)
    {
        // Use Supabase Admin API to create user
        var supabaseUrl = _configuration["Supabase:Url"] ?? Environment.GetEnvironmentVariable("SUPABASE_URL");
        var supabaseKey = _configuration["Supabase:Key"] ?? Environment.GetEnvironmentVariable("SUPABASE_KEY");

        if (string.IsNullOrEmpty(supabaseUrl) || string.IsNullOrEmpty(supabaseKey))
            throw new Exception("Supabase configuration missing.");

        var adminUrl = $"{supabaseUrl}/auth/v1/admin/users";

        using var httpClient = new HttpClient();
        httpClient.DefaultRequestHeaders.Add("apikey", supabaseKey);
        httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {supabaseKey}");

        var payload = new
        {
            email = request.Email,
            password = request.Password,
            email_confirm = true,
            user_metadata = new { full_name = request.FullName ?? "" }
        };

        var jsonPayload = System.Text.Json.JsonSerializer.Serialize(payload);
        var content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");

        var response = await httpClient.PostAsync(adminUrl, content);
        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();
            throw new Exception($"Failed to create user: {response.StatusCode} - {errorBody}");
        }

        var responseBody = await response.Content.ReadAsStringAsync();
        var userResponse = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(responseBody);
        var userId = userResponse.GetProperty("id").GetString();

        // Update profile with additional fields
        var profile = new Profile
        {
            Id = Guid.Parse(userId!),
            Email = request.Email,
            FullName = request.FullName,
            School = request.School,
            Major = request.Major,
            Role = request.Role,
            Points = 0,
            CreatedAt = DateTime.UtcNow
        };

        await _supabaseClient.From<Profile>().Upsert(profile);

        return new UserDetailDto
        {
            Id = userId!,
            Email = request.Email,
            FullName = request.FullName,
            School = request.School,
            Major = request.Major,
            Points = 0,
            Role = request.Role,
            CreatedAt = DateTime.UtcNow
        };
    }

    public async Task<UserDetailDto?> UpdateUserAsync(string id, UpdateUserRequest request)
    {
        try
        {
            _logger.LogInformation("[AdminService] Updating user with ID: {Id}", id);
            
            var userId = Guid.Parse(id);
            var result = await _supabaseClient
                .From<Profile>()
                .Where(p => p.Id == userId)
                .Get();

            if (result.Models.Count == 0)
            {
                _logger.LogWarning("[AdminService] User {Id} not found in database", id);
                return null;
            }

            var profile = result.Models[0];
            _logger.LogInformation("[AdminService] Found user: {Email}", profile.Email);

            // Store old role for notification
            var oldRole = profile.Role;

            // Update fields
            if (request.FullName != null) profile.FullName = request.FullName;
            if (request.School != null) profile.School = request.School;
            if (request.Major != null) profile.Major = request.Major;
            if (request.Points.HasValue) profile.Points = request.Points.Value;
            if (request.Role != null) profile.Role = request.Role;

            _logger.LogInformation("[AdminService] Upserting profile...");
            await _supabaseClient.From<Profile>().Upsert(profile);
            _logger.LogInformation("[AdminService] Update successful");

            // Notify user if role was changed
            if (!string.IsNullOrEmpty(request.Role) && request.Role != oldRole)
            {
                try
                {
                    string roleChangeMessage = request.Role switch
                    {
                        "admin" => "Bạn đã được nâng cấp lên quản trị viên.",
                        "moderator" => "Bạn đã được nâng cấp lên điều hành viên.",
                        "user" => "Vai trò của bạn đã được thay đổi thành người dùng.",
                        _ => $"Vai trò của bạn đã được cập nhật thành: {request.Role}."
                    };

                    await _notificationService.CreateNotificationAsync(new Application.DTOs.Notification.CreateNotificationRequest
                    {
                        UserId = userId,
                        Title = "Cập nhật vai trò",
                        Message = roleChangeMessage,
                        Type = "role_change",
                        ReferenceId = userId
                    });
                }
                catch (Exception notifyEx)
                {
                    _logger.LogWarning("[AdminService] Warning: Failed to send role change notification: {Message}", notifyEx.Message);
                }
            }

            return new UserDetailDto
            {
                Id = profile.Id.ToString(),
                Email = profile.Email ?? "",
                FullName = profile.FullName,
                School = profile.School,
                Major = profile.Major,
                AvatarUrl = profile.AvatarUrl,
                Points = profile.Points,
                Badge = profile.Badge,
                Role = profile.Role,
                CreatedAt = profile.CreatedAt
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error updating user {Id}", id);
            _logger.LogTrace("[AdminService] Stack trace: {StackTrace}", ex.StackTrace);
            return null;
        }
    }

    public async Task<bool> DeleteUserAsync(string id)
    {
        try
        {
            var userId = Guid.Parse(id);
            _logger.LogInformation("[AdminService] Starting full cascade delete for user {Id}", id);

            // 1. Delete Documents (Files + DB)
            var documents = await _supabaseClient.From<Document>().Where(x => x.UploaderId == userId).Get();
            if (documents.Models.Count > 0)
            {
                foreach (var doc in documents.Models)
                {
                    if (!string.IsNullOrEmpty(doc.FileUrl)) await DeleteFileFromUrl(doc.FileUrl);
                    await _supabaseClient.From<Document>().Where(d => d.Id == doc.Id).Delete();
                }
                _logger.LogInformation("[AdminService] Deleted {Count} documents for user {Id}", documents.Models.Count, id);
            }

            // 2. Delete Profile (Avatar + DB) - Must delete this first to maintain data integrity
            var profileResult = await _supabaseClient.From<Profile>().Where(p => p.Id == userId).Get();
            if (profileResult.Models.Count > 0)
            {
                var profile = profileResult.Models[0];
                if (!string.IsNullOrEmpty(profile.AvatarUrl)) await DeleteFileFromUrl(profile.AvatarUrl);

                _logger.LogInformation("[AdminService] Deleting profile record...");
                await _supabaseClient.From<Profile>().Where(p => p.Id == userId).Delete();
            }

            // 3. Delete from Supabase Auth using Admin API
            var supabaseUrl = _configuration["Supabase:Url"] ?? Environment.GetEnvironmentVariable("SUPABASE_URL");
            var supabaseKey = _configuration["Supabase:Key"] ?? Environment.GetEnvironmentVariable("SUPABASE_KEY");

            if (string.IsNullOrEmpty(supabaseUrl) || string.IsNullOrEmpty(supabaseKey))
            {
                _logger.LogWarning("[AdminService] Supabase configuration missing. Auth deletion skipped for user {Id}", id);
                // DB records are already deleted, user cannot login anymore
                return true;
            }

            var adminUrl = $"{supabaseUrl}/auth/v1/admin/users/{id}";

            using var httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.Add("apikey", supabaseKey);
            httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {supabaseKey}");

            var response = await httpClient.DeleteAsync(adminUrl);
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("[AdminService] Failed to delete user from Auth (Status: {StatusCode}): {Error}. DB records already cleaned up.",
                    response.StatusCode, errorBody);
                // User's DB records are deleted, they cannot login anyway
                return true;
            }

            _logger.LogInformation("[AdminService] Successfully deleted user {Id} from all systems", id);
            return true;
        }
        catch (FormatException ex)
        {
            _logger.LogError(ex, "[AdminService] Invalid user ID format: {Id}", id);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error deleting user {Id}", id);
            return false;
        }
    }

    private async Task DeleteFileFromUrl(string fileUrl)
    {
        try
        {
            if (string.IsNullOrEmpty(fileUrl)) return;

            var uri = new Uri(fileUrl);
            var segments = uri.Segments; // /, storage/, v1/, object/, public/, {bucket}/, {path...}
            
            // Find "public" segment
            int publicIndex = -1;
            for(int i = 0; i < segments.Length; i++)
            {
                if (segments[i].Trim('/').Equals("public", StringComparison.OrdinalIgnoreCase))
                {
                    publicIndex = i;
                    break;
                }
            }

            if (publicIndex != -1 && publicIndex < segments.Length - 2) // Need at least bucket + file
            {
                // Bucket is the next segment
                string bucketName = segments[publicIndex + 1].Trim('/');
                
                // Path is everything after bucket
                string filePath = string.Join("", segments.Skip(publicIndex + 2));
                
                // _logger.LogInformation("[AdminService] Deleting file from bucket '{bucketName}': {filePath}", bucketName, filePath);
                await _supabaseClient.Storage.From(bucketName).Remove(new List<string> { filePath });
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning("[AdminService] Warning: Failed to delete file {FileUrl}", fileUrl);
        }
    }

    // ===== DOCUMENT MANAGEMENT =====
    public async Task<List<DocumentListItemDto>> GetAllDocumentsAsync()
    {
        try
        {
            var documents = await _supabaseClient
                .From<Document>()
                .Order("created_at", Supabase.Postgrest.Constants.Ordering.Descending)
                .Get();

            var documentDtos = new List<DocumentListItemDto>();

            // Optimize: Get all unique uploader IDs first, then fetch all profiles in one request
            var uploaderIds = documents.Models
                .Where(d => d.UploaderId.HasValue)
                .Select(d => d.UploaderId!.Value)
                .Distinct()
                .ToList();

            // Fetch all profiles in one batch if there are any
            Dictionary<Guid, Profile> profileMap = new();
            if (uploaderIds.Any())
            {
                var profilesResult = await _supabaseClient
                    .From<Profile>()
                    .Filter("id", Supabase.Postgrest.Constants.Operator.In, uploaderIds)
                    .Get();

                profileMap = profilesResult.Models.ToDictionary(p => p.Id);
            }

            foreach (var doc in documents.Models)
            {
                // Get uploader name from cached profiles
                string? uploaderName = null;
                if (doc.UploaderId.HasValue && profileMap.TryGetValue(doc.UploaderId.Value, out var profile))
                {
                    uploaderName = profile.FullName ?? profile.Email;
                }

                documentDtos.Add(new DocumentListItemDto
                {
                    Id = doc.Id.ToString(),
                    Title = doc.Title ?? "",
                    Description = doc.Description,
                    UploaderName = uploaderName,
                    School = doc.School,
                    Subject = doc.Subject,
                    Type = doc.Type,
                    IsApproved = doc.IsApproved,
                    Views = doc.Views,
                    Downloads = doc.Downloads,
                    CreatedAt = doc.CreatedAt
                });
            }

            return documentDtos;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error getting documents");
            return new List<DocumentListItemDto>();
        }
    }

    public async Task<PaginatedDocumentsResponse> GetDocumentsPaginatedAsync(int page = 1, int pageSize = 20, bool? isApproved = null, string? search = null, string? documentType = null, string? school = null)
    {
        try
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);
            var hasSearch = !string.IsNullOrWhiteSpace(search);

            // ── Fuzzy search via RPC when a search term is provided ──────────
            if (hasSearch)
            {
                return await GetDocumentsFuzzyAsync(page, pageSize, isApproved, search, documentType, school);
            }

            // ── No search term: use existing Postgrest approach ───────────────
            var hasType = !string.IsNullOrWhiteSpace(documentType);
            var hasSchool = !string.IsNullOrWhiteSpace(school);

            IPostgrestTable<Document> countQuery = (IPostgrestTable<Document>)(object)_supabaseClient.From<Document>();
            if (isApproved.HasValue)
                countQuery = countQuery.Where(d => d.IsApproved == isApproved.Value);
            if (hasType)
                countQuery = countQuery.Where(d => d.Type == documentType);
            if (hasSchool)
                countQuery = countQuery.Where(d => d.School == school);

            var totalCount = await countQuery.Count(Supabase.Postgrest.Constants.CountType.Exact);

            var offset = (page - 1) * pageSize;
            IPostgrestTable<Document> dataQuery = (IPostgrestTable<Document>)(object)_supabaseClient.From<Document>();
            if (isApproved.HasValue)
                dataQuery = dataQuery.Where(d => d.IsApproved == isApproved.Value);
            if (hasType)
                dataQuery = dataQuery.Where(d => d.Type == documentType);
            if (hasSchool)
                dataQuery = dataQuery.Where(d => d.School == school);

            var docs = await dataQuery
                .Order("created_at", Supabase.Postgrest.Constants.Ordering.Descending)
                .Range((int)offset, (int)(offset + pageSize - 1))
                .Get();
            var documentDtos = await BuildDocumentDtosAsync(docs.Models);

            return new PaginatedDocumentsResponse
            {
                Documents = documentDtos,
                TotalCount = (int)totalCount,
                Page = page,
                PageSize = pageSize
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error getting paginated documents");
            return new PaginatedDocumentsResponse { Page = page, PageSize = pageSize };
        }
    }

    // ── Fuzzy search using PostgreSQL pg_trgm + unaccent via RPC ─────────────
    private async Task<PaginatedDocumentsResponse> GetDocumentsFuzzyAsync(
        int page, int pageSize, bool? isApproved, string? search,
        string? documentType, string? school)
    {
        try
        {
            var rpcParams = new Dictionary<string, object>
            {
                { "p_search", search ?? "" },
                { "p_is_approved", isApproved.HasValue ? (object)isApproved.Value : DBNull.Value },
                { "p_type", !string.IsNullOrWhiteSpace(documentType) ? documentType! : DBNull.Value },
                { "p_school", !string.IsNullOrWhiteSpace(school) ? school! : DBNull.Value },
                { "p_page", page },
                { "p_page_size", pageSize }
            };

            // Fetch matching documents
            var docsRpc = await _supabaseClient.Rpc("search_documents_fuzzy", rpcParams);
            var docsJson = docsRpc.Content ?? "[]";

            var rawDocs = System.Text.Json.JsonSerializer.Deserialize<List<Dictionary<string, System.Text.Json.JsonElement>>>(
                docsJson, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (rawDocs == null || rawDocs.Count == 0)
            {
                return new PaginatedDocumentsResponse
                {
                    Documents = new List<DocumentListItemDto>(),
                    TotalCount = 0,
                    Page = page,
                    PageSize = pageSize
                };
            }

            // Map raw RPC results to Document entities
            var docs = new List<Document>();
            foreach (var rd in rawDocs)
            {
                var doc = new Document
                {
                    Id = Guid.Parse(rd["id"].GetString()!),
                    Title = rd["title"].GetString(),
                    Description = rd.TryGetValue("description", out var desc) && desc.ValueKind != System.Text.Json.JsonValueKind.Null ? desc.GetString() : null,
                    FileUrl = rd.TryGetValue("file_url", out var fu) && fu.ValueKind != System.Text.Json.JsonValueKind.Null ? fu.GetString() : null,
                    UploaderId = rd.TryGetValue("uploader_id", out var uid) && uid.ValueKind != System.Text.Json.JsonValueKind.Null ? Guid.Parse(uid.GetString()!) : null,
                    School = rd.TryGetValue("school", out var sc) && sc.ValueKind != System.Text.Json.JsonValueKind.Null ? sc.GetString() : null,
                    Subject = rd.TryGetValue("subject", out var subj) && subj.ValueKind != System.Text.Json.JsonValueKind.Null ? subj.GetString() : null,
                    Type = rd.TryGetValue("type", out var tp) && tp.ValueKind != System.Text.Json.JsonValueKind.Null ? tp.GetString() : null,
                    Year = rd.TryGetValue("year", out var yr) && yr.ValueKind != System.Text.Json.JsonValueKind.Null ? yr.GetString() : null,
                    Status = rd.TryGetValue("status", out var st) && st.ValueKind != System.Text.Json.JsonValueKind.Null ? st.GetString() : null,
                    Views = rd.TryGetValue("views", out var vw) ? vw.GetInt32() : 0,
                    Downloads = rd.TryGetValue("downloads", out var dl) ? dl.GetInt32() : 0,
                    CreatedAt = rd.TryGetValue("created_at", out var ca) ? ca.GetDateTime() : DateTime.UtcNow,
                    UpdatedAt = rd.TryGetValue("updated_at", out var ua) ? ua.GetDateTime() : DateTime.UtcNow,
                    IsApproved = rd.TryGetValue("is_approved", out var ia) ? ia.GetBoolean() : false
                };
                docs.Add(doc);
            }

            // Count total matches
            var countParams = new Dictionary<string, object>
            {
                { "p_search", search ?? "" },
                { "p_is_approved", isApproved.HasValue ? (object)isApproved.Value : DBNull.Value },
                { "p_type", !string.IsNullOrWhiteSpace(documentType) ? documentType! : DBNull.Value },
                { "p_school", !string.IsNullOrWhiteSpace(school) ? school! : DBNull.Value }
            };
            var countRpc = await _supabaseClient.Rpc("search_documents_fuzzy_count", countParams);
            // PostgREST returns scalar INT as a bare JSON number; TryGetProperty on a Number root throws (.NET 9+).
            var countInt = ParseRpcScalarInt32(countRpc.Content, docs.Count);

            var documentDtos = await BuildDocumentDtosAsync(docs);

            return new PaginatedDocumentsResponse
            {
                Documents = documentDtos,
                TotalCount = countInt,
                Page = page,
                PageSize = pageSize
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Fuzzy search error");
            return new PaginatedDocumentsResponse { Page = page, PageSize = pageSize };
        }
    }

    /// <summary>
    /// Parses PostgREST RPC payloads that return a single integer: often a bare number, sometimes an object or single-element array.
    /// </summary>
    private static int ParseRpcScalarInt32(string? json, int fallback)
    {
        if (string.IsNullOrWhiteSpace(json)) return fallback;
        using var doc = System.Text.Json.JsonDocument.Parse(json);
        var root = doc.RootElement;
        return root.ValueKind switch
        {
            System.Text.Json.JsonValueKind.Number => root.TryGetInt32(out var n) ? n : fallback,
            System.Text.Json.JsonValueKind.Object => TryReadIntFromJsonObject(root, fallback),
            System.Text.Json.JsonValueKind.Array when root.GetArrayLength() > 0 => root[0].ValueKind switch
            {
                System.Text.Json.JsonValueKind.Number => root[0].TryGetInt32(out var a) ? a : fallback,
                System.Text.Json.JsonValueKind.Object => TryReadIntFromJsonObject(root[0], fallback),
                _ => fallback
            },
            _ => fallback
        };
    }

    private static int TryReadIntFromJsonObject(System.Text.Json.JsonElement root, int fallback)
    {
        if (root.TryGetProperty("search_documents_fuzzy_count", out var named) && named.ValueKind == System.Text.Json.JsonValueKind.Number)
            return named.GetInt32();
        if (root.TryGetProperty("data", out var data) && data.ValueKind == System.Text.Json.JsonValueKind.Number)
            return data.GetInt32();
        foreach (var prop in root.EnumerateObject())
        {
            if (prop.Value.ValueKind == System.Text.Json.JsonValueKind.Number)
                return prop.Value.GetInt32();
        }
        return fallback;
    }

    private async Task<List<DocumentListItemDto>> BuildDocumentDtosAsync(List<Document> docs)
    {
        var documentDtos = new List<DocumentListItemDto>();
        var uploaderIds = docs.Where(d => d.UploaderId.HasValue).Select(d => d.UploaderId!.Value).Distinct().ToList();
        var profileMap = new Dictionary<Guid, Profile>();
        if (uploaderIds.Any())
        {
            var profilesResult = await _supabaseClient.From<Profile>()
                .Filter("id", Supabase.Postgrest.Constants.Operator.In, uploaderIds)
                .Get();
            profileMap = profilesResult.Models.ToDictionary(p => p.Id);
        }
        foreach (var doc in docs)
        {
            string? uploaderName = null;
            if (doc.UploaderId.HasValue && profileMap.TryGetValue(doc.UploaderId.Value, out var profile))
                uploaderName = profile.FullName ?? profile.Email;
            documentDtos.Add(new DocumentListItemDto
            {
                Id = doc.Id.ToString(),
                Title = doc.Title ?? "",
                Description = doc.Description,
                UploaderName = uploaderName,
                School = doc.School,
                Subject = doc.Subject,
                Type = doc.Type,
                IsApproved = doc.IsApproved,
                Views = doc.Views,
                Downloads = doc.Downloads,
                CreatedAt = doc.CreatedAt
            });
        }
        return documentDtos;
    }

    public async Task<DocumentDetailDto?> GetDocumentByIdAsync(string id)
    {
        try
        {
            var docId = Guid.Parse(id);
            var result = await _supabaseClient
                .From<Document>()
                .Where(d => d.Id == docId)
                .Get();

            if (result.Models.Count == 0) return null;
            var doc = result.Models[0];

            // Fetch uploader name
            string? uploaderName = null;
            try
            {
                if (doc.UploaderId.HasValue)
                {
                    var uploader = await _supabaseClient
                        .From<Profile>()
                        .Where(p => p.Id == doc.UploaderId.Value)
                        .Single();
                    uploaderName = uploader?.FullName ?? uploader?.Email;
                }
            }
            catch { }

            return new DocumentDetailDto
            {
                Id = doc.Id.ToString(),
                Title = doc.Title ?? "",
                Description = doc.Description,
                FileUrl = doc.FileUrl,
                UploaderId = doc.UploaderId.HasValue ? doc.UploaderId.ToString() : string.Empty,
                UploaderName = uploaderName,
                School = doc.School,
                Subject = doc.Subject,
                Type = doc.Type,
                Year = doc.Year,
                IsApproved = doc.IsApproved,
                Views = doc.Views,
                Downloads = doc.Downloads,
                CreatedAt = doc.CreatedAt
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error getting document {Id}", id);
            return null;
        }
    }

    public async Task<DocumentDetailDto?> UpdateDocumentAsync(string id, UpdateDocumentRequest request)
    {
        try
        {
            var docId = Guid.Parse(id);
            var result = await _supabaseClient
                .From<Document>()
                .Where(d => d.Id == docId)
                .Get();

            if (result.Models.Count == 0) return null;
            var doc = result.Models[0];

            // Update fields
            if (request.Title != null) doc.Title = request.Title;
            if (request.Description != null) doc.Description = request.Description;
            if (request.School != null) doc.School = request.School;
            if (request.Subject != null) doc.Subject = request.Subject;
            if (request.Type != null) doc.Type = request.Type;
            if (request.Year != null) doc.Year = request.Year;
            if (request.IsApproved.HasValue) doc.IsApproved = request.IsApproved.Value;
            doc.UpdatedAt = DateTime.UtcNow;

            await _supabaseClient.From<Document>().Upsert(doc);

            return await GetDocumentByIdAsync(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error updating document {Id}", id);
            return null;
        }
    }

    public async Task<bool> ApproveDocumentAsync(string id)
    {
        try
        {
            var docId = Guid.Parse(id);
            var result = await _supabaseClient
                .From<Document>()
                .Where(d => d.Id == docId)
                .Get();

            if (result.Models.Count == 0) return false;
            var doc = result.Models[0];

            doc.IsApproved = true;
            doc.UpdatedAt = DateTime.UtcNow;
            await _supabaseClient.From<Document>().Upsert(doc);

            // Update admin grouped notification with new count
            try
            {
                var pendingDocsResult = await _supabaseClient
                    .From<Document>()
                    .Where(d => d.IsApproved == false)
                    .Get();
                
                int pendingCount = pendingDocsResult.Models.Count;
                
                await _notificationService.NotifyAdminsGroupedAsync(
                    "Tài liệu mới cần duyệt!",
                    pendingCount > 0 ? $"Có {pendingCount} tài liệu mới chờ xét duyệt" : "Không còn tài liệu nào chờ duyệt",
                    "admin_document_approval",
                    pendingCount
                );
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[AdminService] Failed to update grouped notification after approval");
            }

            // Notify user that document was approved
            if (doc.UploaderId.HasValue && doc.UploaderId != Guid.Empty)
            {
                try
                {
                    await _notificationService.CreateNotificationAsync(new Application.DTOs.Notification.CreateNotificationRequest
                    {
                        UserId = doc.UploaderId.Value,
                        Title = "Tài liệu được duyệt",
                        Message = $"Tài liệu \"{doc.Title}\" đã được quản trị viên duyệt và hiển thị công khai.",
                        Type = "approval",
                        ReferenceId = doc.Id
                    });
                }
                catch (Exception notifyEx)
                {
                    _logger.LogWarning(notifyEx, "[AdminService] Failed to send approval notification for document {Id}", id);
                }
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error approving document {Id}", id);
            return false;
        }
    }

    public async Task<bool> RejectDocumentAsync(string id)
    {
        try
        {
            var docId = Guid.Parse(id);
            var result = await _supabaseClient
                .From<Document>()
                .Where(d => d.Id == docId)
                .Get();

            if (result.Models.Count == 0) return false;
            var doc = result.Models[0];

            doc.IsApproved = false;
            doc.UpdatedAt = DateTime.UtcNow;
            await _supabaseClient.From<Document>().Upsert(doc);

            // Update admin grouped notification with new count
            try
            {
                var pendingDocsResult = await _supabaseClient
                    .From<Document>()
                    .Where(d => d.IsApproved == false)
                    .Get();
                
                int pendingCount = pendingDocsResult.Models.Count;
                
                await _notificationService.NotifyAdminsGroupedAsync(
                    "Tài liệu mới cần duyệt!",
                    pendingCount > 0 ? $"Có {pendingCount} tài liệu mới chờ xét duyệt" : "Không còn tài liệu nào chờ duyệt",
                    "admin_document_approval",
                    pendingCount
                );
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[AdminService] Failed to update grouped notification after rejection");
            }

            // Notify user that document was rejected
            if (doc.UploaderId.HasValue && doc.UploaderId != Guid.Empty)
            {
                try
                {
                    await _notificationService.CreateNotificationAsync(new Application.DTOs.Notification.CreateNotificationRequest
                    {
                        UserId = doc.UploaderId.Value,
                        Title = "Tài liệu bị từ chối",
                        Message = $"Tài liệu \"{doc.Title}\" đã bị từ chối bởi quản trị viên. Vui lòng kiểm tra lại nội dung.",
                        Type = "rejection",
                        ReferenceId = doc.Id
                    });
                }
                catch (Exception notifyEx)
                {
                    _logger.LogWarning(notifyEx, "[AdminService] Failed to send rejection notification for document {Id}", id);
                }
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error rejecting document {Id}", id);
            return false;
        }
    }

    public async Task<bool> DeleteDocumentAsync(string id)
    {
        try
        {
            var docId = Guid.Parse(id);
            
            // 1. Get document to find file path and uploader
            var result = await _supabaseClient
                .From<Document>()
                .Where(d => d.Id == docId)
                .Get();

            if (result.Models.Count == 0) return false;
            var doc = result.Models[0];
            var uploaderId = doc.UploaderId;
            var docTitle = doc.Title;

            // 2. Delete file from Storage if exists
            if (!string.IsNullOrEmpty(doc.FileUrl))
            {
                try 
                {
                    var uri = new Uri(doc.FileUrl);
                    var segments = uri.Segments;
                    
                    int documentsIndex = -1;
                    for(int i = 0; i < segments.Length; i++)
                    {
                        if (segments[i].Trim('/').Equals("documents", StringComparison.OrdinalIgnoreCase))
                        {
                            documentsIndex = i;
                            break;
                        }
                    }

                    if (documentsIndex != -1 && documentsIndex < segments.Length - 1)
                    {
                        var filePath = string.Join("", segments.Skip(documentsIndex + 1));
                        _logger.LogInformation("[AdminService] Deleting file from storage: {FilePath}", filePath);
                        await _supabaseClient.Storage.From("documents").Remove(new List<string> { filePath });
                    }
                }
                catch (Exception storageEx)
                {
                    _logger.LogWarning("[AdminService] Warning: Failed to delete file from storage: {Message}", storageEx.Message);
                }
            }

            // 3. Delete from Database
            await _supabaseClient
                .From<Document>()
                .Where(d => d.Id == docId)
                .Delete();

            // Update admin grouped notification with new count
            try
            {
                var pendingDocsResult = await _supabaseClient
                    .From<Document>()
                    .Where(d => d.IsApproved == false)
                    .Get();
                
                int pendingCount = pendingDocsResult.Models.Count;
                
                await _notificationService.NotifyAdminsGroupedAsync(
                    "Tài liệu mới cần duyệt!",
                    pendingCount > 0 ? $"Có {pendingCount} tài liệu mới chờ xét duyệt" : "Không còn tài liệu nào chờ duyệt",
                    "admin_document_approval",
                    pendingCount
                );
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[AdminService] Failed to update grouped notification after deletion");
            }

            // 4. Notify uploader that their document was deleted
            if (uploaderId.HasValue && !string.IsNullOrEmpty(docTitle))
            {
                try
                {
                    await _notificationService.CreateNotificationAsync(new Application.DTOs.Notification.CreateNotificationRequest
                    {
                        UserId = uploaderId.Value,
                        Title = "Tài liệu bị xóa",
                        Message = $"Tài liệu \"{docTitle}\" đã bị quản trị viên xóa khỏi hệ thống.",
                        Type = "deletion",
                        ReferenceId = null
                    });
                }
                catch (Exception notifyEx)
                {
                    _logger.LogWarning("[AdminService] Warning: Failed to send notification: {Message}", notifyEx.Message);
                }
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error deleting document {Id}", id);
            return false;
        }
    }

    // ===== API SETTINGS MANAGEMENT =====
    public async Task<ApiSettingDto?> GetApiSettingAsync(string keyName)
    {
        try
        {
            var result = await _supabaseClient
                .From<ApiSettings>()
                .Where(s => s.KeyName == keyName)
                .Get();

            if (result.Models.Count == 0) return null;
            var setting = result.Models[0];

            return new ApiSettingDto
            {
                KeyName = setting.KeyName,
                KeyValue = setting.KeyValue,
                Description = setting.Description
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error getting API setting {KeyName}", keyName);
            return null;
        }
    }

    public async Task<bool> UpdateApiSettingAsync(string keyName, UpdateApiSettingRequest request)
    {
        try
        {
            var result = await _supabaseClient
                .From<ApiSettings>()
                .Where(s => s.KeyName == keyName)
                .Get();

            if (result.Models.Count == 0)
            {
                var newSetting = new ApiSettings
                {
                    KeyName = keyName,
                    KeyValue = request.KeyValue,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                await _supabaseClient.From<ApiSettings>().Insert(newSetting);
            }
            else
            {
                var setting = result.Models[0];
                setting.KeyValue = request.KeyValue;
                setting.UpdatedAt = DateTime.UtcNow;
                await _supabaseClient.From<ApiSettings>().Upsert(setting);
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error updating API setting {KeyName}", keyName);
            return false;
        }
    }

    // ===== USER AI USAGE MANAGEMENT =====

    public async Task<List<UserAiUsageDto>> GetAllUserAiUsagesAsync()
    {
        try
        {
            var usages = await _supabaseClient
                .From<UserAiUsage>()
                .Order("created_at", Supabase.Postgrest.Constants.Ordering.Descending)
                .Get();

            var userIds = usages.Models.Select(u => u.UserId).ToList();
            Dictionary<Guid, Profile> profileMap = new();
            if (userIds.Any())
            {
                var profilesResult = await _supabaseClient
                    .From<Profile>()
                    .Filter("id", Supabase.Postgrest.Constants.Operator.In, userIds)
                    .Get();
                profileMap = profilesResult.Models.ToDictionary(p => p.Id);
            }

            return usages.Models.Select(u =>
            {
                profileMap.TryGetValue(u.UserId, out var profile);
                return new UserAiUsageDto
                {
                    UserId = u.UserId.ToString(),
                    FullName = profile?.FullName,
                    Email = profile?.Email,
                    AvatarUrl = profile?.AvatarUrl,
                    ApiKey = u.ApiKey,
                    MessageLimit = u.MessageLimit,
                    MessagesUsed = u.MessagesUsed,
                    IsUnlocked = u.IsUnlocked,
                    CreatedAt = u.CreatedAt,
                    UpdatedAt = u.UpdatedAt
                };
            }).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error getting all user AI usages");
            return new List<UserAiUsageDto>();
        }
    }

    public async Task<PaginatedUserAiUsageResponse> GetUserAiUsagesPaginatedAsync(int page = 1, int pageSize = 10, string? search = null)
    {
        try
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 50);

            var usagesQuery = _supabaseClient
                .From<UserAiUsage>()
                .Order("created_at", Supabase.Postgrest.Constants.Ordering.Descending);

            long totalCount;
            if (!string.IsNullOrWhiteSpace(search))
            {
                var allUsages = await usagesQuery.Get();
                var allUserIds = allUsages.Models.Select(u => u.UserId).ToList();

                Dictionary<Guid, Profile> profileMap = new();
                if (allUserIds.Any())
                {
                    var allProfiles = await _supabaseClient
                        .From<Profile>()
                        .Filter("id", Supabase.Postgrest.Constants.Operator.In, allUserIds)
                        .Get();
                    profileMap = allProfiles.Models.ToDictionary(p => p.Id);
                }

                var matchedUsages = allUsages.Models.Where(u =>
                {
                    profileMap.TryGetValue(u.UserId, out var profile);
                    var name = profile?.FullName ?? "";
                    var email = profile?.Email ?? "";
                    var term = search.ToLower();
                    return name.ToLower().Contains(term) || email.ToLower().Contains(term);
                }).ToList();

                totalCount = matchedUsages.Count;
                var paged = matchedUsages
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToList();

                var pagedUserIds = paged.Select(u => u.UserId).ToList();
                Dictionary<Guid, Profile> pagedProfileMap = new();
                if (pagedUserIds.Any())
                {
                    var pagedProfiles = await _supabaseClient
                        .From<Profile>()
                        .Filter("id", Supabase.Postgrest.Constants.Operator.In, pagedUserIds)
                        .Get();
                    pagedProfileMap = pagedProfiles.Models.ToDictionary(p => p.Id);
                }

                return new PaginatedUserAiUsageResponse
                {
                    Items = paged.Select(u =>
                    {
                        pagedProfileMap.TryGetValue(u.UserId, out var profile);
                        return MapToDto(u, profile);
                    }).ToList(),
                    TotalCount = (int)totalCount,
                    Page = page,
                    PageSize = pageSize
                };
            }
            else
            {
                totalCount = await _supabaseClient
                    .From<UserAiUsage>()
                    .Count(Supabase.Postgrest.Constants.CountType.Exact);

                var offset = (page - 1) * pageSize;
                var usages = await _supabaseClient
                    .From<UserAiUsage>()
                    .Order("created_at", Supabase.Postgrest.Constants.Ordering.Descending)
                    .Range((int)offset, (int)(offset + pageSize - 1))
                    .Get();

                var userIds = usages.Models.Select(u => u.UserId).ToList();
                Dictionary<Guid, Profile> profileMap = new();
                if (userIds.Any())
                {
                    var profilesResult = await _supabaseClient
                        .From<Profile>()
                        .Filter("id", Supabase.Postgrest.Constants.Operator.In, userIds)
                        .Get();
                    profileMap = profilesResult.Models.ToDictionary(p => p.Id);
                }

                return new PaginatedUserAiUsageResponse
                {
                    Items = usages.Models.Select(u =>
                    {
                        profileMap.TryGetValue(u.UserId, out var profile);
                        return MapToDto(u, profile);
                    }).ToList(),
                    TotalCount = (int)totalCount,
                    Page = page,
                    PageSize = pageSize
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error getting paginated user AI usages");
            return new PaginatedUserAiUsageResponse { Page = page, PageSize = pageSize };
        }
    }

    public async Task<List<UserAiUsageDto>> GetUsersWithDedicatedApiAsync()
    {
        try
        {
            var all = await _supabaseClient.From<UserAiUsage>().Get();
            var withKeys = all.Models
                .Where(u => !string.IsNullOrWhiteSpace(u.ApiKey))
                .OrderByDescending(u => u.CreatedAt)
                .ToList();

            if (withKeys.Count == 0)
                return new List<UserAiUsageDto>();

            var userIds = withKeys.Select(u => u.UserId).Distinct().ToList();
            var profilesResult = await _supabaseClient
                .From<Profile>()
                .Filter("id", Supabase.Postgrest.Constants.Operator.In, userIds)
                .Get();
            var profileMap = profilesResult.Models.ToDictionary(p => p.Id);

            return withKeys.Select(u =>
            {
                profileMap.TryGetValue(u.UserId, out var profile);
                return MapToDto(u, profile);
            }).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error getting users with dedicated API keys");
            return new List<UserAiUsageDto>();
        }
    }

    private static UserAiUsageDto MapToDto(UserAiUsage u, Profile? profile) => new()
    {
        UserId = u.UserId.ToString(),
        FullName = profile?.FullName,
        Email = profile?.Email,
        AvatarUrl = profile?.AvatarUrl,
        ApiKey = u.ApiKey,
        MessageLimit = u.MessageLimit,
        MessagesUsed = u.MessagesUsed,
        IsUnlocked = u.IsUnlocked,
        CreatedAt = u.CreatedAt,
        UpdatedAt = u.UpdatedAt
    };

    public async Task<UserAiUsageDto?> GetUserAiUsageAsync(string userId)
    {
        try
        {
            var uid = Guid.Parse(userId);
            var result = await _supabaseClient
                .From<UserAiUsage>()
                .Where(u => u.UserId == uid)
                .Single();

            var profileResult = await _supabaseClient
                .From<Profile>()
                .Where(p => p.Id == uid)
                .Single();

            return new UserAiUsageDto
            {
                UserId = result.UserId.ToString(),
                FullName = profileResult?.FullName,
                Email = profileResult?.Email,
                AvatarUrl = profileResult?.AvatarUrl,
                ApiKey = result.ApiKey,
                MessageLimit = result.MessageLimit,
                MessagesUsed = result.MessagesUsed,
                IsUnlocked = result.IsUnlocked,
                CreatedAt = result.CreatedAt,
                UpdatedAt = result.UpdatedAt
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error getting user AI usage for {UserId}", userId);
            return null;
        }
    }

    public async Task<UserAiUsageDto?> UpdateUserAiUsageAsync(string userId, UpdateUserAiUsageRequest request)
    {
        try
        {
            var uid = Guid.Parse(userId);
            var result = await _supabaseClient
                .From<UserAiUsage>()
                .Where(u => u.UserId == uid)
                .Get();

            UserAiUsage usage;
            if (result.Models.Count == 0)
            {
                usage = new UserAiUsage
                {
                    Id = Guid.NewGuid(),
                    UserId = uid,
                    MessageLimit = request.MessageLimit ?? 10,
                    MessagesUsed = 0,
                    IsUnlocked = request.IsUnlocked ?? false,
                    ApiKey = request.ApiKey,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                await _supabaseClient.From<UserAiUsage>().Insert(usage);
            }
            else
            {
                usage = result.Models[0];
                if (request.MessageLimit.HasValue) usage.MessageLimit = request.MessageLimit.Value;
                if (request.ApiKey != null) usage.ApiKey = request.ApiKey; // non-null → update
                else if (request.ApiKey == null && result.Models[0].ApiKey != null) usage.ApiKey = null; // explicit null → clear
                if (request.IsUnlocked.HasValue) usage.IsUnlocked = request.IsUnlocked.Value;
                usage.UpdatedAt = DateTime.UtcNow;
                await _supabaseClient.From<UserAiUsage>().Upsert(usage);
            }

            var profileResult = await _supabaseClient
                .From<Profile>()
                .Where(p => p.Id == uid)
                .Single();

            return new UserAiUsageDto
            {
                UserId = usage.UserId.ToString(),
                FullName = profileResult?.FullName,
                Email = profileResult?.Email,
                AvatarUrl = profileResult?.AvatarUrl,
                ApiKey = usage.ApiKey,
                MessageLimit = usage.MessageLimit,
                MessagesUsed = usage.MessagesUsed,
                IsUnlocked = usage.IsUnlocked,
                CreatedAt = usage.CreatedAt,
                UpdatedAt = usage.UpdatedAt
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error updating user AI usage for {UserId}", userId);
            return null;
        }
    }

    public async Task<bool> ResetUserAiUsageAsync(string userId, ResetUserAiUsageRequest request)
    {
        try
        {
            var uid = Guid.Parse(userId);
            var result = await _supabaseClient
                .From<UserAiUsage>()
                .Where(u => u.UserId == uid)
                .Get();

            if (result.Models.Count == 0)
            {
                var newUsage = new UserAiUsage
                {
                    Id = Guid.NewGuid(),
                    UserId = uid,
                    MessageLimit = request.MessageLimit,
                    MessagesUsed = 0,
                    IsUnlocked = false,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                await _supabaseClient.From<UserAiUsage>().Insert(newUsage);
            }
            else
            {
                var usage = result.Models[0];
                usage.MessagesUsed = 0;
                usage.MessageLimit = request.MessageLimit;
                usage.IsUnlocked = false;
                usage.UpdatedAt = DateTime.UtcNow;
                await _supabaseClient.From<UserAiUsage>().Upsert(usage);
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error resetting user AI usage for {UserId}", userId);
            return false;
        }
    }

    // ===== AI UNLOCK REQUESTS =====

    public async Task<List<UnlockRequestDto>> GetUnlockRequestsAsync(string? status = null)
    {
        try
        {
            var query = _supabaseClient.From<AIUnlockRequest>().Order("created_at", Supabase.Postgrest.Constants.Ordering.Descending);
            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(r => r.Status == status);
            }

            var requests = await query.Get();
            var userIds = requests.Models.Select(r => r.UserId).Distinct().ToList();
            Dictionary<Guid, Profile> profileMap = new();
            if (userIds.Any())
            {
                var profilesResult = await _supabaseClient
                    .From<Profile>()
                    .Filter("id", Supabase.Postgrest.Constants.Operator.In, userIds)
                    .Get();
                profileMap = profilesResult.Models.ToDictionary(p => p.Id);
            }

            return requests.Models.Select(r =>
            {
                profileMap.TryGetValue(r.UserId, out var profile);
                return new UnlockRequestDto
                {
                    Id = r.Id,
                    UserId = r.UserId.ToString(),
                    UserFullName = profile?.FullName,
                    UserEmail = profile?.Email,
                    Message = r.Message,
                    Status = r.Status,
                    AdminNote = r.AdminNote,
                    CreatedAt = r.CreatedAt
                };
            }).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error getting unlock requests");
            return new List<UnlockRequestDto>();
        }
    }

    public async Task<UnlockRequestDto?> ApproveUnlockRequestAsync(string requestId, string? adminNote = null)
    {
        try
        {
            var reqId = Guid.Parse(requestId);
            var result = await _supabaseClient
                .From<AIUnlockRequest>()
                .Where(r => r.Id == reqId)
                .Single();

            result.Status = "approved";
            result.UpdatedAt = DateTime.UtcNow;
            await _supabaseClient.From<AIUnlockRequest>().Upsert(result);

            // Unlock the user's AI
            await UpdateUserAiUsageAsync(result.UserId.ToString(), new UpdateUserAiUsageRequest { IsUnlocked = true });

            // Notify user
            try
            {
                await _notificationService.CreateNotificationAsync(new Application.DTOs.Notification.CreateNotificationRequest
                {
                    UserId = result.UserId,
                    Title = "Yêu cầu mở khóa AI được duyệt",
                    Message = $"Yêu cầu mở khóa AI Chat của bạn đã được duyệt. Bạn có thể tiếp tục sử dụng AI Chat!",
                    Type = "ai_unlock_approved",
                    ReferenceId = result.Id
                });
            }
            catch (Exception notifyEx)
            {
                _logger.LogWarning(notifyEx, "[AdminService] Failed to notify user of AI unlock approval");
            }

            var profileResult = await _supabaseClient
                .From<Profile>()
                .Where(p => p.Id == result.UserId)
                .Single();

            return new UnlockRequestDto
            {
                Id = result.Id,
                UserId = result.UserId.ToString(),
                UserFullName = profileResult?.FullName,
                UserEmail = profileResult?.Email,
                Message = result.Message,
                Status = result.Status,
                AdminNote = result.AdminNote,
                CreatedAt = result.CreatedAt
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error approving unlock request {RequestId}", requestId);
            return null;
        }
    }

    public async Task<UnlockRequestDto?> RejectUnlockRequestAsync(string requestId, string? adminNote = null)
    {
        try
        {
            var reqId = Guid.Parse(requestId);
            var result = await _supabaseClient
                .From<AIUnlockRequest>()
                .Where(r => r.Id == reqId)
                .Single();

            result.Status = "rejected";
            result.AdminNote = adminNote;
            result.UpdatedAt = DateTime.UtcNow;
            await _supabaseClient.From<AIUnlockRequest>().Upsert(result);

            // Notify user
            try
            {
                await _notificationService.CreateNotificationAsync(new Application.DTOs.Notification.CreateNotificationRequest
                {
                    UserId = result.UserId,
                    Title = "Yêu cầu mở khóa AI bị từ chối",
                    Message = $"Yêu cầu mở khóa AI Chat của bạn đã bị từ chối. {adminNote ?? "Vui lòng liên hệ Admin để biết thêm chi tiết."}",
                    Type = "ai_unlock_rejected",
                    ReferenceId = result.Id
                });
            }
            catch (Exception notifyEx)
            {
                _logger.LogWarning(notifyEx, "[AdminService] Failed to notify user of AI unlock rejection");
            }

            var profileResult = await _supabaseClient
                .From<Profile>()
                .Where(p => p.Id == result.UserId)
                .Single();

            return new UnlockRequestDto
            {
                Id = result.Id,
                UserId = result.UserId.ToString(),
                UserFullName = profileResult?.FullName,
                UserEmail = profileResult?.Email,
                Message = result.Message,
                Status = result.Status,
                AdminNote = result.AdminNote,
                CreatedAt = result.CreatedAt
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[AdminService] Error rejecting unlock request {RequestId}", requestId);
            return null;
        }
    }
}
