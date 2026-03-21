using HueSTD.Domain.Entities;

namespace HueSTD.Domain.Interfaces;

public interface IWeatherForecastRepository
{
    IEnumerable<WeatherForecast> GetForecasts();
}
