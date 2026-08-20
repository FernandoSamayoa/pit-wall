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

1. **`<head>`**: carga React 18, ReactDOM, el SDK "compat" de Firebase
   (`firebase-app-compat.js` + `firebase-firestore-compat.js`) y Babel
   Standalone, todos desde CDN. También el manifest de PWA y metatags.
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
8. **`WHEELS`, `SHIFTS`, `SPRINGS`**: textos y explicaciones para cada aro,
   modo de palanca y resorte.
9. **`recomendar(car)`**: la función central. Devuelve `{ wheel, wheelKey,
   spring, springKey, shift, notas, kg }` para un carro dado.
10. **Componentes de presentación**: `PressureBar`, `Spring` (SVG del
    resorte), `WheelIcon` (SVG del aro), y `WHEEL_LABELS`.
11. **`App()`**: el componente principal — estado, efectos (Firebase, sync,
    localStorage) y todo el render.
12. **`S`**: diccionario de estilos inline reutilizados en el JSX (no hay
    CSS externo ni Tailwind; solo un `<style>` chico dentro del JSX para el
    `@import` de fuentes, el scrollbar y un par de media queries).
13. **Última línea**: `ReactDOM.createRoot(...).render(<App />)`.

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
| `o` | Objeto opcional de overrides: `{ w, s, kg, notas }`. |

`o.w` (aro), `o.s` (resorte) y `o.kg` (rango de kg) **sobreescriben** el
default de la categoría (`CATS[cat].w/s/kg`) solo para ese carro puntual —
por ejemplo, un GT3 normalmente usa resorte `"rojo"` porque su categoría lo
define así, pero un carro específico puede forzar `"azul"` si en la realidad
frena distinto (ver TCR en `IRACING`, que fuerza `s: "azul"` a nivel de
categoría porque son turismos con freno más blando).

`o.notas` es un array de strings; se muestran como bullets bajo "NOTAS DE
BOXES" en la ficha del carro. Usalas para matices puntuales que las reglas
genéricas de `recomendar()` no puedan capturar (cajas dogleg, punta-tacón,
volantes pequeños por fidelidad histórica, etc).

### Códigos de transmisión (`t`)

| Código | Significado | Efecto en la recomendación |
|---|---|---|
| `L` | Levas (paddle shift) | Aro con levas (`gt3`, `formula` o `podium` según categoría). |
| `S` | Secuencial por palanca | Palanca Fanatec en modo secuencial. |
| `H` | Manual en H | Palanca en H + pedal de embrague VRS. |
| `HD` | Manual en H, patrón *dogleg* | Igual que `H`, pero con nota aclarando que la 1ª va abajo-izquierda. |
| `N` | Sin cambios (directo o marcha única) | Ni palanca ni levas. |
| `A` | Automático | Tratado igual que `L` para el aro (levas opcionales). |

## 3. Categorías (`CATS`)

Cada entrada define el **default** de aro (`w`), resorte (`s`) y rango de kg
(`kg`) para todos los carros de esa categoría, salvo que el carro individual
lo sobreescriba con `o`:

```js
gt3: { label: "GT3", w: "gt3", s: "rojo", kg: "85–110" },
```

Los valores válidos de `w` son las claves de `WHEELS`: `"redondo"`, `"gt3"`,
`"formula"`, `"podium"`. Los de `s` son las claves de `SPRINGS`: `"rojo"`,
`"azul"`.

## 4. `recomendar(car)`

Resume la lógica de negocio de toda la app:

1. Toma los defaults de la categoría (`CATS[car.cat]`).
2. `wheelKey = car.w || meta.w` y `springKey = car.s || meta.s` — el carro
   gana si define algo, si no se usa el default de la categoría.
3. Arma la lista de `notas`: empieza con `car.notas` y le agrega notas
   automáticas para casos conocidos (salida con levas de embrague en
   Formula/GT3, ausencia de embrague en el aro `podium`, ausencia de levas
   en el aro `redondo` para autos de palanca en H).
4. Calcula `kg`: usa `car.kg` si está definido; si no, el rango de la
   categoría — salvo que el carro haya cambiado de resorte respecto al
   default de su categoría, en cuyo caso usa un rango genérico para ese
   resorte (`"55–70"` para azul, `"85–110"` para rojo).

Si necesitás cambiar **qué aro/resorte corresponde a qué categoría**, tocá
`CATS`. Si necesitás cambiar **una nota o regla que depende de la
combinación aro+transmisión**, tocá `recomendar()`.

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
| `cat`, `trans`, `spring` | Filtros activos de categoría / transmisión / resorte. |
| `q` | Texto de búsqueda. |
| `sel` | Carro seleccionado (si hay uno, se muestra la ficha en vez de la lista). |
| `syncCode` | Código de 8 caracteres para sincronizar entre dispositivos; se genera una vez y se persiste en `localStorage`. |
| `codeInput`, `showCodeInput` | UI para escribir un código de otro dispositivo. |
| `syncing`, `firebaseReady` | Estado de la sincronización con Firestore. |
| `customKg` | Mapa `"sim:rangoKg" -> valorEnKg` con los valores reales que el usuario ingresó. |

### Efectos (`useEffect`)

1. **Al montar**: hace `fetch('/api/config')`, inicializa Firebase con esa
   config y guarda la referencia a la colección `configs` en `CONFIGS`. Si
   falla (por ejemplo en local sin `vercel dev`), solo loguea un warning y
   la app sigue funcionando sin sync.
2. **Cuando cambia `syncCode` o `firebaseReady`**: lee el documento
   `configs/{syncCode}` de Firestore y, si tiene `customKg`, lo carga (con
   un flag `skipNextSave` para no volver a escribir lo que se acaba de leer).
3. **Cuando cambia `customKg`**: lo guarda siempre en `localStorage`, y —si
   Firebase está listo— programa una escritura a Firestore con *debounce* de
   800ms (`saveTimer`) para no escribir en cada tecla.

### Datos derivados

- `data`: el array de carros del `sim` activo (`IRACING` / `ACEVO` /
  `ACRALLY` / `AMS2`).
- `cats`: categorías presentes en `data`, en el orden en que aparecen en
  `CATS` (para que los chips de filtro salgan en un orden consistente).
- `lista`: `data` filtrado por categoría/transmisión/resorte/búsqueda y
  ordenado alfabéticamente.

### Render

- Si `sel` tiene un carro: muestra la ficha (`S.card`) con bloques de
  VOLANTE, CAMBIO, CAJA DE CAMBIOS (solo iRacing), FRENO VRS (con el input
  de kg reales y la barra de presión) y NOTAS DE BOXES.
- Si no: muestra buscador, chips de categoría/transmisión/resorte y la lista
  de carros filtrada, con un footer fijo de leyenda.

## 7. Sincronización (Firebase) {#sincronización-firebase}

- **Qué se sincroniza**: únicamente `customKg`, el mapa de valores reales de
  freno que el usuario ingresó. Todo lo demás (filtros, selección) es
  efímero y no se persiste.
- **Cómo se identifica un dispositivo/usuario**: no hay login. El
  "código de sync" (`XXXX-999`) generado por `genSyncCode()` es literalmente
  la clave del documento en Firestore (`configs/{syncCode}`). Cualquiera que
  tenga el código puede leer y sobreescribir ese documento — no hay
  autenticación ni reglas de propiedad. Si en algún momento se agrega
  auth de usuarios, este es el lugar para revisarlo.
- **Formato del documento**: `{ customKg: { "ir:85–110": 92, "ac:55–70": 61, ... } }`.
  La clave combina el simulador y el rango de kg de la categoría/carro, para
  que un mismo carro en distintos sims no pise el valor del otro.
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

3. Si el carro necesita un aro, resorte o rango de kg distinto al default de
   su categoría, o notas propias, agregá el 6º argumento:

   ```js
   c("Nombre del carro", "gt3", 2024, "L", "Descripción.", {
     w: "podium", s: "azul", kg: "60–75",
     notas: ["Nota puntual de este carro."],
   }),
   ```

4. Si es un carro de iRacing y su caja de cambios necesita instrucciones
   distintas a las del default por código `t`, sumá una entrada a `GB_MAP`
   con un fragmento único de su nombre.

No hace falta build ni reinicio de nada: es HTML servido tal cual.

### Agregar una categoría nueva

Sumá una entrada a `CATS` con label, aro y resorte por defecto, y rango de
kg por defecto:

```js
misilcars: { label: "Carros misil", w: "formula", s: "rojo", kg: "120–150" },
```

Los carros que usen `"misilcars"` como `cat` van a heredar esos defaults
salvo que los sobreescriban individualmente.

### Agregar un simulador/pestaña nuevo

1. Creá el array de carros, por ejemplo `const RFACTOR2 = [ ... ];`, con el
   mismo formato que los otros (usando `c(...)`).
2. En `App()`, sumá la pestaña a la lista de tabs:

   ```js
   [["ir", "iRacing", "2026 S3"], ["ac", "AC EVO", "v0.8"],
    ["acr", "AC Rally", "v0.4"], ["ams", "AMS2", "v1.6"],
    ["rf2", "rFactor 2", "vX.Y"]].map(...)
   ```

3. Extendé la resolución de `data`:

   ```js
   const data = sim === "ir" ? IRACING
     : sim === "ac" ? ACEVO
     : sim === "acr" ? ACRALLY
     : sim === "ams" ? AMS2
     : RFACTOR2;
   ```

4. El bloque "CAJA DE CAMBIOS" solo se renderiza si `sim === "ir"`; dejalo
   así salvo que el simulador nuevo también necesite ese nivel de detalle
   (en ese caso, habría que generalizar `gearboxOf`/`GB_MAP` para que
   dependan también de `sim`, hoy asumen iRacing).

### Cambiar qué aro/resorte le corresponde a una categoría completa

Editá el default en `CATS`. Afecta a todos los carros de esa categoría que
no tengan su propio override (`o.w` / `o.s`).

### Cambiar el texto o el color de un aro/resorte/modo de palanca

Editá `WHEELS`, `SPRINGS` o `SHIFTS` respectivamente — son los únicos
lugares donde vive el copy que se muestra en la ficha del carro.
