# Mi Música — app web (PWA) para iPhone

## Archivos
- `index.html` — estructura de la app
- `style.css` — diseño
- `app.js` — lógica: biblioteca, reproductor, favoritos, pantalla de bloqueo
- `sw.js` — guarda la app para que abra sin internet
- `manifest.webmanifest` + `icons/` — nombre e ícono al instalarla

## Ponerla en internet (GitHub Pages, gratis)
1. Crea una cuenta en github.com.
2. Crea un repositorio público, por ejemplo `mi-musica`.
3. "Add file" → "Upload files" → arrastra TODO el contenido de esta carpeta (incluida la carpeta `icons`) → "Commit changes".
4. Settings → Pages → Source: "Deploy from a branch" → Branch: `main` / `(root)` → Save.
5. En 1-2 minutos estará en `https://TU-USUARIO.github.io/mi-musica/`.

## Instalarla en el iPhone
1. Abre ese enlace en **Safari**.
2. Botón Compartir → **"Agregar a pantalla de inicio"** → Agregar.
3. Abre la app desde el ícono y toca **+ Agregar** para elegir canciones de la app Archivos.

## Probarla en el PC
Dentro de esta carpeta: `python -m http.server 8765` y abre http://localhost:8765

## Si cambias el código
Sube los archivos de nuevo. La próxima vez que abras la app con internet cargará la versión nueva.

## Letras
En el reproductor, el botón **🎤 Letra** muestra la letra de la canción (de [LrcLib](https://lrclib.net), gratis y abierto).
Si está sincronizada, la línea actual se resalta y al tocar una línea la canción salta a ese momento.
En las canciones de la biblioteca la letra se guarda para verla sin internet.

## Buscar en internet (pantalla Buscar)

- **Invidious** (fuente inicial): busca en YouTube; al tocar un resultado se solicita un stream de audio compatible con el navegador.
- **Piped**: búsqueda con el filtro musical y paginación mediante continuaciones. Usa el mismo reproductor de audio.
- **Catálogo**: fragmentos de iTunes de 30 segundos.
- **Archivo**: álbumes con licencia libre de Internet Archive. Las descargas disponibles se guardan en la biblioteca.
- **Radio**: emisoras en vivo de Radio Browser, con selección de país.

JioSaavn y su servidor anterior se retiraron de las búsquedas y del reproductor.

## Piped e Invidious: integración experimental

`sources.js` implementa los contratos de [Piped](https://docs.piped.video/docs/api-documentation/) e [Invidious](https://docs.invidious.io/api/). No usa un reproductor de video ni descarga estas canciones a la biblioteca. Resuelve el audio al iniciar cada canción, prefiere AAC/M4A para Safari y solo acepta formatos de audio HTTPS compatibles.

Instancias públicas predeterminadas:

- Invidious: `https://yt.chocolatemoo53.com`
- Piped: `https://pipedapi.ducks.party` y `https://api.piped.private.coffee`

Si un servidor no entrega formatos de audio, se prueban las otras instancias incluidas, hasta tres solicitudes de siete segundos. Si un enlace de audio es rechazado al comenzar la reproducción, el reproductor intenta otra instancia, con un máximo de tres enlaces y doce segundos para iniciar cada uno. Los permisos de reproducción del navegador no disparan cambios de servidor. Al agotar los intentos se muestra un aviso persistente, se libera el audio fallido y se permite reintentar desde el aviso o el mini reproductor. No se implementa evasión de CAPTCHA, inicio de sesión, acceso restringido ni controles de protección.

### Estado de la verificación real

Las búsquedas reales funcionaron con CORS en las tres instancias anteriores y devolvieron canciones de Shakira. La reproducción completa **no quedó verificada**:

- Las dos instancias de Piped devolvieron `LOGIN_REQUIRED` al consultar audio de la canción probada.
- Invidious devolvió formatos de audio, pero la solicitud parcial del stream (siguiendo el redireccionamiento de su proxy) respondió HTTP 403.

La integración puede mostrar resultados sin que haya audio reproducible. No se promete catálogo completo, ausencia permanente de anuncios ni reproducción en segundo plano con el iPhone bloqueado. Esta última requiere prueba en el dispositivo.

En **Ajustes → Servidores de música** se puede configurar una instancia HTTPS propia compatible. Dejar los campos vacíos restaura los valores públicos. Las direcciones se guardan solo en el navegador; no deben contener usuario, contraseña, consultas ni fragmentos. GitHub Pages sigue sirviendo una web estática, sin un backend propio.

## Herramientas conservadas

- Inicio con colección, favoritas y últimas canciones agregadas.
- Biblioteca local, importación, búsqueda, favoritos y eliminación.
- Mini reproductor y reproductor completo con posición, aleatorio, repetición, letras y controles de bloqueo.
- Calidad del audio en línea (96, 160 o 320 kbps como objetivo, según los formatos disponibles).
- Ocho búsquedas recientes de Piped/Invidious, guardadas localmente y con opción de borrado.
- Descargas de Archivo cuando están disponibles, Radio por país y Catálogo.

## Interfaz y créditos

La interfaz adapta la paleta esmeralda, superficies translúcidas, tarjetas y navegación de Melotune. Se conserva la marca Mi Música. Créditos y licencia: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Pruebas

`node --test tests/sources.test.cjs`

Comprueban consultas y paginación de ambas APIs, fallos de instancia, elección de audio compatible, configuración HTTPS, exclusión de streams de video y actualización de servidor. Son pruebas con respuestas simuladas; no certifican la disponibilidad de las instancias públicas.

### Diagnóstico de «Un Sueño»

La canción de la captura se encontró en Invidious (`3aws_FqP8OE`). Al solicitar bytes del audio con redirecciones, el servidor respondió HTTP 403 y contenido HTML en lugar de audio. Piped devolvió `LOGIN_REQUIRED` para el mismo ID. La corrección del reproductor maneja esos rechazos e intenta la alternativa disponible; no elimina el bloqueo del proveedor.
