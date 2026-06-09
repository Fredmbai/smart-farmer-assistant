import requests
from django.conf import settings

from .models import WeatherData

_CONDITION_EMOJI = {
    'Clear':        '☀️',
    'Clouds':       '☁️',
    'Rain':         '🌧️',
    'Drizzle':      '🌦️',
    'Thunderstorm': '⛈️',
    'Mist':         '🌫️',
    'Fog':          '🌫️',
    'Haze':         '🌫️',
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

    def _mock_current(self):
        return {
            'main': {'temp': 18.5, 'humidity': 75},
            'weather': [{'main': 'Clouds'}],
            'wind': {'speed': 2.8},
        }

    def _mock_forecast(self):
        # 16 entries = 48h (3h intervals); Kenya highland conditions
        # First 8 entries have pop=0.65 (afternoon highland rains)
        # 6 entries have rain.3h=2.5mm; temp_min=14.0 (never freezing)
        return {
            'list': [
                {'pop': 0.65, 'main': {'temp_min': 14.0}, 'rain': {'3h': 2.5}, 'dt_txt': ''},
                {'pop': 0.65, 'main': {'temp_min': 14.0}, 'rain': {'3h': 2.5}, 'dt_txt': ''},
                {'pop': 0.65, 'main': {'temp_min': 14.0}, 'rain': {'3h': 2.5}, 'dt_txt': ''},
                {'pop': 0.65, 'main': {'temp_min': 14.0}, 'rain': {'3h': 2.5}, 'dt_txt': ''},
                {'pop': 0.65, 'main': {'temp_min': 14.0}, 'rain': {'3h': 2.5}, 'dt_txt': ''},
                {'pop': 0.65, 'main': {'temp_min': 14.0}, 'rain': {'3h': 2.5}, 'dt_txt': ''},
                {'pop': 0.65, 'main': {'temp_min': 14.0}, 'dt_txt': ''},
                {'pop': 0.65, 'main': {'temp_min': 14.0}, 'dt_txt': ''},
                {'pop': 0.30, 'main': {'temp_min': 14.5}, 'dt_txt': ''},
                {'pop': 0.30, 'main': {'temp_min': 14.5}, 'dt_txt': ''},
                {'pop': 0.20, 'main': {'temp_min': 15.0}, 'dt_txt': ''},
                {'pop': 0.20, 'main': {'temp_min': 15.0}, 'dt_txt': ''},
                {'pop': 0.15, 'main': {'temp_min': 15.0}, 'dt_txt': ''},
                {'pop': 0.15, 'main': {'temp_min': 15.0}, 'dt_txt': ''},
                {'pop': 0.10, 'main': {'temp_min': 15.5}, 'dt_txt': ''},
                {'pop': 0.10, 'main': {'temp_min': 15.5}, 'dt_txt': ''},
            ]
        }

    def _fetch_current(self, lat, lon):
        if not settings.OPENWEATHER_API_KEY:
            return self._mock_current()

        try:
            response = requests.get(
                'https://api.openweathermap.org/data/2.5/weather',
                params={
                    'lat': lat,
                    'lon': lon,
                    'appid': settings.OPENWEATHER_API_KEY,
                    'units': 'metric',
                },
                timeout=10,
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Weather API error (current): {e}")
            return self._mock_current()

    def _fetch_forecast(self, lat, lon):
        if not settings.OPENWEATHER_API_KEY:
            return self._mock_forecast()

        try:
            response = requests.get(
                'https://api.openweathermap.org/data/2.5/forecast',
                params={
                    'lat': lat,
                    'lon': lon,
                    'appid': settings.OPENWEATHER_API_KEY,
                    'units': 'metric',
                },
                timeout=10,
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Weather API error (forecast): {e}")
            return self._mock_forecast()

    def _parse_and_save(self, farm, current, forecast):
        temperature_current = current['main']['temp']
        humidity = current['main']['humidity']
        condition = current['weather'][0]['main']
        wind_speed = current['wind']['speed']

        entries = forecast.get('list', [])[:16]

        pops_all   = [e.get('pop', 0) for e in entries]
        pops_24h   = [e.get('pop', 0) for e in entries[:8]]
        rain_total = sum(e.get('rain', {}).get('3h', 0) for e in entries)

        # Frost is rare in Kenya — only trigger at very high altitude (temp_min <= 4°C)
        frost = 1.0 if any(
            e.get('main', {}).get('temp_min', 99) <= 4.0 for e in entries
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

    def get_weather_summary(self, farm):
        """Return a human-readable weather dict for the mobile dashboard."""
        weather = WeatherData.objects.filter(farm=farm).first()
        if not weather:
            weather = self.fetch_for_farm(farm)
        if not weather:
            return None

        temp    = float(weather.temperature_current or 18)
        hum     = float(weather.humidity or 65)
        rain48  = float(weather.rainfall_probability_48h or 0)
        rain24  = float(weather.rainfall_probability_24h or 0)
        rain_mm = float(weather.rainfall_mm_expected or 0)
        frost   = float(weather.frost_probability or 0)
        condition = weather.condition or 'Clouds'

        emoji = _CONDITION_EMOJI.get(condition, '🌤️')

        if rain48 >= 0.7 and rain_mm > 10:
            advisory = 'Heavy rain expected — check field drainage'
            advisory_type = 'rain_heavy'
        elif rain48 >= 0.5:
            advisory = 'Rain likely — hold fertilizer, delay irrigation'
            advisory_type = 'rain_likely'
        elif temp > 28 and hum < 50:
            advisory = 'Hot dry conditions — monitor soil moisture closely'
            advisory_type = 'hot_dry'
        elif temp < 12:
            advisory = 'Cool conditions — monitor for Late Blight risk'
            advisory_type = 'cool'
        else:
            advisory = 'Good conditions for fieldwork'
            advisory_type = 'good'

        return {
            'temperature':      round(temp, 1),
            'humidity':         round(hum, 1),
            'condition':        condition,
            'condition_emoji':  emoji,
            'rain_chance_24h':  round(rain24 * 100),
            'rain_chance_48h':  round(rain48 * 100),
            'rain_expected_mm': round(rain_mm, 1),
            'frost_risk':       frost >= 1.0,
            'farming_advisory': advisory,
            'advisory_type':    advisory_type,
        }
