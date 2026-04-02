namespace HueSTD.Application.Exceptions;

public sealed class ForbiddenException(string detail = "You do not have permission to perform this action.")
    : AppException(403, "Forbidden", detail);
