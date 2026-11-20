import { Innertube } from 'youtubei.js';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
setGlobalDispatcher(new EnvHttpProxyAgent());
const input = JSON.parse(await new Promise(resolve => {
  let data = ''; process.stdin.on('data', chunk => { data += chunk; }); process.stdin.on('end', () => resolve(data));
}));
try {
  const yt = await Innertube.create({ lang: 'es', location: 'CO',
    fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(12000) }),
  });
  if (input.action === 'search') {
    const search = await yt.search(input.query, { type: 'video' });
    const items = search.videos.slice(0, 20).map(v => ({
      id: v.id, title: v.title.toString(), artist: v.author?.name || '',
      duration: v.duration?.seconds || 0, image: v.thumbnails?.[0]?.url || '',
      link: 'https://www.youtube.com/watch?v=' + v.id,
    }));
    console.log(JSON.stringify({ items }));
  } else {
    const info = await yt.getBasicInfo(input.id);
    if (info.playability_status?.status !== 'OK') throw new Error('Audio no disponible en esta sesión.');
    const format = info.chooseFormat({ type: 'audio', quality: 'best', format: 'mp4' });
    // No se introducen cookies ni mecanismos para sortear bloqueos de acceso.
    const url = await format.decipher(yt.session.player);
    if (!url?.startsWith('https://')) throw new Error('No se obtuvo audio HTTPS.');
    console.log(JSON.stringify({ url, mime: format.mime_type, transport: 'direct' }));
  }
} catch {
  console.log(JSON.stringify({ error: 'YouTube.js no pudo acceder a este contenido desde el servidor. No se confirmó reproducción.' }));
  process.exitCode = 1;
}
