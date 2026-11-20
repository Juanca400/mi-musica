# Servidor de prueba para SoundCloud y YouTube.js

Este directorio prepara la API necesaria para conectar estas bibliotecas a Mi Música. **No está desplegado ni conectado a la web pública.** GitHub Pages no ejecuta Python ni Node.js.

## Prueba real obtenida

- `soundcloud-v2` 1.7.0 encontró «Un Sueño» de Rakim y Ken-Y sin sesión de usuario. La resolución y el manifiesto HLS respondieron 200; un fragmento respondió 206 con formato `audio/mp4`.
- Las respuestas de búsqueda y resolución no incluyeron CORS para `https://juanca400.github.io`, por eso necesitan este servidor. El manifiesto y el audio sí respondieron con CORS `*`.
- YouTube.js 18.3.0 se instaló, pero la red del entorno rechazó la conexión a YouTube (el túnel HTTPS devuelve 403). **No se verificó reproducción con YouTube.js**; esto no demuestra que falle en otra red.

## Ejecutar

Requiere Python 3.12 y Node.js 24. Desde `backend/`:

```sh
python -m venv .venv
.venv/bin/pip install -r requirements.txt
npm ci
.venv/bin/python server.py
```

`PORT` configura el puerto (8787 por defecto). `API_ORIGINS` admite una lista separada por comas; por defecto permite la web actual. Para publicar, el servicio necesita alojamiento HTTPS que ejecute ambos procesos. No se incluyen credenciales, cookies de usuario, sesiones Premium ni mecanismos para sortear restricciones.

## Rutas

- `GET /api/health`: proceso activo; no certifica disponibilidad de las fuentes.
- `GET /api/search?provider=soundcloud&q=Un%20Sueño`: hasta veinte resultados públicos reproducibles.
- `GET /api/resolve?provider=soundcloud&id=ID`: devuelve `url`, `mime` y `transport` (`hls` o `direct`).
- Las mismas dos rutas con `provider=youtubejs` usan YouTube.js.

Los IDs son específicos de cada plataforma. Los errores de proveedor se devuelven como HTTP 502, no como búsquedas vacías o reproducción exitosa. Se excluyen los formatos de SoundCloud marcados como fragmentos y las canciones bloqueadas.

## Paso pendiente para la web

Hace falta una URL pública HTTPS para esta API. Después se podrá conectar el buscador y añadir soporte HLS al reproductor (Safari lo soporta de forma nativa; otros navegadores pueden necesitar hls.js). Esta preparación no cambia las fuentes de la página publicada ni promete reproducción con pantalla bloqueada. No conviene añadir botones que aparenten funcionar antes de comprobar esta conexión.

Bibliotecas de referencia: [soundcloud.py](https://github.com/7x11x13/soundcloud.py) y [YouTube.js](https://github.com/LuanRT/YouTube.js), ambas bajo licencia MIT. Se instalan como dependencias; no se copia su código fuente.

## Contenedor listo para alojar

```sh
docker build -t mi-musica-api .
docker run --rm -p 8787:8787 mi-musica-api
```

El `Dockerfile` incluye Python y Node. El alojamiento debe proporcionar HTTPS y permitir solicitudes salientes a los proveedores. Los resultados de esta prueba no garantizan que SoundCloud acepte la red del futuro alojamiento.

La prueba HTTP del servidor local devolvió 200 con dieciocho resultados de SoundCloud, 200 al resolver la canción y 200 al solicitar su manifiesto HLS. El endpoint de YouTube.js devolvió 502 con un mensaje de indisponibilidad. También se comprobaron el rechazo de orígenes ajenos (403) y de proveedores inválidos (400). El contenedor no se construyó en este entorno.
