using System.Security.Claims;
using HueSTD.Application.Exceptions;

namespace HueSTD.API.Auth;

public static class ClaimsPrincipalExtensions
{
    public static string GetRequiredUserIdValue(this ClaimsPrincipal user)
    {
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ??
                     user.FindFirstValue("sub");

        if (string.IsNullOrWhiteSpace(userId))
        {
            throw new UnauthorizedException("Authenticated user identifier is missing.");
        }

        return userId;
    }

    public static Guid GetRequiredUserId(this ClaimsPrincipal user)
    {
        var rawUserId = user.GetRequiredUserIdValue();
        if (!Guid.TryParse(rawUserId, out var userId))
        {
            throw new UnauthorizedException("Authenticated user identifier is invalid.");
        }

        return userId;
    }

    public static string? GetEmail(this ClaimsPrincipal user)
    {
        return user.FindFirstValue(ClaimTypes.Email) ??
               user.FindFirstValue("email");
    }

    public static string GetAppRole(this ClaimsPrincipal user)
    {
        return user.FindFirstValue(AppClaimTypes.AppRole) ??
               user.FindFirstValue(ClaimTypes.Role) ??
               "user";
    }
}
