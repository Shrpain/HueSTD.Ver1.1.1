namespace HueSTD.Application.Exceptions;

public sealed class UnauthorizedException(string detail = "Authentication is required.")
    : AppException(401, "Unauthorized", detail);
