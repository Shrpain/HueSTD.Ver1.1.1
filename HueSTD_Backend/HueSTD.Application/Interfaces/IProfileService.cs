using HueSTD.Application.DTOs.Profile;

namespace HueSTD.Application.Interfaces;

public interface IProfileService
{
    Task<PaginatedResult<DocumentDto>> GetUserDocumentsAsync(string userId, int page, int pageSize);
    Task<ProfileStatsDto> GetUserProfileStatsAsync(string userId);
    Task<int> GetUserRankAsync(Guid userId);
}
