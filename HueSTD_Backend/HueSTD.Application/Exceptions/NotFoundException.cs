namespace HueSTD.Application.Exceptions;

public sealed class NotFoundException(string detail)
    : AppException(404, "Not Found", detail);
