using HueSTD.Domain.Entities;

namespace HueSTD.Application.Interfaces;

public interface IContributionScoringService
{
    Task<Profile?> AddPointsAsync(Guid userId, int points, string? reason = null, string? referenceType = null, Guid? referenceId = null);
    Task<Profile?> AddDocumentApprovalPointsAsync(Guid? uploaderId);
    Task<Profile?> AddDocumentViewPointsAsync(Guid? uploaderId, Guid? actorUserId = null);
    Task<Profile?> AddDocumentDownloadPointsAsync(Guid? uploaderId, Guid? actorUserId = null);
    Task<Profile?> AddCommentPointsAsync(Guid userId);
}
