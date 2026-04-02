namespace HueSTD.Application.Exceptions;

public sealed class BadRequestException(string detail)
    : AppException(400, "Bad Request", detail);
