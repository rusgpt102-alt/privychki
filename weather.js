'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const status = $('weather-status');
  const details = $('weather-details');
  const clock = new Intl.DateTimeFormat('ru', {hour:'2-digit',minute:'2-digit',timeZone:'Asia/Yekaterinburg'});
  const stamp = new Intl.DateTimeFormat('ru', {day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Yekaterinburg'});
  const decimal = new Intl.NumberFormat('ru', {maximumFractionDigits:1});
  const temperature = n => `${decimal.format(n).replace('-', '−')} °C`;
  const finite = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  let lastData = null, loading = false;

  function validate(data) {
    const c = data?.current, d = data?.today;
    if (data?.version !== 1 || !validTime(data.updated_at) || !c || !d ||
        !finite(c.temperature_c,-100,70) || !finite(c.feels_like_c,-120,90) ||
        !finite(c.wind_ms,0,150) || !finite(c.weather_code,0,99) ||
        !finite(d.temperature_min_c,-100,70) || !finite(d.temperature_max_c,-100,70) ||
        !finite(d.precipitation_probability_percent,0,100) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || !validTime(d.sunrise) || !validTime(d.sunset) ||
        Date.parse(data.updated_at) > Date.now() + 300000) throw Error('Invalid weather data');
    return data;
  }

  function description(code) {
    if (code === 0) return 'Ясно';
    if (code <= 3) return 'Облачно';
    if (code === 45 || code === 48) return 'Туман';
    if (code >= 51 && code <= 57) return 'Морось';
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'Дождь';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'Снег';
    if (code >= 95) return 'Гроза';
    return 'Погодные условия';
  }

  function render(data, failed = false) {
    const c = data.current, d = data.today;
    $('weather-temperature').textContent = temperature(c.temperature_c);
    $('weather-summary').textContent = `${description(c.weather_code)}. Ощущается как ${temperature(c.feels_like_c)}. Ветер ${decimal.format(c.wind_ms)} м/с.`;
    $('weather-forecast').textContent = `Прогноз на ${new Intl.DateTimeFormat('ru',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(d.date+'T12:00:00Z'))}: от ${temperature(d.temperature_min_c)} до ${temperature(d.temperature_max_c)}. Вероятность осадков ${decimal.format(d.precipitation_probability_percent)}%.`;
    $('weather-daylight').textContent = `Восход ${clock.format(new Date(d.sunrise))}, закат ${clock.format(new Date(d.sunset))}.`;
    $('weather-updated').textContent = `Обновлено ${stamp.format(new Date(data.updated_at))} · Екатеринбург, UTC+5`;
    details.hidden = false;
    const stale = Date.now() - Date.parse(data.updated_at) > 6 * 60 * 60 * 1000;
    status.textContent = failed ? 'Не удалось обновить погоду. Показаны последние сохранённые данные.' : stale ? 'Данные устарели. Показано последнее доступное обновление.' : '';
    if (failed && stale) status.textContent += ' Данные устарели.';
  }

  async function refresh() {
    if (loading) return;
    loading = true;
    try {
      const response = await fetch('./data.json', {cache:'no-store', signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw Error('Weather unavailable');
      lastData = validate(await response.json());
      render(lastData, response.headers?.get('X-Weather-Cache') === 'fallback');
    } catch {
      if (lastData) render(lastData, true);
      else {
        details.hidden = true;
        status.textContent = 'Не удалось загрузить погоду. Проверь подключение к интернету и открой приложение снова. Привычки доступны.';
      }
    } finally { loading = false; }
  }

  refresh();
  window.addEventListener('focus', refresh);
  window.addEventListener('online', refresh);
  setInterval(refresh, 15 * 60 * 1000);
})();
