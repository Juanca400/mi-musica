'use strict';

/* ================= Íconos ================= */
const ICON = {
  play:   '<svg viewBox="0 0 24 24"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.8-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z"/></svg>',
  pause:  '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
  next:   '<svg viewBox="0 0 24 24"><path d="M5 5.5v13l9-6.5zM15 5h3v14h-3z"/></svg>',
  prev:   '<svg viewBox="0 0 24 24"><path d="M19 5.5v13l-9-6.5zM6 5h3v14H6z"/></svg>',
  down:   '<svg viewBox="0 0 24 24"><path d="M5.3 8.3a1 1 0 0 1 1.4 0L12 13.6l5.3-5.3a1 1 0 1 1 1.4 1.4l-6 6a1 1 0 0 1-1.4 0l-6-6a1 1 0 0 1 0-1.4z"/></svg>',
  heart:  '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.4h2c.7-1.2 2.2-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z"/></svg>',
  heartO: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.4h2c.7-1.2 2.2-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21zm0-2.4c2.1-1.4 6.3-4.6 7.8-7.7 1-2.2-.3-4.4-2.4-4.4-1.5 0-2.5 1-3 2.1l-.3.6H9.9l-.3-.6C9.1 7.5 8.1 6.5 6.6 6.5c-2.1 0-3.4 2.2-2.4 4.4 1.5 3.1 5.7 6.3 7.8 7.7z"/></svg>',
  trash:  '<svg viewBox="0 0 24 24"><path d="M9 3h6l1 2h4v2H4V5h4zm-3 6h12l-1 12H7z"/></svg>',
  shuffle:'<svg viewBox="0 0 24 24"><path d="M17 3l4 4-4 4V8h-2.2l-2.6 3.2-1.3-1.6L13.8 6H17zM3 6h4.2l9.6 12H17v-3l4 4-4 4v-3h-1.2L6.2 8H3zm0 12h3.2l2.6-3.2 1.3 1.6L7.2 20H3z"/></svg>',
  repeat: '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/></svg>',
  download:'<svg viewBox="0 0 24 24"><path d="M11 3h2v9.6l3.3-3.3 1.4 1.4L12 16.4l-5.7-5.7 1.4-1.4 3.3 3.3zM4 18h16v2H4z"/></svg>',
  check:  '<svg viewBox="0 0 24 24"><path d="M9.5 16.6 4.9 12l-1.4 1.4 6 6L21 7.9l-1.4-1.4z"/></svg>',
};

/* ================= Base de datos (IndexedDB) ================= */
// "songs" guarda los datos de cada canción; "files" guarda el audio en sí.
const dbp = new Promise((res, rej) => {
  const r = indexedDB.open('mi-musica', 1);
  r.onupgradeneeded = () => {
    r.result.createObjectStore('songs', { keyPath: 'id' });
    r.result.createObjectStore('files');
  };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});

async function dbRun(stores, mode, fn) {
  const db = await dbp;
  return new Promise((res, rej) => {
    const t = db.transaction(stores, mode);
    let out;
    const req = fn(t);
    if (req) req.onsuccess = () => { out = req.result; };
    t.oncomplete = () => res(out);
    t.onerror = t.onabort = () => rej(t.error);
  });
}
const dbAllSongs = () => dbRun('songs', 'readonly', t => t.objectStore('songs').getAll());
const dbGetFile  = id => dbRun('files', 'readonly', t => t.objectStore('files').get(id));
const dbPutSong  = s => dbRun('songs', 'readwrite', t => { t.objectStore('songs').put(s); });
const dbAdd      = (s, blob) => dbRun(['songs', 'files'], 'readwrite', t => {
  t.objectStore('songs').put(s); t.objectStore('files').put(blob, s.id);
});
const dbDelete   = id => dbRun(['songs', 'files'], 'readwrite', t => {
  t.objectStore('songs').delete(id); t.objectStore('files').delete(id);
});
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ================= Lectura de etiquetas ID3 (título, artista, carátula) ================= */
const syncsafe = (b, i) => (b[i] & 0x7f) << 21 | (b[i + 1] & 0x7f) << 14 | (b[i + 2] & 0x7f) << 7 | (b[i + 3] & 0x7f);
const be32 = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;

function decodeStr(enc, b) {
  if (enc === 0) return new TextDecoder('latin1').decode(b);
  if (enc === 3) return new TextDecoder('utf-8').decode(b);
  if (enc === 1) {
    if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(b.subarray(2));
    if (b[0] === 0xFF && b[1] === 0xFE) b = b.subarray(2);
    return new TextDecoder('utf-16le').decode(b);
  }
  return new TextDecoder('utf-16be').decode(b);
}
function readTextFrame(d) {
  const s = decodeStr(d[0], d.subarray(1)).split('\0').map(x => x.trim()).filter(Boolean)[0];
  return s || null;
}
function readPicFrame(d) {
  const enc = d[0];
  let i = 1;
  while (i < d.length && d[i] !== 0) i++;
  let mime = new TextDecoder('latin1').decode(d.subarray(1, i)).toLowerCase();
  i += 2; // fin del mime + tipo de imagen
  if (enc === 1 || enc === 2) { while (i + 1 < d.length && !(d[i] === 0 && d[i + 1] === 0)) i += 2; i += 2; }
  else { while (i < d.length && d[i] !== 0) i++; i++; }
  if (!mime.includes('/')) mime = 'image/' + (mime || 'jpeg');
  if (mime === 'image/jpg') mime = 'image/jpeg';
  return i < d.length ? new Blob([d.slice(i)], { type: mime }) : null;
}
async function readTags(file) {
  const out = { title: null, artist: null, cover: null };
  try {
    const h = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    if (h[0] !== 0x49 || h[1] !== 0x44 || h[2] !== 0x33) return out; // "ID3"
    const ver = h[3];
    if (ver < 3) return out;
    const size = syncsafe(h, 6);
    const b = new Uint8Array(await file.slice(10, 10 + size).arrayBuffer());
    let p = 0;
    if (h[5] & 0x40) p = ver === 4 ? syncsafe(b, 0) : be32(b, 0) + 4;
    while (p + 10 <= b.length) {
      const id = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const fs = ver === 4 ? syncsafe(b, p + 4) : be32(b, p + 4);
      if (fs <= 0 || p + 10 + fs > b.length) break;
      const d = b.subarray(p + 10, p + 10 + fs);
      if (id === 'TIT2') out.title = readTextFrame(d);
      else if (id === 'TPE1') out.artist = readTextFrame(d);
      else if (id === 'APIC' && !out.cover) out.cover = readPicFrame(d);
      p += 10 + fs;
    }
  } catch (e) { /* archivo sin etiquetas legibles */ }
  return out;
}

// Reduce la carátula a 512 px para no gastar espacio
async function shrinkImage(blob, max = 512) {
  if (!blob) return null;
  try {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k === 1 && blob.size < 200000) return blob;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const out = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
    return out || blob;
  } catch { return blob; }
}

const TYPES = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg' };
function fromFilename(name) {
  const base = name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
  const m = base.split(' - ');
  return m.length >= 2 ? { artist: m[0].trim(), title: m.slice(1).join(' - ').trim() } : { artist: null, title: base };
}

/* ================= Estado ================= */
// Una "pista" puede ser:
//  - una canción de la biblioteca (sin campo kind; el audio está en IndexedDB)
//  - kind 'preview': fragmento de 30 s del catálogo de iTunes
//  - kind 'free':    canción completa con licencia libre de Internet Archive
//  - kind 'radio':   emisora en vivo
const $ = id => document.getElementById(id);
const audio = $('audio');
const store = {
  get(k, d) { try { const v = localStorage.getItem('mm.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mm.' + k, JSON.stringify(v)); } catch {} },
};
let songs = [];
let tab = 'all';
let query = '';
let queue = [];
let qi = -1;
let current = null;
let shuffle = store.get('shuffle', false);
let repeat = store.get('repeat', 'off'); // off | all | one
let audioURL = null;
const coverURLs = new Map();
let unlocked = false;

const isLib = t => !!t && !t.kind;
function coverFor(t, thumb) {
  if (!t) return null;
  if (t.kind) return thumb ? (t.thumb || t.coverUrl) : (t.coverUrl || t.thumb);
  if (!t.cover) return null;
  if (!coverURLs.has(t.id)) coverURLs.set(t.id, URL.createObjectURL(t.cover));
  return coverURLs.get(t.id);
}
function setCover(el, t, thumb) {
  if (!el) return;
  el.textContent = t ? (t.title || '?').trim().charAt(0).toUpperCase() : '♪';
  const u = coverFor(t, thumb);
  if (u) {
    const img = new Image();
    img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    img.onerror = () => img.remove();
    img.src = u;
    el.appendChild(img);
  }
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = t => { if (!isFinite(t)) return '0:00'; t = Math.floor(t); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

let toastTimer;
function toast(msg, ms = 2200) {
  const el = $('toast');
  el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

/* ================= Biblioteca ================= */
function visibleSongs() {
  const q = query.toLowerCase();
  return songs.filter(s =>
    (tab === 'all' || s.fav) &&
    (!q || (s.title || '').toLowerCase().includes(q) || (s.artist || '').toLowerCase().includes(q)));
}

function render() {
  if (tab === 'net') return;
  const list = visibleSongs();
  $('empty').classList.toggle('hidden', songs.length > 0);
  if (songs.length && !list.length) {
    $('list').innerHTML = `<p class="muted" style="text-align:center;padding:40px 16px">${tab === 'fav' && !query ? 'Aún no tienes favoritas. Toca el ♥ de una canción.' : 'Sin resultados.'}</p>`;
    return;
  }
  $('list').innerHTML = list.map(s => `
    <div class="row${isLib(current) && current.id === s.id ? ' playing' : ''}" data-id="${s.id}">
      <button class="row-main" data-act="play">
        <span class="cover sm" data-cover="${s.id}"></span>
        <span class="row-text"><span class="t">${esc(s.title)}</span><span class="a">${esc(s.artist || 'Artista desconocido')}</span></span>
      </button>
      <button class="icon-btn ${s.fav ? 'fav-on' : 'dim'}" data-act="fav" aria-label="Favorita">${s.fav ? ICON.heart : ICON.heartO}</button>
      <button class="icon-btn dim" data-act="del" aria-label="Eliminar">${ICON.trash}</button>
    </div>`).join('');
  list.forEach(s => setCover($('list').querySelector(`[data-cover="${s.id}"]`), s));
}

$('list').addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const id = btn.closest('.row').dataset.id;
  const s = songs.find(x => x.id === id);
  if (!s) return;
  if (btn.dataset.act === 'play') {
    unlockAudio();
    queue = visibleSongs();
    qi = queue.indexOf(s);
    loadAndPlay();
  } else if (btn.dataset.act === 'fav') {
    toggleFav(s);
  } else if (btn.dataset.act === 'del') {
    if (confirm(`¿Eliminar "${s.title}" de la app?`)) removeSong(s);
  }
});

async function toggleFav(s) {
  s.fav = !s.fav;
  await dbPutSong(s);
  render(); updatePlayerUI();
}

async function removeSong(s) {
  await dbDelete(s.id);
  songs = songs.filter(x => x.id !== s.id);
  if (coverURLs.has(s.id)) { URL.revokeObjectURL(coverURLs.get(s.id)); coverURLs.delete(s.id); }
  const qpos = queue.indexOf(s);
  if (qpos !== -1) { queue.splice(qpos, 1); if (qpos < qi) qi--; }
  if (current === s) {
    audio.pause(); audio.removeAttribute('src'); audio.load();
    current = null; qi = -1;
    $('mini').classList.add('hidden'); closePlayer();
  }
  render(); renderNet();
}

document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
  tab = b.dataset.tab;
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  $('lib').classList.toggle('hidden', tab === 'net');
  $('net').classList.toggle('hidden', tab !== 'net');
  if (tab === 'net') openNet(); else render();
}));
$('search').addEventListener('input', e => { query = e.target.value.trim(); render(); });

/* ================= Importar canciones del teléfono ================= */
$('file').addEventListener('change', async e => {
  const files = [...e.target.files];
  e.target.value = '';
  if (!files.length) return;
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  let ok = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    toast(`Importando ${i + 1} de ${files.length}…`, 0);
    try {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      const type = f.type || TYPES[ext] || 'audio/mpeg';
      const blob = f.type ? f : f.slice(0, f.size, type);
      const tags = await readTags(f);
      const fn = fromFilename(f.name);
      const s = {
        id: newId(),
        title: tags.title || fn.title || 'Sin título',
        artist: tags.artist || fn.artist || '',
        cover: await shrinkImage(tags.cover),
        fav: false,
        added: Date.now() + i,
      };
      await dbAdd(s, blob);
      songs.push(s); ok++;
    } catch (err) {
      console.error(err);
    }
  }
  sortSongs(); render();
  toast(ok === files.length ? `✓ ${ok} ${ok === 1 ? 'canción agregada' : 'canciones agregadas'}` : `Se agregaron ${ok} de ${files.length}. Puede que falte espacio.`, 3000);
});

function sortSongs() {
  songs.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'es', { sensitivity: 'base' }));
}

/* ================= Internet ================= */
const REGION = (() => { const r = (navigator.language || '').split('-')[1]; return r && /^[a-z]{2}$/i.test(r) ? r.toUpperCase() : 'US'; })();
const HINTS = {
  audius: 'Canciones completas que los artistas suben a Audius. Suenan con la pantalla bloqueada. ⬇ aparece si el artista permite descargarla.',
  itunes: 'Busca cualquier canción del catálogo de iTunes. Se escuchan fragmentos de 30 segundos.',
  free: 'Álbumes completos con licencia libre (Internet Archive). Toca ⬇ para guardarlas y oírlas sin internet.',
  radio: 'Emisoras en vivo de todo el mundo. Busca por nombre o género: salsa, vallenato, rock, noticias…',
};
const PLACEHOLDERS = { audius: 'Buscar canción, artista o género', itunes: 'Buscar canción o artista', free: 'Buscar género, artista o álbum', radio: 'Buscar emisora o género' };
let netSrc = 'audius';
let netItems = [];
let netStatus = '';
let netAlbum = null;      // álbum abierto de Internet Archive
let netPrev = null;       // resultados guardados para volver desde el álbum
const netLoaded = {};     // qué fuentes ya cargaron sus resultados iniciales
const netCache = {};      // resultados por fuente
const saving = new Set();
let netToken = 0;

async function getJSON(url, ms = 15000) {
  const c = new AbortController();
  const tm = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(tm); }
}

async function searchItunes(q) {
  const j = await getJSON(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=50&country=${REGION}`);
  return (j.results || []).filter(x => x.previewUrl).map(x => ({
    kind: 'preview',
    id: 'it' + x.trackId,
    title: x.trackName,
    artist: x.artistName,
    thumb: x.artworkUrl100,
    coverUrl: (x.artworkUrl100 || '').replace('100x100', '600x600'),
    src: x.previewUrl,
    link: x.trackViewUrl,
  }));
}

// Audius: plataforma donde los artistas suben sus canciones completas (API abierta, sin clave)
const AUDIUS = 'https://api.audius.co/v1';
const APP = 'app_name=mi-musica';
async function searchAudius(q) {
  const j = await getJSON(q
    ? `${AUDIUS}/tracks/search?query=${encodeURIComponent(q)}&limit=50&${APP}`
    : `${AUDIUS}/tracks/trending?limit=50&${APP}`);
  return (j.data || []).filter(t => t.is_streamable !== false).map(t => ({
    kind: 'free',
    id: 'au:' + t.id,
    title: t.title,
    artist: (t.user && t.user.name) || '',
    dur: t.duration,
    thumb: t.artwork && (t.artwork['150x150'] || t.artwork['480x480']),
    coverUrl: t.artwork && (t.artwork['480x480'] || t.artwork['1000x1000']),
    src: `${AUDIUS}/tracks/${encodeURIComponent(t.id)}/stream?${APP}`,
    canSave: !!t.is_downloadable,
  }));
}

async function searchFree(q) {
  const clean = q.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').trim();
  let query = 'collection:(netlabels) AND mediatype:audio AND format:"VBR MP3"';
  if (clean) query += ` AND (${clean})`;
  const j = await getJSON('https://archive.org/advancedsearch.php?q=' + encodeURIComponent(query) +
    '&fl[]=identifier&fl[]=title&fl[]=creator&rows=40&sort[]=downloads+desc&output=json');
  return (j.response && j.response.docs || []).map(d => ({
    kind: 'album',
    id: d.identifier,
    title: d.title || d.identifier,
    artist: [].concat(d.creator || []).join(', '),
    thumb: 'https://archive.org/services/img/' + encodeURIComponent(d.identifier),
  }));
}

async function openAlbum(al) {
  const token = ++netToken;
  netPrev = { items: netItems, scroll: window.scrollY };
  netAlbum = al; netItems = []; netStatus = 'Cargando canciones…';
  renderNet(); window.scrollTo(0, 0);
  try {
    const m = await getJSON('https://archive.org/metadata/' + encodeURIComponent(al.id));
    if (token !== netToken) return;
    let files = (m.files || []).filter(f => f.format === 'VBR MP3');
    if (!files.length) files = (m.files || []).filter(f => /\.mp3$/i.test(f.name));
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const albumArtist = [].concat((m.metadata && m.metadata.creator) || al.artist || []).join(', ');
    const dl = name => 'https://archive.org/download/' + encodeURIComponent(al.id) + '/' + name.split('/').map(encodeURIComponent).join('/');
    const all = m.files || [];
    const pics = all.filter(f => /\.(jpe?g|png)$/i.test(f.name) && f.source === 'original');
    const img = pics.find(f => /front|cover|folder/i.test(f.name)) || all.find(f => f.format === 'Item Tile') || pics[0];
    const albumCover = img ? dl(img.name) : al.thumb;
    netItems = files.map(f => ({
      kind: 'free',
      id: 'ia:' + al.id + '/' + f.name,
      title: f.title || fromFilename(f.name.split('/').pop()).title,
      artist: f.artist || f.creator || albumArtist,
      thumb: al.thumb,
      coverUrl: albumCover,
      src: dl(f.name),
      canSave: true,
    }));
    netStatus = netItems.length ? '' : 'Este álbum no tiene canciones en MP3.';
  } catch (e) {
    if (token !== netToken) return;
    netStatus = 'No se pudo cargar el álbum. Revisa tu conexión.';
  }
  renderNet();
}

function closeAlbum() {
  ++netToken;
  netAlbum = null;
  netItems = netPrev ? netPrev.items : [];
  netStatus = '';
  renderNet();
  if (netPrev) window.scrollTo(0, netPrev.scroll);
  netPrev = null;
}

const RADIO_HOSTS = ['de1', 'de2', 'fi1'];
async function radioAPI(path) {
  let err;
  for (const h of RADIO_HOSTS) {
    try { return await getJSON(`https://${h}.api.radio-browser.info/json/${path}`, 10000); }
    catch (e) { err = e; }
  }
  throw err;
}
async function searchRadio(q) {
  const base = 'stations/search?hidebroken=true&order=clickcount&reverse=true&limit=60';
  let list;
  if (!q) {
    list = await radioAPI(`${base}&countrycode=${REGION}`);
    if (list.length < 5) list = list.concat(await radioAPI(base));
  } else {
    const [byName, byTag] = await Promise.all([
      radioAPI(`${base}&name=${encodeURIComponent(q)}`).catch(() => []),
      radioAPI(`${base}&tag=${encodeURIComponent(q.toLowerCase())}`).catch(() => []),
    ]);
    list = byName.concat(byTag);
  }
  const seen = new Set();
  return list
    // En el iPhone la app se abre por https, así que solo sirven emisoras https
    .filter(s => s.url_resolved && s.url_resolved.startsWith('https://') && !seen.has(s.stationuuid) && seen.add(s.stationuuid))
    .sort((a, b) => b.clickcount - a.clickcount)
    .slice(0, 50)
    .map(s => ({
      kind: 'radio',
      id: 'r' + s.stationuuid,
      title: s.name.trim(),
      artist: [s.country, (s.tags || '').split(',').filter(Boolean).slice(0, 2).join(', ')].filter(Boolean).join(' · '),
      thumb: s.favicon && s.favicon.startsWith('https://') ? s.favicon : null,
      coverUrl: s.favicon && s.favicon.startsWith('https://') ? s.favicon : null,
      src: s.url_resolved,
    }));
}

async function netSearch(q) {
  const token = ++netToken;
  netAlbum = null; netPrev = null;
  netItems = []; netStatus = 'Buscando…';
  renderNet();
  try {
    const fn = { audius: searchAudius, itunes: searchItunes, free: searchFree, radio: searchRadio }[netSrc];
    const items = await fn(q);
    if (token !== netToken) return;
    netItems = items;
    netStatus = items.length ? '' : 'Sin resultados. Prueba con otras palabras.';
  } catch (e) {
    if (token !== netToken) return;
    netStatus = navigator.onLine === false ? 'Sin conexión a internet.' : 'No se pudo buscar. Intenta de nuevo.';
  }
  netCache[netSrc] = { items: netItems, status: netStatus, q };
  renderNet();
}

function openNet() {
  $('netQ').placeholder = PLACEHOLDERS[netSrc];
  if (!netLoaded[netSrc] && netSrc !== 'itunes') { netLoaded[netSrc] = true; netSearch(''); }
  else renderNet();
}

document.querySelectorAll('.sources button').forEach(b => b.addEventListener('click', () => {
  if (netSrc === b.dataset.src) return;
  netCache[netSrc] = { items: netAlbum && netPrev ? netPrev.items : netItems, status: netAlbum ? '' : netStatus, q: $('netQ').value };
  netSrc = b.dataset.src;
  ++netToken;
  netAlbum = null; netPrev = null;
  document.querySelectorAll('.sources button').forEach(x => x.classList.toggle('on', x === b));
  const c = netCache[netSrc];
  netItems = c ? c.items : []; netStatus = c ? c.status : '';
  $('netQ').value = c ? c.q : '';
  window.scrollTo(0, 0);
  openNet();
}));

$('netForm').addEventListener('submit', e => {
  e.preventDefault();
  const q = $('netQ').value.trim();
  $('netQ').blur();
  if (!q && netSrc === 'itunes') return;
  netLoaded[netSrc] = true;
  netSearch(q);
});

const isSaved = t => songs.some(s => s.source === t.id);

function renderNet() {
  if (tab !== 'net') return;
  $('netHint').textContent = netStatus || (netAlbum ? '' : HINTS[netSrc]);
  let html = '';
  if (netAlbum) {
    html += `<div class="album-head"><button class="back" data-act="back">‹ Volver</button>
      <div class="t">${esc(netAlbum.title)}</div><div class="a">${esc(netAlbum.artist)}</div></div>`;
  }
  html += netItems.map((t, i) => {
    const playing = current && current.id === t.id;
    let actions = '';
    if (t.kind === 'album') actions = '<span class="chev">›</span>';
    else if (t.kind === 'free') {
      actions = !t.canSave ? '<span class="tag">COMPLETA</span>'
        : saving.has(t.id) ? `<span class="icon-btn dim spin">${ICON.download}</span>`
        : isSaved(t) ? `<span class="icon-btn fav-on" aria-label="Guardada">${ICON.check}</span>`
        : `<button class="icon-btn" data-act="save" aria-label="Guardar">${ICON.download}</button>`;
    }
    else if (t.kind === 'preview') actions = '<span class="tag">30 s</span>';
    else if (t.kind === 'radio') actions = '<span class="tag live">EN VIVO</span>';
    return `<div class="row${playing ? ' playing' : ''}" data-i="${i}">
      <button class="row-main" data-act="${t.kind === 'album' ? 'open' : 'play'}">
        <span class="cover sm" data-c="${i}"></span>
        <span class="row-text"><span class="t">${esc(t.title)}</span><span class="a">${esc(t.artist)}${t.dur ? ' · ' + fmt(t.dur) : ''}</span></span>
      </button>${actions}</div>`;
  }).join('');
  const el = $('netList');
  el.innerHTML = html;
  netItems.forEach((t, i) => setCover(el.querySelector(`[data-c="${i}"]`), t, true));
}

$('netList').addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  if (btn.dataset.act === 'back') { closeAlbum(); return; }
  const t = netItems[+btn.closest('.row').dataset.i];
  if (!t) return;
  if (btn.dataset.act === 'open') openAlbum(t);
  else if (btn.dataset.act === 'save') saveTrack(t);
  else if (btn.dataset.act === 'play') {
    unlockAudio();
    queue = netItems.filter(x => x.kind !== 'album');
    qi = queue.indexOf(t);
    loadAndPlay();
  }
});

// Descarga una canción libre y la guarda en la biblioteca para oírla sin internet
async function saveTrack(t) {
  if (!t || t.kind !== 'free' || !t.canSave || saving.has(t.id)) return;
  if (isSaved(t)) { toast('Ya está en tu biblioteca'); return; }
  saving.add(t.id); renderNet(); updatePlayerUI();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  try {
    toast(`Descargando "${t.title}"…`, 0);
    const r = await fetch(t.src);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const total = +r.headers.get('content-length') || 0;
    let blob;
    if (r.body && r.body.getReader && total) {
      const reader = r.body.getReader();
      const parts = [];
      let got = 0, lastPct = -1;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value); got += value.length;
        const pct = Math.floor(got * 100 / total);
        if (pct !== lastPct) { lastPct = pct; toast(`Descargando "${t.title}"… ${pct}%`, 0); }
      }
      blob = new Blob(parts, { type: 'audio/mpeg' });
    } else {
      blob = new Blob([await r.blob()], { type: 'audio/mpeg' });
    }
    // Carátula: primero la que trae el MP3; si no tiene, se intenta descargar la del álbum
    let cover = (await readTags(blob)).cover;
    if (!cover) {
      try {
        const c = await fetch(t.coverUrl);
        if (c.ok) { const cb = await c.blob(); if (cb.type.startsWith('image/')) cover = cb; }
      } catch { /* sin carátula */ }
    }
    cover = await shrinkImage(cover);
    const s = { id: newId(), title: t.title, artist: t.artist || '', cover, fav: false, added: Date.now(), source: t.id };
    await dbAdd(s, blob);
    songs.push(s); sortSongs();
    toast('✓ Guardada en tu biblioteca');
  } catch (e) {
    toast('No se pudo descargar. Revisa tu conexión o el espacio libre.', 3500);
  } finally {
    saving.delete(t.id);
    render(); renderNet(); updatePlayerUI();
  }
}

/* ================= Reproducción ================= */
// iOS solo deja reproducir audio después de un toque del usuario. Para que el
// primer toque "desbloquee" el reproductor aunque el archivo tarde en cargar,
// se reproduce un sonido silencioso de inmediato.
function silentWav() {
  const n = 800, b = new ArrayBuffer(44 + n), v = new DataView(b);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
}
function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  audio.src = silentWav();
  audio.play().catch(() => {});
}

let loadToken = 0;
async function loadAndPlay(autoplay = true) {
  const t = queue[qi];
  if (!t) return;
  const token = ++loadToken;
  let src;
  if (isLib(t)) {
    const blob = await dbGetFile(t.id);
    if (token !== loadToken) return;
    if (!blob) { toast('No se encontró el archivo de esta canción'); return; }
    src = URL.createObjectURL(blob);
    store.set('last', t.id);
  } else {
    src = t.src;
  }
  if (audioURL) { URL.revokeObjectURL(audioURL); audioURL = null; }
  if (src.startsWith('blob:')) audioURL = src;
  current = t;
  audio.src = src;
  updatePlayerUI(); render(); renderNet(); updateMediaSession();
  if (autoplay) {
    try { await audio.play(); }
    catch (e) {
      if (token !== loadToken || e.name === 'AbortError') return;
      if (e.name === 'NotAllowedError') toast('Toca ▶ para reproducir');
      else toast(t.kind === 'radio' ? 'Esta emisora no está disponible' : 'No se pudo reproducir');
    }
  }
}

audio.addEventListener('error', () => {
  if (!current || !audio.src || audio.src.startsWith('blob:') && !isLib(current)) return;
  toast(current.kind === 'radio' ? 'Esta emisora no está disponible ahora' : 'No se pudo cargar el audio', 3000);
  updatePlayButtons();
});

function togglePlay() {
  if (!current) return;
  unlockAudio();
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}

function pickNext() {
  if (!queue.length) return -1;
  if (shuffle && queue.length > 1) {
    let n; do { n = Math.floor(Math.random() * queue.length); } while (n === qi);
    return n;
  }
  if (qi + 1 < queue.length) return qi + 1;
  return repeat === 'all' ? 0 : -1;
}
function next(fromEnd = false) {
  const n = pickNext();
  if (n === -1) {
    if (fromEnd) { audio.currentTime = 0; audio.pause(); updatePlayerUI(); }
    else { qi = 0; loadAndPlay(); }
    return;
  }
  qi = n; loadAndPlay();
}
function prev() {
  if ((audio.currentTime > 3 && !isLive()) || !queue.length) { audio.currentTime = 0; return; }
  qi = qi > 0 ? qi - 1 : (repeat === 'all' ? queue.length - 1 : 0);
  loadAndPlay();
}
const isLive = () => !!current && (current.kind === 'radio' || audio.duration === Infinity);

audio.addEventListener('ended', () => {
  if (!current) return;
  if (repeat === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); }
  else next(true);
});
audio.addEventListener('play', updatePlayButtons);
audio.addEventListener('pause', updatePlayButtons);

let seeking = false;
audio.addEventListener('timeupdate', () => {
  if (!current) return;
  const d = audio.duration, c = audio.currentTime;
  if (isLive()) {
    $('miniBar').style.width = '0';
    $('cur').textContent = fmt(c); $('dur').textContent = 'EN VIVO';
    return;
  }
  const pct = d ? c / d : 0;
  $('miniBar').style.width = (pct * 100) + '%';
  if (!seeking) { $('seek').value = Math.round(pct * 1000); paintSeek(); $('cur').textContent = fmt(c); }
  $('dur').textContent = fmt(d);
  if ('mediaSession' in navigator && navigator.mediaSession.setPositionState && isFinite(d) && d > 0) {
    try { navigator.mediaSession.setPositionState({ duration: d, position: Math.min(c, d), playbackRate: audio.playbackRate }); } catch {}
  }
});
audio.addEventListener('loadedmetadata', () => { $('dur').textContent = isLive() ? 'EN VIVO' : fmt(audio.duration); updateSeekState(); });

function updateSeekState() {
  const live = isLive();
  $('seek').disabled = live;
  if (live) { $('seek').value = 0; paintSeek(); }
}
function paintSeek() {
  const v = $('seek').value / 10;
  $('seek').style.background = `linear-gradient(90deg, var(--fg) ${v}%, var(--bg3) ${v}%)`;
}
$('seek').addEventListener('input', () => {
  seeking = true; paintSeek();
  if (audio.duration) $('cur').textContent = fmt(audio.duration * $('seek').value / 1000);
});
$('seek').addEventListener('change', () => {
  if (audio.duration && isFinite(audio.duration)) audio.currentTime = audio.duration * $('seek').value / 1000;
  seeking = false;
});

/* ================= Interfaz del reproductor ================= */
function updatePlayButtons() {
  const playing = !audio.paused && !!current;
  $('play').innerHTML = playing ? ICON.pause : ICON.play;
  $('miniPlay').innerHTML = playing ? ICON.pause : ICON.play;
  $('play').setAttribute('aria-label', playing ? 'Pausa' : 'Reproducir');
  $('miniPlay').setAttribute('aria-label', playing ? 'Pausa' : 'Reproducir');
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
}
function updatePlayerUI() {
  updatePlayButtons();
  $('shuffle').classList.toggle('on', shuffle);
  $('repeat').classList.toggle('on', repeat !== 'off');
  $('repeat').innerHTML = ICON.repeat + (repeat === 'one' ? '<span class="badge">1</span>' : '');
  if (!current) return;
  const t = current;
  $('mini').classList.remove('hidden');
  const sub = t.artist || (isLib(t) ? 'Artista desconocido' : '');
  $('miniTitle').textContent = t.title;
  $('miniArtist').textContent = sub;
  $('pTitle').textContent = t.title;
  $('pArtist').textContent = sub;
  $('pLabel').textContent = { preview: 'Vista previa · 30 s', free: 'Canción completa', radio: 'Radio en vivo' }[t.kind] || 'Reproduciendo';
  setCover($('miniCover'), t);
  setCover($('pCover'), t);
  $('pFav').classList.toggle('hidden', !isLib(t));
  $('pFav').innerHTML = t.fav ? ICON.heart : ICON.heartO;
  $('pFav').classList.toggle('fav-on', !!t.fav);
  $('pSave').classList.toggle('hidden', !(t.kind === 'free' && t.canSave));
  if (t.kind === 'free') {
    $('pSave').innerHTML = isSaved(t) ? ICON.check : ICON.download;
    $('pSave').classList.toggle('fav-on', isSaved(t));
    $('pSave').classList.toggle('spin', saving.has(t.id));
  }
  $('pLink').classList.toggle('hidden', !(t.kind === 'preview' && t.link));
  if (t.link) $('pLink').href = t.link;
  updateSeekState();
}

function openPlayer() { $('player').classList.add('open'); $('player').setAttribute('aria-hidden', 'false'); }
function closePlayer() { $('player').classList.remove('open'); $('player').setAttribute('aria-hidden', 'true'); }

$('play').innerHTML = ICON.play;
$('miniPlay').innerHTML = ICON.play;
$('miniNext').innerHTML = ICON.next;
$('next').innerHTML = ICON.next;
$('prev').innerHTML = ICON.prev;
$('close').innerHTML = ICON.down;
$('shuffle').innerHTML = ICON.shuffle;

$('miniOpen').addEventListener('click', openPlayer);
$('close').addEventListener('click', closePlayer);
$('miniPlay').addEventListener('click', togglePlay);
$('play').addEventListener('click', togglePlay);
$('miniNext').addEventListener('click', () => { unlockAudio(); next(); });
$('next').addEventListener('click', () => { unlockAudio(); next(); });
$('prev').addEventListener('click', () => { unlockAudio(); prev(); });
$('pFav').addEventListener('click', () => isLib(current) && toggleFav(current));
$('pSave').addEventListener('click', () => saveTrack(current));
$('shuffle').addEventListener('click', () => {
  shuffle = !shuffle; store.set('shuffle', shuffle); updatePlayerUI();
  toast(shuffle ? 'Aleatorio activado' : 'Aleatorio desactivado', 1200);
});
$('repeat').addEventListener('click', () => {
  repeat = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off';
  store.set('repeat', repeat); updatePlayerUI();
  toast({ off: 'Repetir desactivado', all: 'Repetir todas', one: 'Repetir una' }[repeat], 1200);
});

// Deslizar hacia abajo para cerrar el reproductor
let touchY = null;
$('player').addEventListener('touchstart', e => { if (e.target.id !== 'seek') touchY = e.touches[0].clientY; }, { passive: true });
$('player').addEventListener('touchend', e => {
  if (touchY !== null && e.changedTouches[0].clientY - touchY > 120) closePlayer();
  touchY = null;
});

/* ================= Pantalla de bloqueo / Centro de Control ================= */
function updateMediaSession() {
  if (!('mediaSession' in navigator) || !current) return;
  const art = coverFor(current);
  const type = isLib(current) ? (current.cover && current.cover.type) || 'image/jpeg' : undefined;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist || '',
      album: current.kind === 'radio' ? 'Radio en vivo' : 'Mi Música',
      artwork: art
        ? [Object.assign({ src: art, sizes: '512x512' }, type ? { type } : {})]
        : [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
    });
  } catch {}
}
if ('mediaSession' in navigator) {
  const set = (a, fn) => { try { navigator.mediaSession.setActionHandler(a, fn); } catch {} };
  set('play', () => audio.play().catch(() => {}));
  set('pause', () => audio.pause());
  set('nexttrack', () => next());
  set('previoustrack', () => prev());
  set('seekto', d => { if (d.seekTime != null && !isLive()) audio.currentTime = d.seekTime; });
}

/* ================= Inicio ================= */
(async function init() {
  try {
    songs = await dbAllSongs();
  } catch (e) {
    toast('No se pudo abrir la biblioteca: ' + e.message, 5000);
  }
  sortSongs();
  render();
  const last = store.get('last', null);
  const s = last && songs.find(x => x.id === last);
  if (s) {
    queue = songs.slice();
    qi = queue.indexOf(s);
    loadAndPlay(false);
  }
  updatePlayerUI();
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
