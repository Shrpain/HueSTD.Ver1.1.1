using HueSTD.Application.Interfaces;
using HueSTD.Domain.Entities;
using HueSTD.Domain.Interfaces;

namespace HueSTD.Application.Services;

public class WeatherForecastService : IWeatherForecastService
{
    private readonly IWeatherForecastRepository _repository;

    public WeatherForecastService(IWeatherForecastRepository repository)
    {
        _repository = repository;
    }

    public IEnumerable<WeatherForecast> GetForecasts()
    {
        return _repository.GetForecasts();
    }
}
