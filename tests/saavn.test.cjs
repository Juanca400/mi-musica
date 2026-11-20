const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');

function setup(saved = {}) {
  const elements = {};
  const context = vm.createContext({ URL, AbortController, setTimeout, clearTimeout,
    navigator: { language: 'es-CO' },
    store: { get: (k, d) => saved[k] ?? d, set: (k, v) => { saved[k] = v; } },
    $: id => elements[id] ||= {
      value: '', events: {}, classList: { toggle() {} },
      addEventListener(type, fn) { this.events[type] = fn; },
      replaceChildren(...options) { this.options = options; },
    },
    document: { createElement: () => ({ set innerHTML(v) { this.value = v.replace(/&quot;/g, '"').replace(/&lt;/g, '<'); } }) },
  });
  vm.runInContext(source.slice(source.indexOf('const REGION'), source.indexOf('async function searchItunes')), context);
  return { run: js => vm.runInContext(js, context), context, elements, saved };
}
const song = {
  id: 'test', name: 'Song &quot;title&quot;', duration: 120, artists: { primary: [{ name: 'Artist' }] },
  downloadUrl: [
    { quality: '96kbps', url: 'https://example.com/96.mp4' },
    { quality: '320kbps', url: 'https://example.com/320.mp4' },
    { quality: '160kbps', url: 'javascript:bad()' },
  ],
};

test('preferred quality persists and applies to already loaded songs on next playback', async () => {
  const s = setup(); s.context.raw = song;
  s.run('globalThis.track = saavnSong(raw)');
  assert.equal(s.run('track.src'), 'https://example.com/320.mp4');
  assert.equal(s.run('track.title'), 'Song "title"');
  s.elements.saavnQuality.events.change({ target: { value: '96kbps' } });
  assert.equal(s.saved.saavnQuality, '96kbps');
  assert.equal(await s.run('saavnStream(track)'), 'https://example.com/96.mp4');
  assert.equal(s.run('track.canSave'), false);
});

test('invalid stored quality resets; missing quality uses best safe URL', () => {
  const s = setup({ saavnQuality: 'invalid' }); s.context.raw = song;
  assert.equal(s.elements.saavnQuality.value, '320kbps');
  s.elements.saavnQuality.events.change({ target: { value: '160kbps' } });
  assert.equal(s.run('saavnSong(raw).src'), 'https://example.com/320.mp4');
  assert.equal(s.run("saavnURL('http://example.com')"), '');
});

test('network, HTTP-200 error envelopes and malformed data use the alternate API', async () => {
  for (const failure of ['throw new Error("offline")', 'return {success:false}', 'return {success:true,data:{}}']) {
    const s = setup(); s.context.raw = song;
    s.run(`globalThis.calls = []; getJSON = async (url, timeout) => {
      calls.push({url, timeout}); if (calls.length === 1) { ${failure}; }
      return {success:true,data:{total:1,results:[raw]}};
    };`);
    const result = await s.run("searchSaavn('A&B canción', 2)");
    assert.equal(result.items.length, 1);
    assert.match(s.context.calls[1].url, /^https:\/\/melotune\.harshbits\.com\/api\/search\/songs\?query=A%26B\+canci%C3%B3n&page=1&limit=50$/);
    assert.equal(s.context.calls[0].timeout, 8000);
  }
});

test('healthy primary skips alternate; two failing servers reject', async () => {
  const s = setup();
  s.run('globalThis.calls = []; getJSON = async url => { calls.push(url); return {success:true,data:{total:0,results:[]}}; };');
  await s.run("searchSaavn('test')"); assert.equal(s.context.calls.length, 1);
  s.run('getJSON = async () => { throw new Error("offline"); }');
  await assert.rejects(s.run("searchSaavn('test')"), /JioSaavn no disponible/);
});

test('expired song URLs refresh using alternate server and selected quality', async () => {
  const s = setup({ saavnQuality: '96kbps' }); s.context.raw = song;
  s.run(`globalThis.track = saavnSong(raw); track.resolvedAt = 0; globalThis.calls = [];
    getJSON = async url => { calls.push(url); if (calls.length === 1) throw new Error('offline'); return {success:true,data:[raw]}; };`);
  assert.equal(await s.run('saavnStream(track)'), 'https://example.com/96.mp4');
  assert.match(s.context.calls[1], /melotune\.harshbits\.com\/api\/songs\/test$/);
});

test('history rejects corrupt storage, limits suggestions and can be cleared', () => {
  const invalid = setup({ saavnHistory: {} });
  assert.equal(invalid.elements.saavnHistory.options.length, 0);
  const s = setup({ saavnHistory: [null, ...Array.from({length:12}, (_, i) => `Query ${i}`)] });
  assert.equal(s.elements.saavnHistory.options.length, 8);
  s.elements.clearSaavnHistory.events.click();
  assert.equal(s.saved.saavnHistory.length, 0);
  assert.equal(s.elements.saavnHistory.options.length, 0);
});
