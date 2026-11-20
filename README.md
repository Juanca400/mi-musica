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

## Fuentes disponibles

Se retiraron SoundCloud, YouTube.js, Piped, Invidious, iTunes y los servidores de prueba. También se retiraron el widget, el soporte HLS de esas integraciones, sus endpoints y el servidor Python/Node de prueba. No se altera la base de datos de canciones guardadas.

Se conservan:

- **Biblioteca**: archivos locales, importación, búsqueda, favoritos y eliminación.
- **Reproductor**: mini reproductor, controles, posición, aleatorio, repetición, letras y controles del sistema.
- **Archivo**: álbumes de música libre de Internet Archive, con guardado cuando esté disponible. No es un catálogo comercial mundial.
- **Radio**: emisoras en vivo, con filtro por país. No permite elegir cualquier canción a demanda.
- **Búsquedas recientes**: hasta ocho búsquedas de Archivo y Radio, guardadas localmente y con opción de borrado.

## Catálogo comercial completo pendiente

No hay un nuevo catálogo comercial conectado. Las alternativas oficiales comprobadas para reproducir canciones completas dentro de una web son [Apple Music con MusicKit](https://developer.apple.com/musickit/) y [Spotify con Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk/howtos/web-app-player). Requieren suscripción del oyente y configuración de una aplicación de desarrollador. No se verificó un servidor público gratuito que sustituya esos requisitos ni ofrezca todo el catálogo.

La [versión privada de Sites](https://mi-musica-online.edgedshore6.chatgpt.site) conserva las mismas herramientas y también retira las integraciones anteriores. Cada dominio conserva por separado su biblioteca en el navegador.

## Créditos

La interfaz adapta el estilo de Melotune. Véase [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
