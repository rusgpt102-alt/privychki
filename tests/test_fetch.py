import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / 'fetch.py'


class FetchTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(SCRIPT.exists(), 'Сборщик fetch.py ещё не создан')
        spec = importlib.util.spec_from_file_location('weather_fetch', SCRIPT)
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)
        self.payload = {
            'current': {'time': '2026-11-19T12:00', 'temperature_2m': -7.5,
                        'apparent_temperature': -12.0, 'precipitation': 0.2,
                        'weather_code': 71, 'wind_speed_10m': 3.4},
            'daily': {'time': ['2026-11-19'], 'temperature_2m_max': [-5.0],
                      'temperature_2m_min': [-10.0], 'precipitation_probability_max': [80],
                      'sunrise': ['2026-11-19T08:45'], 'sunset': ['2026-11-19T16:40']},
        }

    def test_saves_public_weather_and_update_date(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'data.json'
            with patch.object(self.module, 'load_source', return_value=self.payload):
                self.assertTrue(self.module.update(target))
            data = json.loads(target.read_text(encoding='utf-8'))
            self.assertEqual(data['city'], 'Екатеринбург')
            self.assertEqual(data['current']['temperature_c'], -7.5)
            self.assertEqual(data['current']['wind_ms'], 3.4)
            self.assertEqual(data['today']['precipitation_probability_percent'], 80)
            self.assertTrue(data['updated_at'].endswith('Z'))
            self.assertEqual(data['timezone'], 'Asia/Yekaterinburg')

    def test_network_failure_keeps_old_file_unchanged(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'data.json'
            original = b'{"previous":true}\n'
            target.write_bytes(original)
            with patch.object(self.module, 'load_source', side_effect=TimeoutError):
                self.assertFalse(self.module.update(target))
            self.assertEqual(target.read_bytes(), original)

    def test_bad_source_keeps_old_file_unchanged(self):
        for bad in ({}, {'current': None}, {**self.payload, 'current': {**self.payload['current'], 'temperature_2m': None}},
                    {**self.payload, 'daily': {**self.payload['daily'], 'sunrise': ['bad-date']}}):
            with self.subTest(payload=bad), tempfile.TemporaryDirectory() as folder:
                target = Path(folder) / 'data.json'
                target.write_bytes(b'old data')
                with patch.object(self.module, 'load_source', return_value=bad):
                    self.assertFalse(self.module.update(target))
                self.assertEqual(target.read_bytes(), b'old data')

    def test_first_failure_does_not_create_fake_weather(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'data.json'
            with patch.object(self.module, 'load_source', side_effect=TimeoutError):
                self.assertFalse(self.module.update(target))
            self.assertFalse(target.exists())


if __name__ == '__main__':
    unittest.main()
