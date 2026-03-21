using HueSTD.Application.DTOs.Admin;
using HueSTD.Application.DTOs.AI;

namespace HueSTD.Application.Interfaces;

public interface IAdminService
{
    Task<AdminStatsDto> GetDashboardStatsAsync();
    
    // User Management
    Task<List<UserListItemDto>> GetAllUsersAsync();
    Task<UserDetailDto?> GetUserByIdAsync(string id);
    Task<UserDetailDto> CreateUserAsync(CreateUserRequest request);
    Task<UserDetailDto?> UpdateUserAsync(string id, UpdateUserRequest request);
    Task<bool> DeleteUserAsync(string id);

    // Document Management
    Task<List<DocumentListItemDto>> GetAllDocumentsAsync();
    Task<PaginatedDocumentsResponse> GetDocumentsPaginatedAsync(int page = 1, int pageSize = 20, bool? isApproved = null, string? search = null, string? documentType = null, string? school = null);
    Task<DocumentDetailDto?> GetDocumentByIdAsync(string id);
    Task<DocumentDetailDto?> UpdateDocumentAsync(string id, UpdateDocumentRequest request);
    Task<bool> ApproveDocumentAsync(string id);
    Task<bool> RejectDocumentAsync(string id);
    Task<bool> DeleteDocumentAsync(string id);

    // API Settings Management
    Task<ApiSettingDto?> GetApiSettingAsync(string keyName);
    Task<bool> UpdateApiSettingAsync(string keyName, UpdateApiSettingRequest request);

    // User AI Usage Management
    Task<List<UserAiUsageDto>> GetAllUserAiUsagesAsync();
    Task<PaginatedUserAiUsageResponse> GetUserAiUsagesPaginatedAsync(int page = 1, int pageSize = 10, string? search = null);
    Task<List<UserAiUsageDto>> GetUsersWithDedicatedApiAsync();
    Task<UserAiUsageDto?> GetUserAiUsageAsync(string userId);
    Task<UserAiUsageDto?> UpdateUserAiUsageAsync(string userId, UpdateUserAiUsageRequest request);
    Task<bool> ResetUserAiUsageAsync(string userId, ResetUserAiUsageRequest request);

    // AI Unlock Requests
    Task<List<UnlockRequestDto>> GetUnlockRequestsAsync(string? status = null);
    Task<UnlockRequestDto?> ApproveUnlockRequestAsync(string requestId, string? adminNote = null);
    Task<UnlockRequestDto?> RejectUnlockRequestAsync(string requestId, string? adminNote = null);
}
