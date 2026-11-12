# Arquitectura y guía de modificación

Todo el código de la app vive en un único archivo, [`index.html`](../index.html),
dentro de un `<script type="text/babel">`. No hay imports entre archivos ni
módulos: es un solo scope de arriba a abajo. Esta guía mapea qué hace cada
bloque y cómo tocarlo sin romper el resto.

> Los nombres de función/constante de abajo son estables y se pueden buscar
> con `Ctrl+F` en `index.html`; los números de línea no se mencionan porque
> se corren cada vez que se agrega un carro.

## 1. Mapa del archivo

De arriba a abajo, `index.html` tiene estas piezas, en este orden:

1. **`<head>`**: carga React 18, ReactDOM (builds de producción), el SDK
   "compat" de Firebase (`firebase-app-compat.js` +
   `firebase-firestore-compat.js`) y Babel Standalone, todos desde CDN.
   También las fuentes, el manifest de PWA, metatags, el `<style>` con
   **todo el CSS de la app** (clases `pw-*`) y el script de temas
   (`PW_THEMES`).
2. **Bootstrap de Firebase y `genSyncCode()`**: variable `CONFIGS` (se llena
   más tarde con la referencia a la colección de Firestore) y el generador
   del código de sincronización tipo `AB12-345`.
3. **`CATS`**: diccionario de categorías (`formula`, `gt3`, `rally`, etc.).
4. **`c(...)`**: función fábrica para crear un registro de carro.
5. **Cuatro arrays de carros**: `IRACING`, `ACEVO`, `ACRALLY`, `AMS2` — uno
   por simulador/pestaña.
6. **`GBS` y `GB_MAP`**: descripciones de comportamiento de caja de cambios y
   el mapeo carro → tipo de caja, usados solo para la pestaña de iRacing.
7. **`gearboxOf(car)`**: resuelve qué entrada de `GBS` le corresponde a un carro.
8. **`WHEELS`, `SHIFTS`, `SPRINGS`, `BRAKES`**: textos y explicaciones para
   cada aro y modo de palanca, y los **perfiles de freno** (resorte, tie-rod,
   preload, rango de kg y explicación), agrupados por tipo de asistencia.
9. **`recomendar(car)`**: la función central. Devuelve `{ wheel, wheelKey,
   spring, springKey, brake, brakeId, shift, notas, kg }` para un carro dado.
10. **Componentes de presentación**: `PressureBar`, `MiniGauge`, `Spring`
    (SVG del resorte), `WheelIcon` (SVG del aro), `WHEEL_LABELS`,
    `ShiftIcon`, `Ico` y `Modal` (ventana que se cierra con Escape, con la ×
    o tocando fuera).
11. **`SIMS`**: la lista de simuladores/pestañas (`k`, nombre, versión y
    array de carros). Es la única fuente de las versiones que se muestran
    en las pestañas y en el pie de la lista.
12. **`App()`**: el componente principal — estado, efectos (Firebase, sync,
    localStorage, historial) y todo el render.
13. **Última línea**: `ReactDOM.createRoot(...).render(<App />)`.

### Estilos

No hay CSS externo ni Tailwind: todo vive en el `<style>` del `<head>`, con
clases `pw-*` y los colores siempre como variables del tema. Las clases
`.rojo` / `.azul` exponen el color del resorte como `--sc` (relleno) y
`--sct` (texto), así un mismo componente se pinta de uno u otro color con
solo cambiar la clase.

Los estilos inline quedan solo para valores calculados (posiciones de los
gauges, colores literales de la vista previa de temas). En esos casos
**no usar abreviadas con `var()`** (`background`, `border`, `borderColor`):
Safari deja de repintarlas cuando React las alterna. Usar `backgroundColor`
y propiedades por lado, o mejor una clase.

El layout tiene dos modos, decididos por CSS (`.pw-main` + `.has-sel`):

- **Menos de 1000 px**: se ve la lista **o** la ficha, nunca las dos.
- **1000 px o más**: lista a la izquierda y ficha a la derecha, cada una
  con su propio scroll (la página en sí no se desplaza).

## 2. Modelo de datos de un carro

Cada carro se crea con la función fábrica:

```js
const c = (n, cat, y, t, i, o) => ({ n, cat, y, t, i, ...(o || {}) });
```

| Campo | Significado |
|---|---|
| `n` | Nombre del carro (también se usa como `key` de React en las listas). |
| `cat` | Clave de categoría, debe existir en `CATS`. |
| `y` | Año (se muestra en el detalle del carro). |
| `t` | Código de transmisión (ver tabla abajo). |
| `i` | Texto descriptivo del carro (se muestra en la ficha). |
| `o` | Objeto opcional de overrides: `{ w, b, s, kg, notas }`. |

`o.w` (aro) y `o.b` (perfil de freno, clave de `BRAKES`) **sobreescriben**
el default de la categoría (`CATS[cat].w/b`) solo para ese carro puntual —
por ejemplo, la categoría `clasico` usa el perfil `clasicoCalle` (azul),
pero el Lotus 79 fuerza `b: "raceNoServo"` porque un F1 histórico frena sin
servo y con fuerzas de competición. `o.s` (resorte) y `o.kg` (rango) siguen
existiendo como ajuste fino por encima de lo que diga el perfil, pero en la
práctica casi todo se resuelve eligiendo el perfil `b` correcto.

`o.notas` es un array de strings; se muestran como bullets bajo "NOTAS DE
BOXES" en la ficha del carro. Usalas para matices puntuales que las reglas
genéricas de `recomendar()` no puedan capturar (cajas dogleg, punta-tacón,
volantes pequeños por fidelidad histórica, etc).

### Códigos de transmisión (`t`)

| Código | Significado | Efecto en la recomendación |
|---|---|---|
| `L` | Levas (paddle shift) | Aro con levas (`gt3`, `neo`, `formula` o `podium` según categoría). |
| `S` | Secuencial por palanca | Palanca Fanatec en modo secuencial. |
| `H` | Manual en H | Palanca en H + pedal de embrague VRS. |
| `HD` | Manual en H, patrón *dogleg* | Igual que `H`, pero con nota aclarando que la 1ª va abajo-izquierda. |
| `N` | Sin cambios (directo o marcha única) | Ni palanca ni levas. |
| `A` | Automático | Tratado igual que `L` para el aro (levas opcionales). |

## 3. Categorías (`CATS`) y perfiles de freno (`BRAKES`)

Cada entrada de `CATS` define el **default** de aro (`w`) y de perfil de
freno (`b`) para todos los carros de esa categoría, salvo que el carro
individual lo sobreescriba con `o`:

```js
gt3: { label: "GT3", w: "neo", b: "gt3" },
```

Los valores válidos de `w` son las claves de `WHEELS`: `"redondo"`, `"gt3"`,
`"neo"`, `"formula"`, `"podium"`. Los de `b` son las claves de `BRAKES`.

`BRAKES` agrupa los frenos **por tipo de asistencia (boost)**, no por color
de resorte: un carro de calle con servo de vacío y un carro de copa sin
servo usan los dos resorte azul, pero son perfiles distintos, con tie-rod,
preload, rango de kg y valor guardado propios. Cada perfil define:

```js
gt3: {
  nombre: "GT3 / Cup",
  s: "rojo", tie: "Stock", pre: "Leve", kg: "85–110",
  porque: "Más downforce y velocidad de frenada que GT4…",
},
```

Los perfiles actuales, de menor a mayor fuerza: `dirt`, `oval`, `offroad`,
`hiper`, `clasicoCalle`, `turismo`, `ligero`, `calle`, `rally` (todos azul)
y `formulaJunior`, `gt4`, `raceNoServo`, `gt3`, `gte`, `supercars`, `proto`,
`formula` (todos rojo). **Todos los carros de rally comparten el perfil
`rally`**, separado del de calle aunque ambos sean azules.

## 4. `recomendar(car)`

Resume la lógica de negocio de toda la app:

1. Toma los defaults de la categoría (`CATS[car.cat]`).
2. `wheelKey = car.w || meta.w` y `brakeId = car.b || meta.b` — el carro
   gana si define algo, si no se usa el default de la categoría. Del perfil
   salen `brake = BRAKES[brakeId]`, `springKey = car.s || brake.s` y
   `kg = car.kg || brake.kg`.
3. Arma la lista de `notas`: empieza con `car.notas` y le agrega notas
   automáticas para casos conocidos (salida con levas de embrague en
   Formula/GT3, ausencia de embrague en el aro `podium`, ausencia de levas
   en el aro `redondo` para autos de palanca en H).

Si necesitás cambiar **qué aro/perfil de freno corresponde a qué categoría**,
tocá `CATS`. Si necesitás cambiar **el resorte/tie-rod/preload/kg de un
perfil**, tocá `BRAKES`. Si necesitás cambiar **una nota o regla que depende
de la combinación aro+transmisión**, tocá `recomendar()`.

## 5. Caja de cambios de iRacing (`GBS` / `GB_MAP` / `gearboxOf`)

Este bloque solo se usa cuando `sim === "ir"` (pestaña iRacing), para mostrar
el bloque "CAJA DE CAMBIOS · iRACING" con instrucciones de cómo subir/bajar
marcha para ese carro puntual (con o sin embrague, con o sin *blip*, etc).

- `GBS` es un diccionario de "tipos de caja" (`semiAuto`, `dct`, `dogSeqCut`,
  `dogSeqNoCut`, `dogH`, `synchroH`, `dog12`, `direct`, `autoMS`), cada uno
  con su texto de instrucciones.
- `GB_MAP` es una lista de `[substring del nombre del carro, tipo de caja]`.
  `gearboxOf(car)` recorre `GB_MAP` en orden y usa el primer `substring` que
  aparezca dentro de `car.n`. Si ninguno matchea, cae a un default según el
  código de transmisión (`t`).

Para agregar un carro de iRacing con una caja particular, sumá una entrada a
`GB_MAP` con un fragmento único de su nombre. Si no agregás nada, el carro
recibe el comportamiento genérico según su código `t` (ver el `if/else` al
final de `gearboxOf`).

## 6. Componente `App()`

### Estado

| Estado | Para qué |
|---|---|
| `sim` | Pestaña activa (`"ir" \| "ac" \| "acr" \| "ams"`). |
| `cat`, `trans`, `spring`, `tie`, `pre` | Filtros activos de categoría / transmisión / resorte / tie-rod / preload. Los de tie-rod y preload comparan contra el rango del perfil de freno (`TIE_LEVELS` / `PRE_LEVELS`): un perfil con rango como "0 a leve" coincide con los filtros 0 y Leve. |
| `orden` | Orden de la lista: `"az"` (alfabético) o `"cat"` (agrupada por categoría, en el orden de `CATS`). |
| `filtrosAbiertos` | Si el panel de filtros está desplegado. |
| `q` | Texto de búsqueda. |
| `sel` | Carro seleccionado. También vive en el historial del navegador (`history.state = { pw: "car", sim, n }`): "atrás" vuelve a la lista y recargar conserva la ficha. Abrirlo y cerrarlo pasa siempre por `selectCar()` / `closeCar()`. |
| `descAbierta` | Si la descripción del carro se muestra completa (por defecto, 3 líneas). |
| `syncCode` | Código de 8 caracteres para sincronizar entre dispositivos; se genera una vez y se persiste en `localStorage`. |
| `syncModal`, `codeInput`, `copiado` | Ventana de sincronización: el código propio, el aviso de "copiado" y el campo para escribir el código de otro dispositivo. |
| `theme`, `themeOpen` | Tema activo y visibilidad de la ventana de temas. |
| `syncing`, `firebaseReady` | Estado de la sincronización con Firestore. |
| `customKg` | Mapa `"sim:perfilDeFreno" -> valorEnKg` con los valores reales que el usuario ingresó (p. ej. `"ir:gt3": 92`). |
| `tieMm` | `{ corta?, larga? }` en mm: longitudes de tie-rod del usuario, **globales** (un solo valor para todos los carros y sims). El stock es la constante `TIE_STOCK_MM` (43 mm) y nunca cambia. |
| `tieModal`, `tieDraft` | Visibilidad y valores en edición de la ventana "modificar" del tie-rod. |
| `preMm` | Mapa `"resorte\|tieRod\|nivel" -> mm` con los valores de preload del usuario, por **combinación física** (p. ej. `"rojo\|Corta\|1": 9`). El nivel es el índice en `PRE_STOPS` (`0`=0, `1`=Leve, `2`=Moderado); todos los carros que compartan la combinación muestran el mismo valor. Si un perfil cambia de tie-rod o de nivel, la clave vieja se renombra al cargar con `migrarPreMm()` / `PRE_MIGRACIONES` para no perder los milímetros ya medidos. |
| `preModal`, `preDraft` | Visibilidad y valores en edición de la ventana "modificar" del preload; la modal solo ofrece los niveles que aplican al carro seleccionado (uno para nivel fijo, dos para rangos como "0 a leve"). |
| `miSetup` | `{ spring?, tie?, pre? }`: el resorte (`"rojo"`/`"azul"`), tie-rod (`TIE_STOPS`) y preload (`PRE_STOPS`) que el usuario tiene montados **ahora**. Global (no depende del sim ni del carro) y todos los campos son opcionales. Se limpia con `sanearSetup()` al leerlo de `localStorage` o Firestore, así que un valor corrupto o desconocido se descarta. |
| `miSetupOn` | Si la lista se está filtrando por `miSetup`. Solo filtran los campos definidos, con la misma lógica de rangos que los filtros manuales (un perfil "0 a leve" coincide con 0 y Leve), y se suma a los demás filtros. A diferencia de ellos, **no se resetea al cambiar de pestaña**, para poder comparar sims con el mismo setup. |
| `setupModal`, `setupDraft` | Visibilidad y valores en edición de la ventana "Mi setup actual". |

### Efectos (`useEffect`)

1. **Al montar**: hace `fetch('/api/config')`, inicializa Firebase con esa
   config y guarda la referencia a la colección `configs` en `CONFIGS`. Si
   falla (por ejemplo en local sin `vercel dev`), solo loguea un warning y
   la app sigue funcionando sin sync.
2. **Cuando cambia `syncCode` o `firebaseReady`**: lee el documento
   `configs/{syncCode}` de Firestore y, si tiene `customKg`, lo carga (con
   un flag `skipNextSave` para no volver a escribir lo que se acaba de leer).
3. **Cuando cambia `customKg`, `tieMm`, `preMm` o `miSetup`**: los guarda siempre en
   `localStorage` (`pitwall_kg`, `pitwall_tie_mm`, `pitwall_pre_mm`,
   `pitwall_mi_setup`), y —si
   Firebase está listo— programa una escritura a Firestore con *debounce* de
   800ms (`saveTimer`) para no escribir en cada tecla.

### Datos derivados

- `data`: el array de carros del `sim` activo (`IRACING` / `ACEVO` /
  `ACRALLY` / `AMS2`).
- `cats`: categorías presentes en `data`, en el orden en que aparecen en
  `CATS` (para que los chips de filtro salgan en un orden consistente).
- `lista`: `data` filtrado por categoría/transmisión/resorte/tie-rod/
  preload/búsqueda y ordenado alfabéticamente.

### Render

- **Cabecera**: marca, pestañas de simulador (`SIMS`) y los botones "Sync"
  y "Tema", que abren sus ventanas.
- **Lista** (`.pw-list`): barra fija con el buscador (`/` lo enfoca), el
  botón "Filtros" y una fila con el toggle "★ Mi setup", los filtros
  activos como píldoras y el conteo. El panel de filtros trae el resumen de
  `miSetup`, los chips de categoría/cambio/resorte/tie-rod/preload y el
  orden. Cada fila muestra el color del resorte, el nombre y el tipo de
  cambio.
- **Ficha** (`.pw-detail`): título y descripción, tres mosaicos de resumen
  (volante, cambio, freno) y debajo las tarjetas con el detalle: VOLANTE,
  CAMBIO, CAJA DE CAMBIOS (solo iRacing), FRENO VRS (gauges, barra de
  presión e input de kg reales) y NOTAS DE BOXES. Sin carro elegido, en
  escritorio muestra un estado vacío.

## 7. Sincronización (Firebase) {#sincronización-firebase}

- **Qué se sincroniza**: `customKg` (valores reales de freno), `tieMm`
  (longitudes corta/larga del tie-rod, en mm) y `preMm` (preload en mm por
  combinación resorte + tie-rod + nivel) y `miSetup` (resorte, tie-rod y
  preload que el usuario tiene montados ahora). Todo lo demás (filtros,
  selección, si el filtro "mi setup" está activo) es efímero y no se persiste.
- **Cómo se identifica un dispositivo/usuario**: no hay login. El
  "código de sync" (`XXXX-999`) generado por `genSyncCode()` es literalmente
  la clave del documento en Firestore (`configs/{syncCode}`). Cualquiera que
  tenga el código puede leer y sobreescribir ese documento — no hay
  autenticación ni reglas de propiedad. Si en algún momento se agrega
  auth de usuarios, este es el lugar para revisarlo.
- **Formato del documento**:

  ```js
  {
    customKg: { "ir:gt3": 92, "ac:calle": 61, ... },
    tieMm: { corta: 38, larga: 51 },
    preMm: { "rojo|Larga|2": 12, "rojo|Corta|0": 7, ... },
    miSetup: { spring: "rojo", tie: "Stock", pre: "Moderado" },
  }
  ```

  La clave de `customKg` combina el simulador y el **perfil de freno**
  (`BRAKES`), para que un mismo perfil en distintos sims no pise el valor
  del otro, y para que perfiles distintos (calle vs. rally vs. GT3) nunca
  compartan valor aunque usen el mismo resorte o el mismo rango de kg. La
  clave de `preMm` es la combinación física `resorte|tieRod|nivel`, común a
  todos los sims: dos carros con la misma combinación comparten el valor.
- **Config de Firebase**: no está hardcodeada en `index.html`. Se pide en
  runtime a `/api/config` ([`api/config.js`](../api/config.js)), que lee
  `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN` y `FIREBASE_PROJECT_ID` de las
  variables de entorno de Vercel y las devuelve como JSON (con
  `Cache-Control: public, max-age=3600`).

## 8. Guías paso a paso

### Agregar un carro a un simulador existente

1. Abrí `index.html` y ubicá el array del simulador (`IRACING`, `ACEVO`,
   `ACRALLY` o `AMS2`).
2. Buscá el comentario `// ---------- CATEGORÍA ----------` de la categoría
   que corresponda (o agregá una nueva sección si hace falta) y sumá una
   línea con `c(...)`:

   ```js
   c("Nombre del carro", "gt3", 2024, "L", "Descripción del carro."),
   ```

3. Si el carro necesita un aro o un perfil de freno distinto al default de
   su categoría, o notas propias, agregá el 6º argumento:

   ```js
   c("Nombre del carro", "gt3", 2024, "L", "Descripción.", {
     w: "podium", b: "turismo",
     notas: ["Nota puntual de este carro."],
   }),
   ```

4. Si es un carro de iRacing y su caja de cambios necesita instrucciones
   distintas a las del default por código `t`, sumá una entrada a `GB_MAP`
   con un fragmento único de su nombre.

No hace falta build ni reinicio de nada: es HTML servido tal cual.

### Agregar una categoría nueva

Sumá una entrada a `CATS` con label, aro y perfil de freno por defecto:

```js
misilcars: { label: "Carros misil", w: "formula", b: "formula" },
```

Si ningún perfil de `BRAKES` encaja, definí uno nuevo ahí mismo (resorte,
tie-rod, preload, rango de kg y explicación) y referencialo desde `b`.

Los carros que usen `"misilcars"` como `cat` van a heredar esos defaults
salvo que los sobreescriban individualmente.

### Agregar un simulador/pestaña nuevo

1. Creá el array de carros, por ejemplo `const RFACTOR2 = [ ... ];`, con el
   mismo formato que los otros (usando `c(...)`).
2. Sumá una entrada a `SIMS`; con eso aparecen la pestaña, el catálogo y
   la versión en el pie:

   ```js
   { k: "rf2", name: "rFactor 2", v: "vX.Y", data: RFACTOR2 },
   ```

   Para actualizar la versión de un simulador existente, cambiá su `v` ahí
   mismo.

3. El bloque "CAJA DE CAMBIOS" solo se renderiza si `sim === "ir"`; dejalo
   así salvo que el simulador nuevo también necesite ese nivel de detalle
   (en ese caso, habría que generalizar `gearboxOf`/`GB_MAP` para que
   dependan también de `sim`, hoy asumen iRacing).

### Cambiar qué aro/perfil de freno le corresponde a una categoría completa

Editá el default en `CATS`. Afecta a todos los carros de esa categoría que
no tengan su propio override (`o.w` / `o.b`).

### Cambiar el texto o los valores de un aro/freno/modo de palanca

Editá `WHEELS`, `BRAKES` o `SHIFTS` respectivamente — son los únicos
lugares donde vive el copy que se muestra en la ficha del carro. Ojo: la
clave de un perfil de `BRAKES` también es parte de la clave con la que se
guardan los kg del usuario (`"sim:perfil"`); si renombrás un perfil, los
valores guardados bajo el nombre viejo dejan de encontrarse.
