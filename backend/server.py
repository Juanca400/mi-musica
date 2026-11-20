"""API de Mi Música. Solo consultas públicas; no solicita cuentas ni contraseñas."""
import json
import os
import re
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from itertools import islice
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
SC_LOCK = threading.Lock()
SC_CLIENT = None
ORIGINS = set(os.environ.get('API_ORIGINS', 'https://juanca400.github.io').split(','))


def soundcloud():
    global SC_CLIENT
    if SC_CLIENT is None:
        from soundcloud import SoundCloud
        SC_CLIENT = SoundCloud()  # Identificador público del cliente web; no usa sesión del usuario.
    return SC_CLIENT


def search_soundcloud(query):
    with SC_LOCK:
        sc = soundcloud()
        tracks = list(islice(sc.search_tracks(query, limit=20), 20))
        return {'items': [
            {'id': str(t.id), 'title': t.title, 'artist': t.user.username,
             'duration': (t.duration or 0) / 1000, 'image': t.artwork_url or '',
             'link': t.permalink_url}
            for t in tracks if t.streamable and t.policy not in ('BLOCK', 'SNIP')
        ]}


def resolve_soundcloud(track_id):
    with SC_LOCK:
        sc = soundcloud()
        track = sc.get_track(int(track_id))
        if not track or not track.streamable or track.policy in ('BLOCK', 'SNIP'):
            raise ValueError('Esta canción no ofrece audio completo público.')
        formats = [f for f in track.media.transcodings
                   if not f.snipped and f.format.mime_type.startswith(('audio/mp4', 'audio/mpeg'))]
        formats.sort(key=lambda f: f.format.protocol != 'progressive')
        for fmt in formats:
            response = sc._session.get(fmt.url, params={
                'client_id': sc.client_id, 'track_authorization': track.track_authorization,
            }, timeout=12)
            if response.status_code != 200:
                continue
            url = response.json().get('url', '')
            if url.startswith('https://'):
                return {'url': url, 'mime': fmt.format.mime_type,
                        'transport': 'hls' if fmt.format.protocol == 'hls' else 'direct'}
        raise ValueError('El proveedor no entregó audio completo compatible.')


def youtube(action, query='', track_id=''):
    result = subprocess.run(['node', str(ROOT / 'youtube.mjs')], input=json.dumps({
        'action': action, 'query': query, 'id': track_id,
    }), text=True, capture_output=True, timeout=35, cwd=ROOT)
    lines = result.stdout.strip().splitlines()
    if not lines:
        raise ValueError('YouTube.js no pudo iniciar o conectarse desde este servidor.')
    data = json.loads(lines[-1])
    if data.get('error'):
        raise ValueError(data['error'])
    return data


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Evita registrar consultas y enlaces temporales de reproducción.

    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        origin = self.headers.get('Origin')
        if origin in ORIGINS:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.headers.get('Origin') and self.headers['Origin'] not in ORIGINS:
            self.send_json(403, {'error': 'Origen no permitido.'})
            return
        route = urlparse(self.path)
        query = parse_qs(route.query)
        if route.path == '/api/health':
            self.send_json(200, {'status': 'ok', 'providers': ['soundcloud', 'youtubejs']})
            return
        if route.path not in ('/api/search', '/api/resolve'):
            self.send_json(404, {'error': 'Ruta desconocida.'})
            return
        provider = query.get('provider', [''])[0]
        if provider not in ('soundcloud', 'youtubejs'):
            self.send_json(400, {'error': 'Proveedor inválido.'})
            return
        try:
            if route.path == '/api/search':
                text = query.get('q', [''])[0].strip()
                if not text or len(text) > 200:
                    self.send_json(400, {'error': 'Escribe una búsqueda de 1 a 200 caracteres.'})
                    return
                data = search_soundcloud(text) if provider == 'soundcloud' else youtube('search', query=text)
            else:
                track_id = query.get('id', [''])[0]
                pattern = r'\d{1,20}' if provider == 'soundcloud' else r'[A-Za-z0-9_-]{11}'
                if not re.fullmatch(pattern, track_id):
                    self.send_json(400, {'error': 'Identificador inválido.'})
                    return
                data = resolve_soundcloud(track_id) if provider == 'soundcloud' else youtube('resolve', track_id=track_id)
            self.send_json(200, data)
        except ValueError as error:
            self.send_json(502, {'error': str(error)})
        except Exception:
            self.send_json(502, {'error': 'El proveedor no respondió. La disponibilidad no está garantizada.'})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', '8787'))
    print(f'API de Mi Música disponible en el puerto {port}', flush=True)
    ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
