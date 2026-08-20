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

- **Sin build step.** Todo el frontend vive en un único [`index.html`](index.html):
  HTML, estilos inline (objetos JS) y un componente React, todo en un mismo
  archivo.
- **React 18** y **Babel Standalone**, cargados desde CDN (`unpkg`) directo en
  el `<head>`. El JSX se transpila **en el navegador**, en tiempo real, dentro
  de un `<script type="text/babel">` — no hay Webpack/Vite ni `node_modules`.
- **Firebase Firestore** (SDK "compat", también desde CDN) para sincronizar
  entre dispositivos los valores de resorte que el usuario ingresa a mano.
- **Vercel Serverless Function** ([`api/config.js`](api/config.js)) que expone
  la config de Firebase leyendo variables de entorno, para no commitear esas
  claves en el HTML.
- **PWA**: [`manifest.json`](manifest.json) + iconos, para poder "instalar" la
  página como app en el celular/escritorio.

## Estructura del repositorio

```
.
├── index.html        # Toda la app: markup, estilos y componente React (JSX vía Babel in-browser)
├── api/
│   └── config.js      # Función serverless de Vercel: sirve la config de Firebase desde env vars
├── manifest.json      # Manifest de PWA (nombre, iconos, colores)
├── favicon.svg
├── icon-192.png
└── icon-512.png
```

No hay `package.json`: no se instala nada para correr la app, y Vercel
despliega `index.html` como sitio estático y `api/` como función serverless
sin paso de build.

## Cómo funciona, a alto nivel

1. El usuario elige el simulador en las pestañas de arriba (`iRacing`,
   `AC EVO`, `AC Rally`, `AMS2`).
2. Busca o filtra el carro (por categoría, tipo de cambio o resorte).
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

No hace falta ningún build. Alcanza con abrir `index.html` en el navegador
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

El proyecto está pensado para Vercel: detecta `index.html` como sitio
estático y `api/config.js` como función serverless automáticamente, sin
configuración adicional. Las tres variables de entorno de arriba se cargan
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
