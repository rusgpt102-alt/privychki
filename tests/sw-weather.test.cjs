const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

test('service worker keeps good weather when a later response has broken fields', async () => {
  const handlers = {}, stored = new Map();
  const good = {version:1,updated_at:new Date().toISOString(),
    current:{temperature_c:-7.5,feels_like_c:-12,wind_ms:3.4,weather_code:71},
    today:{date:'2026-11-19',temperature_min_c:-10,temperature_max_c:-5,
      precipitation_probability_percent:80,sunrise:'2026-11-19T08:45:00+05:00',sunset:'2026-11-19T16:40:00+05:00'}};
  let payload = good;
  const cache = {match:async key=>stored.get(key)?.clone(),put:async(key,value)=>stored.set(key,value.clone())};
  const sandbox = {URL,Request,Response,Headers,AbortSignal,Date,Number,
    self:{location:'http://localhost/',addEventListener:(name,fn)=>handlers[name]=fn},
    caches:{open:async()=>cache},fetch:async()=>new Response(JSON.stringify(payload),{status:200})};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8'),sandbox);
  async function request() {
    let response;
    handlers.fetch({request:new Request('http://localhost/data.json'),respondWith:value=>response=value});
    const result = await response;
    return {data:await result.json(),cached:result.headers.get('X-Weather-Cache')};
  }
  assert.equal((await request()).data.current.feels_like_c,-12);
  payload = {...good,current:{...good.current,feels_like_c:null}};
  const fallback = await request();
  assert.equal(fallback.data.current.feels_like_c,-12,'Bad response must not replace the cached weather');
  assert.equal(fallback.cached,'fallback','The page must know weather came from a fallback cache');
  payload = {...good,current:{...good.current,temperature_c:2}};
  assert.equal((await request()).data.current.temperature_c,2,'A fresh valid response must replace the cache');
});
