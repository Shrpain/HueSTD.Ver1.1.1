using HueSTD.API.Auth;
using Microsoft.AspNetCore.Mvc;

namespace HueSTD.API.Controllers;

public abstract class ApiControllerBase : ControllerBase
{
    protected Guid CurrentUserId => User.GetRequiredUserId();

    protected string CurrentUserIdValue => User.GetRequiredUserIdValue();

    protected string? CurrentUserEmail => User.GetEmail();

    protected string CurrentUserRole => User.GetAppRole();
}
