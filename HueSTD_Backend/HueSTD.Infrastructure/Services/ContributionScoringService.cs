using HueSTD.Application.Interfaces;
using HueSTD.Domain.Entities;
using Microsoft.Extensions.Logging;
using Supabase;

namespace HueSTD.Infrastructure.Services;

public class ContributionScoringService : IContributionScoringService
{
    private readonly Client _supabaseClient;
    private readonly ILogger<ContributionScoringService> _logger;

    // Points per contribution type
    private const int PointsDocumentApproval = 50;
    private const int PointsDocumentDownload = 5;
    private const int PointsDocumentView = 1;
    private const int PointsComment = 5;

    // Badge thresholds
    private const int BadgeContributorThreshold = 100;
    private const int BadgeTopContributorThreshold = 500;
    private const int BadgeEliteThreshold = 1000;

    public ContributionScoringService(Client supabaseClient, ILogger<ContributionScoringService> logger)
    {
        _supabaseClient = supabaseClient;
        _logger = logger;
    }

    public async Task<Profile?> AddPointsAsync(Guid userId, int points, string? reason = null, string? referenceType = null, Guid? referenceId = null)
    {
        if (userId == Guid.Empty || points == 0) return null;

        try
        {
            var result = await _supabaseClient
                .From<Profile>()
                .Where(p => p.Id == userId)
                .Get();

            var profile = result.Models.FirstOrDefault();
            if (profile == null)
            {
                _logger.LogWarning("[ContributionScoring] Profile not found for user {UserId}", userId);
                return null;
            }

            profile.Points += points;
            profile.Badge = CalculateBadge(profile.Points);

            await _supabaseClient.From<Profile>().Upsert(profile);

            // Log point transaction for audit/history
            try
            {
                var transaction = new PointTransaction
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    PointsDelta = points,
                    Reason = reason ?? "contribution",
                    ReferenceType = referenceType,
                    ReferenceId = referenceId,
                    CreatedAt = DateTime.UtcNow
                };
                await _supabaseClient.From<PointTransaction>().Insert(transaction);
            }
            catch (Exception logEx)
            {
                _logger.LogWarning(logEx, "[ContributionScoring] Failed to log point transaction for user {UserId}", userId);
            }

            _logger.LogInformation(
                "[ContributionScoring] Added {Points} points to user {UserId}. New total: {Total}, Badge: {Badge}",
                points, userId, profile.Points, profile.Badge);

            return profile;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[ContributionScoring] Error adding points to user {UserId}", userId);
            return null;
        }
    }

    public async Task<Profile?> AddDocumentApprovalPointsAsync(Guid? uploaderId)
    {
        if (!uploaderId.HasValue || uploaderId == Guid.Empty) return null;
        return await AddPointsAsync(uploaderId.Value, PointsDocumentApproval, "document_approved", "document", uploaderId);
    }

    public async Task<Profile?> AddDocumentViewPointsAsync(Guid? uploaderId, Guid? actorUserId = null)
    {
        if (!uploaderId.HasValue || uploaderId == Guid.Empty) return null;
        // Prevent self-award: don't grant points when the viewer IS the uploader
        if (actorUserId.HasValue && uploaderId.Value == actorUserId.Value) return null;
        return await AddPointsAsync(uploaderId.Value, PointsDocumentView, "document_view", "document", uploaderId);
    }

    public async Task<Profile?> AddDocumentDownloadPointsAsync(Guid? uploaderId, Guid? actorUserId = null)
    {
        if (!uploaderId.HasValue || uploaderId == Guid.Empty) return null;
        // Prevent self-award: don't grant points when the downloader IS the uploader
        if (actorUserId.HasValue && uploaderId.Value == actorUserId.Value) return null;
        return await AddPointsAsync(uploaderId.Value, PointsDocumentDownload, "document_download", "document", uploaderId);
    }

    public async Task<Profile?> AddCommentPointsAsync(Guid userId)
    {
        return await AddPointsAsync(userId, PointsComment, "document_comment", "document_comment", null);
    }

    private static string CalculateBadge(int points)
    {
        if (points >= BadgeEliteThreshold) return "Elite Contributor";
        if (points >= BadgeTopContributorThreshold) return "Top Contributor";
        if (points >= BadgeContributorThreshold) return "Contributor";
        return "Member";
    }
}
