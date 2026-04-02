using System.Security.Claims;
using HueSTD.Domain.Entities;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Supabase;

namespace HueSTD.Infrastructure.Services;

public sealed class SupabaseProfileClaimsTransformation(
    Client supabaseClient,
    ILogger<SupabaseProfileClaimsTransformation> logger) : IClaimsTransformation
{
    private const string AppRoleClaimType = "app_role";

    public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity?.IsAuthenticated != true)
        {
            return principal;
        }

        if (principal.HasClaim(claim => claim.Type == AppRoleClaimType))
        {
            return principal;
        }

        var identity = principal.Identities.FirstOrDefault(identity => identity.IsAuthenticated);
        if (identity is null)
        {
            return principal;
        }

        var subject = principal.FindFirst("sub")?.Value ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(subject, out var userId))
        {
            logger.LogWarning("Authenticated principal is missing a valid subject claim.");
            return principal;
        }

        var profile = await supabaseClient
            .From<Profile>()
            .Where(profile => profile.Id == userId)
            .Single();

        var appRole = profile?.Role ?? "user";
        identity.AddClaim(new Claim(AppRoleClaimType, appRole));
        identity.AddClaim(new Claim(ClaimTypes.Role, appRole));

        if (!principal.HasClaim(claim => claim.Type == ClaimTypes.NameIdentifier))
        {
            identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, userId.ToString()));
        }

        if (!string.IsNullOrWhiteSpace(profile?.Email) &&
            !principal.HasClaim(claim => claim.Type == ClaimTypes.Email))
        {
            identity.AddClaim(new Claim(ClaimTypes.Email, profile.Email));
        }

        if (!string.IsNullOrWhiteSpace(profile?.FullName) &&
            !principal.HasClaim(claim => claim.Type == ClaimTypes.Name))
        {
            identity.AddClaim(new Claim(ClaimTypes.Name, profile.FullName));
        }

        return principal;
    }
}
