"""Public weather only. No API keys or third-party Python packages."""
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen


SOURCE = 'https://api.open-meteo.com/v1/forecast?' + urlencode({
    'latitude': 56.8389, 'longitude': 60.6057,
    'current': 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
    'daily': 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
    'wind_speed_unit': 'ms', 'timezone': 'Asia/Yekaterinburg', 'forecast_days': 1,
})
TARGET = Path(__file__).resolve().with_name('data.json')


def load_source():
    request = Request(SOURCE, headers={'User-Agent': 'Privychki-public-weather/1.0'})
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def number(value, low, high):
    if type(value) not in (int, float) or not math.isfinite(value) or not low <= value <= high:
        raise ValueError('Invalid weather value')
    return value


def local_time(value):
    parsed = datetime.strptime(value, '%Y-%m-%dT%H:%M')
    return parsed.isoformat(timespec='minutes') + '+05:00'


def build_data(payload):
    current, daily = payload['current'], payload['daily']
    day = datetime.strptime(daily['time'][0], '%Y-%m-%d').date().isoformat()
    return {
        'version': 1,
        'city': 'Екатеринбург',
        'timezone': 'Asia/Yekaterinburg',
        'updated_at': datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z'),
        'source': {'name': 'Open-Meteo', 'url': 'https://open-meteo.com/',
                   'attribution': 'Weather data by Open-Meteo.com (CC BY 4.0)'},
        'current': {
            'time': local_time(current['time']),
            'temperature_c': number(current['temperature_2m'], -100, 70),
            'feels_like_c': number(current['apparent_temperature'], -120, 90),
            'precipitation_mm': number(current['precipitation'], 0, 1000),
            'weather_code': number(current['weather_code'], 0, 99),
            'wind_ms': number(current['wind_speed_10m'], 0, 150),
        },
        'today': {
            'date': day,
            'temperature_min_c': number(daily['temperature_2m_min'][0], -100, 70),
            'temperature_max_c': number(daily['temperature_2m_max'][0], -100, 70),
            'precipitation_probability_percent': number(daily['precipitation_probability_max'][0], 0, 100),
            'sunrise': local_time(daily['sunrise'][0]),
            'sunset': local_time(daily['sunset'][0]),
        },
    }


def update(target=TARGET):
    try:
        data = build_data(load_source())
        serialized = json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + '\n'
    except (OSError, ValueError, TypeError, KeyError, IndexError) as error:
        # A failed source must never advance updated_at or touch the old file.
        print(f'::warning::Weather unavailable ({type(error).__name__}); previous data.json kept.')
        return False
    temporary = target.with_name(target.name + '.tmp')
    with temporary.open('w', encoding='utf-8', newline='\n') as output:
        output.write(serialized)
        output.flush()
        os.fsync(output.fileno())
    os.replace(temporary, target)
    print('Weather saved to data.json.')
    return True


if __name__ == '__main__':
    success = update()
    # Existing public data keeps the deployment usable during an API outage.
    sys.exit(0 if success or TARGET.exists() else 1)
