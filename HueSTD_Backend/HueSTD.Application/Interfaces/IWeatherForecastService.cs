using HueSTD.Domain.Entities;

namespace HueSTD.Application.Interfaces;

public interface IWeatherForecastService
{
    IEnumerable<WeatherForecast> GetForecasts();
}
