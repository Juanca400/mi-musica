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

## Buscar en internet (pestaña 🌐 Internet)
- **Completas**: canciones completas que los artistas suben a Audius (sin clave). Suenan con la pantalla bloqueada; ⬇ aparece cuando el artista permite descargarla.
- **Catálogo**: catálogo de iTunes, fragmentos de 30 segundos (no se pueden guardar).
- **Archivo**: álbumes completos con licencia libre de Internet Archive; con ⬇ se guardan en la biblioteca.
- **Radio**: emisoras en vivo (Radio Browser). Se puede filtrar por país (o "Todos los países"); sin buscar, muestra las más escuchadas del país elegido. La app recuerda el último país.
