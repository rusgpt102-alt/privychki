const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {test} = require('node:test');
const path = require('node:path');
const script = path.join(__dirname, '..', 'weather.js');

async function run(response) {
  assert.ok(fs.existsSync(script), 'weather.js ещё не создан');
  const elements = new Map();
  const document = {getElementById(id) {
    if (!elements.has(id)) elements.set(id, {textContent:'', hidden:true});
    return elements.get(id);
  }};
  const context = {document, Intl, Date, Number, fetch: async () => response,
    AbortSignal, setInterval: () => 1, window: {addEventListener() {}}};
  vm.runInNewContext(fs.readFileSync(script, 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  return elements;
}

test('HTTP error shows a readable message instead of an empty card', async () => {
  const elements = await run({ok:false});
  assert.match(elements.get('weather-status').textContent, /Не удалось загрузить погоду/);
  assert.equal(elements.get('weather-details').hidden, true);
});

test('invalid JSON fields are not shown as weather', async () => {
  const elements = await run({ok:true, json:async () => ({version:1})});
  assert.match(elements.get('weather-status').textContent, /Не удалось загрузить погоду/);
});

test('weather and update time are visible and stale weather is labelled', async () => {
  const data = {version:1, updated_at:'2020-01-01T08:00:00Z',
    current:{temperature_c:-7.5,feels_like_c:-12,wind_ms:3.4,weather_code:71},
    today:{date:'2020-01-01',temperature_min_c:-10,temperature_max_c:-5,
      precipitation_probability_percent:80,sunrise:'2020-01-01T08:45:00+05:00',sunset:'2020-01-01T16:40:00+05:00'}};
  const elements = await run({ok:true,json:async () => data});
  assert.equal(elements.get('weather-details').hidden, false);
  assert.match(elements.get('weather-temperature').textContent, /−7,5 °C/);
  assert.match(elements.get('weather-updated').textContent, /Обновлено/);
  assert.match(elements.get('weather-status').textContent, /устарели/);
});

test('a service worker fallback warns even when saved weather is recent', async () => {
  const data = {version:1,updated_at:new Date().toISOString(),
    current:{temperature_c:1,feels_like_c:0,wind_ms:2,weather_code:0},
    today:{date:'2026-11-19',temperature_min_c:-2,temperature_max_c:3,
      precipitation_probability_percent:10,sunrise:'2026-11-19T08:45:00+05:00',sunset:'2026-11-19T16:40:00+05:00'}};
  const elements = await run({ok:true,json:async()=>data,headers:new Headers({'X-Weather-Cache':'fallback'})});
  assert.equal(elements.get('weather-details').hidden,false);
  assert.match(elements.get('weather-status').textContent,/Не удалось обновить погоду/);
});
