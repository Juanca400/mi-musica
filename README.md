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

## Buscar en internet (pestaña 🌐 Internet)
- **JioSaavn** (fuente inicial): busca canciones y artistas, reproduce el audio disponible y carga más resultados. Incluye un enlace al servicio original. Requiere conexión; el catálogo y la reproducción pueden variar según la región.
- **Completas**: canciones completas que los artistas suben a Audius (sin clave). Suenan con la pantalla bloqueada; ⬇ aparece cuando el artista permite descargarla.
- **Catálogo**: catálogo de iTunes, fragmentos de 30 segundos (no se pueden guardar).
- **Archivo**: álbumes completos con licencia libre de Internet Archive; con ⬇ se guardan en la biblioteca.
- **Radio**: emisoras en vivo (Radio Browser). Se puede filtrar por país (o "Todos los países"); sin buscar, muestra las más escuchadas del país elegido. La app recuerda el último país.

## Integración JioSaavn

La app consulta `https://saavn.sumit.co/api`, un servicio de terceros **no oficial**, con CORS para funcionar en GitHub Pages sin servidor. No requiere ni solicita credenciales de JioSaavn. La búsqueda usa `/search/songs` con paginación; los enlaces de audio antiguos se actualizan mediante `/songs/{id}` antes de reproducir.

No se garantiza acceso a todo el catálogo, reproducción continua en segundo plano en todos los dispositivos, ni disponibilidad permanente de esta API. Si falla, se muestra un error y se puede abrir JioSaavn. Las canciones de esta fuente no se descargan a la biblioteca. La reproducción está sujeta a la disponibilidad y condiciones del proveedor.

## Mejoras adaptadas de Melotune iOS

- **Calidad de JioSaavn**: 96, 160 o 320 kbps. Se guarda en este navegador y se aplica al iniciar una canción; si esa calidad falta, se usa la mejor disponible. Cambiarla no interrumpe la canción actual.
- **Búsquedas recientes**: el campo de JioSaavn ofrece las últimas ocho búsquedas como sugerencias. Se guardan localmente y se pueden borrar con el botón correspondiente.
- **Servidor alternativo**: si `saavn.sumit.co` falla, la app intenta `https://melotune.harshbits.com/api`, usado por Melotune. La paginación se adapta a cada servidor (el de Melotune comienza en cero). Ambos son servicios de terceros; no garantizan otro catálogo ni acceso a canciones restringidas. Una consulta puede tardar hasta unos 16 segundos antes de fallar.

Referencia y licencia: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). La interfaz y las funciones nativas de iOS de Melotune requieren una app Swift/Xcode y no se incorporan a esta web.

## Verificación de la integración

Con Node.js: `node --test tests/saavn.test.cjs`. Comprueba la selección y persistencia de calidad, renovación de audio, conmutación de servidores y borrado del historial.
