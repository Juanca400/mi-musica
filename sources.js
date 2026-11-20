/* Adaptadores independientes para las APIs públicas de Piped e Invidious. */
(function (root) {
  'use strict';
  const DEFAULTS = {
    invidious: ['https://yt.chocolatemoo53.com'],
    piped: ['https://pipedapi.ducks.party', 'https://api.piped.private.coffee'],
  };
  const ID = /^[A-Za-z0-9_-]{11}$/;
  function https(value) {
    try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; }
    catch { return ''; }
  }
  function baseURL(value) {
    const safe = https(value);
    if (!safe) throw new Error('Usa una dirección HTTPS válida.');
    const u = new URL(safe);
    if (u.search || u.hash) throw new Error('La dirección del servidor no debe incluir una consulta.');
    return u.href.replace(/\/+$/, '');
  }
  function videoID(value) {
    try { const id = new URL(value, 'https://www.youtube.com').searchParams.get('v'); return ID.test(id || '') ? id : ''; }
    catch { return ''; }
  }
  function mapTrack(raw, provider, endpoint) {
    const id = provider === 'piped' ? videoID(raw.url) : raw.videoId;
    if (!ID.test(id || '') || raw.isShort || raw.isUpcoming || raw.liveNow || raw.duration === -1) return null;
    const thumb = provider === 'piped' ? raw.thumbnail : (raw.videoThumbnails || []).find(t => t.quality === 'medium')?.url;
    return {
      kind: 'online', id: 'yt:' + id, videoId: id, provider, endpoint,
      title: String(raw.title || 'Sin título'), artist: String(raw.uploaderName || raw.author || ''),
      dur: Number(raw.duration || raw.lengthSeconds) || 0,
      thumb: https(thumb), coverUrl: https(thumb),
      link: 'https://www.youtube.com/watch?v=' + id, canSave: false,
    };
  }
  function pickAudio(formats, quality, canPlayType = () => 'probably') {
    const supported = formats.filter(f => https(f.url) && /^audio\//i.test(f.mime || '') && canPlayType(f.mime));
    // AAC/M4A ofrece compatibilidad con Safari; nunca se usa un stream de video.
    const aac = supported.filter(f => /audio\/(mp4|aac|mpeg)/i.test(f.mime));
    const candidates = (aac.length ? aac : supported).sort((a, b) => a.bitrate - b.bitrate);
    const target = Number(quality) * 1000;
    return candidates.filter(f => f.bitrate <= target).at(-1) || candidates[0] || null;
  }
  function createClient({ request, canPlayType, endpoints = {} }) {
    const servers = provider => {
      if (!DEFAULTS[provider]) throw new Error('Fuente desconocida.');
      return endpoints[provider] ? [baseURL(endpoints[provider])] : DEFAULTS[provider];
    };
    async function search(provider, query, previous = null) {
      if (!query) return { items: [], query, page: 0, hasMore: false };
      const page = previous ? previous.page + 1 : 1;
      const list = previous ? [previous.endpoint] : servers(provider);
      for (const endpoint of list) {
        try {
          const params = new URLSearchParams({ q: query });
          let path;
          if (provider === 'piped') {
            params.set('filter', 'music_songs');
            if (previous?.nextpage) params.set('nextpage', previous.nextpage);
            path = previous ? '/nextpage/search' : '/search';
          } else {
            path = '/api/v1/search'; params.set('type', 'video'); params.set('page', page);
          }
          const result = await request(endpoint + path + '?' + params, 7000);
          const rows = provider === 'piped' ? result?.items : result;
          if (!Array.isArray(rows)) throw new Error('Respuesta inválida');
          const items = rows.filter(r => provider === 'piped' ? r.type === 'stream' : r.type === 'video')
            .map(r => mapTrack(r, provider, endpoint)).filter(Boolean);
          return { items, query, page, endpoint, nextpage: result.nextpage || '',
            hasMore: provider === 'piped' ? !!result.nextpage : rows.length > 0 };
        } catch {}
      }
      throw new Error('No se pudo consultar esta fuente. Prueba la otra o revisa el servidor en Ajustes.');
    }
    async function resolve(track, quality, excluded = []) {
      if (!ID.test(track.videoId || '')) throw new Error('Canción inválida.');
      const other = track.provider === 'piped' ? 'invidious' : 'piped';
      const candidates = [
        ...(track.endpoint && servers(track.provider).includes(track.endpoint) ? [{ provider: track.provider, endpoint: track.endpoint }] : []),
        ...[track.provider, other].flatMap(provider => servers(provider).map(endpoint => ({ provider, endpoint }))),
      ];
      const seen = new Set(excluded);
      for (const { provider, endpoint } of candidates) {
        if (seen.has(endpoint)) continue;
        seen.add(endpoint);
        try {
          const path = provider === 'piped' ? '/streams/' : '/api/v1/videos/';
          const result = await request(endpoint + path + track.videoId + (provider === 'invidious' ? '?local=true' : ''), 7000);
          if (result?.error) continue;
          const formats = provider === 'piped'
            ? (result.audioStreams || []).map(f => ({ url: f.url, mime: f.mimeType, bitrate: Number(f.bitrate) || 0 }))
            : (result.adaptiveFormats || []).map(f => ({ url: f.url, mime: f.type, bitrate: Number(f.bitrate) || 0 }));
          const chosen = pickAudio(formats, quality, canPlayType);
          if (chosen) return { ...chosen, provider, endpoint };
        } catch {}
      }
      throw new Error('No hay audio disponible en estos servidores. Prueba más tarde o configura otra instancia en Ajustes.');
    }
    return { search, resolve };
  }
  async function playWithFallback({ track, quality, resolve, start, isCurrent = () => true }) {
    const excluded = [];
    // Una URL entregada por la API todavía puede devolver 403 al reproductor.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!isCurrent()) return null;
      const stream = await resolve(track, quality, excluded);
      if (!isCurrent()) return null;
      if (excluded.includes(stream.endpoint)) break;
      excluded.push(stream.endpoint);
      try {
        await start(stream.url);
        return isCurrent() ? stream : null;
      } catch (err) {
        if (!isCurrent() || err.name === 'AbortError') return null;
        // El permiso del navegador requiere otro gesto, no otro servidor.
        if (err.name === 'NotAllowedError') throw err;
      }
    }
    throw new Error('Los servidores rechazaron el audio de esta canción.');
  }
  const api = { DEFAULTS, https, baseURL, videoID, mapTrack, pickAudio, createClient, playWithFallback };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MusicSources = api;
})(globalThis);
