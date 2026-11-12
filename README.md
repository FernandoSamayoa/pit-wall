# PIT WALL

Configurador de rig para sim racing. Para un rig fijo (pedales VRS Pro, base
Fanatec Direct Drive, 4 aros intercambiables y palanca de cambios H/secuencial),
la app le dice al usuario, carro por carro, **qué aro poner, en qué modo dejar
la palanca y qué resorte de freno usar**, para los catálogos de:

- iRacing
- Assetto Corsa EVO
- Assetto Corsa EVO — Rally
- Automobilista 2 (AMS2)

No hay backend de "recomendación": todo es un conjunto de reglas fijas que
corren en el navegador sobre datos de carros hardcodeados en el propio HTML.
Lo único que toca un servidor es la sincronización opcional de los valores de
presión de freno (kg) entre dispositivos, vía Firebase.

## Stack técnico

- **Un solo archivo fuente.** Todo el frontend vive en [`index.html`](index.html):
  HTML, CSS (un `<style>` con clases `pw-*`) y un componente React.
- **React 18** desde CDN (`unpkg`). El JSX va dentro de un
  `<script type="text/babel">`: al abrir el archivo tal cual, **Babel
  Standalone** lo transpila en el navegador, así que para desarrollar no hace
  falta instalar nada.
- **Build de producción** ([`build.mjs`](build.mjs), con esbuild): al
  desplegar, Vercel compila y minifica ese JSX a un archivo aparte y publica
  un `index.html` sin Babel (~600 KB menos de descarga).
- **Firebase Firestore** (SDK "compat", desde CDN) para sincronizar entre
  dispositivos los valores que el usuario ingresa a mano. Se descarga después
  del primer pintado, no en el `<head>`.
- **Service worker** ([`sw.js`](sw.js)): guarda la app para abrirla rápido y
  sin conexión. Solo se registra en el sitio desplegado (https).
- **Vercel Serverless Function** ([`api/config.js`](api/config.js)) que expone
  la config de Firebase leyendo variables de entorno, para no commitear esas
  claves en el HTML.
- **PWA**: [`manifest.json`](manifest.json) + iconos, para poder "instalar" la
  página como app en el celular/escritorio.

## Estructura del repositorio

```
.
├── index.html        # Toda la app: markup, estilos y componente React (JSX)
├── build.mjs          # Build de producción: compila el JSX y arma dist/
├── sw.js              # Service worker (caché y uso sin conexión)
├── package.json       # Solo declara esbuild para el build
├── vercel.json        # Comando de build, carpeta de salida y cabeceras de caché
├── api/
│   └── config.js      # Función serverless de Vercel: sirve la config de Firebase desde env vars
├── manifest.json      # Manifest de PWA (nombre, iconos, colores)
├── favicon.svg
├── icon-192.png
└── icon-512.png
```

Para correr la app en local no se instala nada. Al desplegar, Vercel ejecuta
`npm run build`, publica la carpeta `dist/` como sitio estático y `api/` como
función serverless.

## Cómo funciona, a alto nivel

1. El usuario elige el simulador en las pestañas de arriba (`iRacing`,
   `AC EVO`, `AC Rally`, `AMS2`).
2. Busca o filtra el carro (por categoría, tipo de cambio o resorte). En
   "Mi setup" puede guardar el resorte, tie-rod y preload que tiene montados
   ahora y filtrar con un toque los carros (de cualquier simulador) que
   funcionan con esa configuración.
3. Al elegir un carro, `recomendar(car)` calcula el aro, el modo de palanca,
   el resorte sugerido y notas adicionales, combinando datos del carro con
   los valores por defecto de su categoría.
4. Si el carro usa resorte, el usuario puede guardar el valor real (en kg)
   que usó para calibrar el freno. Ese valor se guarda en `localStorage` y,
   si Firebase está disponible, también en Firestore bajo un "código de
   sincronización" de 8 caracteres — así puede recuperarlo desde otro
   dispositivo con el mismo código.

Para el detalle de cómo está armado el código y cómo modificarlo (agregar
carros, categorías, simuladores, o cambiar las reglas de recomendación), ver
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Ejecutar en local

No hace falta ningún build ni tener Node instalado. Alcanza con abrir `index.html` en el navegador
(doble clic, o `Start-Process index.html` en PowerShell). Con eso funciona
todo **excepto** la sincronización entre dispositivos: el `fetch('/api/config')`
va a fallar (no hay servidor sirviendo `/api`), la app lo captura, Firebase
nunca se inicializa, y el sync queda deshabilitado en silencio — el resto de
la app (búsqueda, filtros, recomendaciones, guardado en `localStorage`) sigue
funcionando igual.

Para probar también la función serverless y el sync con Firebase en local,
usar el CLI de Vercel:

```bash
npm i -g vercel
vercel link      # una sola vez, conecta esta carpeta con el proyecto de Vercel
vercel env pull  # trae las variables de entorno del proyecto a un .env local
vercel dev
```

Las variables que necesita `api/config.js` son:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`

## Despliegue

El proyecto está pensado para Vercel. [`vercel.json`](vercel.json) le indica
que ejecute `npm run build` y publique `dist/`; `api/config.js` se detecta
como función serverless automáticamente. El build genera:

- `dist/index.html`: la página sin Babel.
- `dist/assets/app.<hash>.js`: el JSX compilado y minificado. El hash cambia
  con el contenido, así que se cachea para siempre.
- `dist/sw.js`: el service worker con la versión del build; cada despliegue
  estrena su caché y borra la anterior.

Con Node instalado se puede probar el build en local con `npm install` y
`npm run build`. Las tres variables de entorno de arriba se cargan
en **Project Settings → Environment Variables** del proyecto en Vercel.

Las claves de Firebase Web no son secretas en el sentido estricto (quedan
visibles en la respuesta de `/api/config`, es normal en apps web de
Firebase), pero igual se sirven desde una función serverless en vez de
hardcodearlas en el HTML para poder rotarlas sin tocar código. La seguridad
real de los datos depende de las reglas de Firestore del proyecto (ver nota
en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#sincronización-firebase)).

## Licencia / contenido

Las descripciones de los carros de iRacing están adaptadas de las fichas
oficiales de iRacing. El resto del contenido (categorías, mapeos de aro,
palanca y resorte) es propio del proyecto.
