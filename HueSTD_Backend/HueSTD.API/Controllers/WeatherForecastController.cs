using HueSTD.Application.Interfaces;
using HueSTD.Domain.Entities;
using Microsoft.AspNetCore.Mvc;

namespace HueSTD.API.Controllers;

[ApiController]
[Route("[controller]")]
public class WeatherForecastController : ControllerBase
{
    private readonly IWeatherForecastService _service;
    private readonly ILogger<WeatherForecastController> _logger;

    public WeatherForecastController(IWeatherForecastService service, ILogger<WeatherForecastController> logger)
    {
        _service = service;
        _logger = logger;
    }

    [HttpGet(Name = "GetWeatherForecast")]
    public IEnumerable<WeatherForecast> Get()
    {
        return _service.GetForecasts();
    }
}
