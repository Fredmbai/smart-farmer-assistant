import requests
from django.conf import settings

from .models import WeatherData

_MOCK_CURRENT = {
    'main': {'temp': 17.5, 'humidity': 75},
    'weather': [{'main': 'Clouds'}],
    'wind': {'speed': 3.2},
}

_MOCK_FORECAST_ENTRY = {
    'pop': 0.3,
    'main': {'temp_min': 15.0},
    'rain': {'3h': 1.2},
    'dt_txt': '2026-01-01 00:00:00',
}

_MOCK_FORECAST = {
    'list': [_MOCK_FORECAST_ENTRY] * 3 + [{'pop': 0.3, 'main': {'temp_min': 15.0}, 'dt_txt': ''}] * 13
}


class WeatherService:

    def fetch_for_farm(self, farm):
        if not farm.latitude or not farm.longitude:
            return None

        lat, lon = float(farm.latitude), float(farm.longitude)
        current = self._fetch_current(lat, lon)
        forecast = self._fetch_forecast(lat, lon)

        if not current or not forecast:
            return None

        return self._parse_and_save(farm, current, forecast)

    def _fetch_current(self, lat, lon):
        if settings.DEBUG and not settings.OPENWEATHER_API_KEY:
            return _MOCK_CURRENT

        url = 'https://api.openweathermap.org/data/2.5/weather'
        try:
            resp = requests.get(url, params={
                'lat': lat, 'lon': lon,
                'appid': settings.OPENWEATHER_API_KEY,
                'units': 'metric',
            }, timeout=10)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException:
            return None

    def _fetch_forecast(self, lat, lon):
        if settings.DEBUG and not settings.OPENWEATHER_API_KEY:
            return _MOCK_FORECAST

        url = 'https://api.openweathermap.org/data/2.5/forecast'
        try:
            resp = requests.get(url, params={
                'lat': lat, 'lon': lon,
                'appid': settings.OPENWEATHER_API_KEY,
                'units': 'metric',
            }, timeout=10)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException:
            return None

    def _parse_and_save(self, farm, current, forecast):
        temperature_current = current['main']['temp']
        humidity = current['main']['humidity']
        condition = current['weather'][0]['main']
        wind_speed = current['wind']['speed']

        entries = forecast.get('list', [])[:16]

        pops_all   = [e.get('pop', 0) for e in entries]
        pops_24h   = [e.get('pop', 0) for e in entries[:8]]
        rain_total = sum(e.get('rain', {}).get('3h', 0) for e in entries)
        frost = 1.0 if any(
            e.get('main', {}).get('temp_min', 99) <= 2.0 for e in entries
        ) else 0.0

        return WeatherData.objects.create(
            farm=farm,
            temperature_current=temperature_current,
            humidity=humidity,
            condition=condition,
            wind_speed=wind_speed,
            rainfall_probability_48h=max(pops_all) if pops_all else None,
            rainfall_probability_24h=max(pops_24h) if pops_24h else None,
            rainfall_mm_expected=round(rain_total, 2),
            frost_probability=frost,
            raw_current=current,
            raw_forecast=forecast,
        )
