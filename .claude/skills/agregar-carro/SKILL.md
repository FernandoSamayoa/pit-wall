---
name: agregar-carro
model: sonnet
description: Agrega vehículos al catálogo de Pit Wall (index.html) con la configuración de rig más realista, investigando el carro real y mapeándolo al modelo de datos de la app. Usa este skill SIEMPRE que el usuario pida agregar, añadir, meter o actualizar un carro, vehículo o auto en iRacing, AC EVO, AC Rally o AMS2; cuando pregunte qué volante, resorte, perfil de freno, tie-rod, preload o transmisión le corresponde a un carro; o cuando mencione contenido nuevo de un simulador (nueva temporada, DLC, update de lista) que haya que reflejar en el catálogo.
---

# Agregar un vehículo a Pit Wall

Pit Wall vive completa en `index.html` (un solo archivo, React + Babel por CDN). Para cada carro recomienda: **volante** (uno de 5 aros: Fanatec y Simagic), **modo de cambio** (levas / palanca secuencial / palanca en H + embrague VRS) y **freno VRS** (un perfil por tipo de asistencia que define resorte, tie-rod, preload y rango de kg). Agregar un carro bien = investigar el carro real → mapear al modelo de datos → insertar la entrada `c(...)` en el array del simulador.

La regla más importante de toda la app: **el perfil de freno se elige por el tipo de asistencia del carro real (servo, ABS, downforce), no por qué tan rápido es**. Un carro de calle con servo y una copa ligera sin servo usan los dos resorte azul, pero son perfiles distintos con tie-rod, preload y calibración separados.

## Si piden revisar qué falta en un simulador

Una sola WebFetch a la lista oficial de carros, compárala con los nombres del array (Grep `c("` en el array correspondiente) e investiga solo los que falten. No investigues los que ya están.

## Flujo

### 1. Identifica simulador y carro

Los arrays son `IRACING`, `ACEVO`, `ACRALLY` y `AMS2` en `index.html`. Si el usuario no dijo el simulador, dedúcelo del contexto (p. ej. un carro de rally clásico suele ir a AC Rally) o pregunta. Antes de agregar, busca el nombre en el archivo: puede que el carro ya exista o que esté agrupado dentro de un pack (AMS2 agrupa clases enteras en una sola entrada, como "GT3 Gen2 (...)").

### 2. Investiga el carro real

Empieza por la página oficial del carro en el simulador (un WebFetch): suele traer descripción, motor y potencia. Usa WebSearch solo para lo que falte (caja, servo/ABS), con un máximo de 2 búsquedas por carro. Si su clase ya define todo (otro GT3, otro LMDh), no investigues más:

- **Transmisión**: ¿cambia con levas al volante? ¿palanca secuencial? ¿H sincronizada (calle) o caja de garras? ¿patrón dogleg? ¿DCT/PDK sin pedal de embrague? ¿no tiene caja (eléctrico, sprint car)?
- **Freno**: ¿conserva servo/booster de vacío? ¿tiene ABS (de calle o motorsport)? ¿cuánto downforce genera su categoría? ¿es derivado de calle o competición pura?
- **Volante real**: ¿aro redondo completo (clásicos, rally, óvalo)? ¿volante GT con levas de cambio y de embrague? ¿volante de fórmula? ¿aro plano de calle con levas pero sin clutch paddles (DCT)?
- **Color para la descripción**: año, motor, potencia, historia deportiva, algún resultado notable.

### 3. Mapea al modelo de datos

Lee solo las secciones de `references/modelo-datos.md` que necesites (el árbol de freno, §4, casi siempre; §6 `GB_MAP` solo para iRacing). Tiene las tablas completas de categorías (`CATS`), códigos de transmisión, volantes (`WHEELS`) y el árbol de decisión del perfil de freno (`BRAKES`), con ejemplos reales del catálogo. Elige:

- `cat`: la categoría de `CATS` (define defaults de volante y freno).
- `t`: código de transmisión (`L`/`S`/`H`/`HD`/`N`/`A`).
- Overrides `w` (volante), `b` (perfil de freno), `s` (resorte) **solo si el default de la categoría no es realista para este carro** — la mayoría de los carros no necesitan ninguno. Si dudas entre dos perfiles de freno, decide por la asistencia real (¿servo? ¿ABS?) y deja una nota explicando el matiz.

### 4. Escribe la entrada

Formato de la fábrica `c(nombre, cat, año, transmisión, descripción, overrides?)`:

```js
c("Nombre del carro", "gt3", 2024, "L", "Descripción en español, 3–8 oraciones."),
c("Otro carro", "clasico", 1989, "H", "Descripción.", { b: "raceNoServo", notas: ["Matiz puntual."] }),
```

- La **descripción va en español**, tono informativo y con datos concretos (motor, potencia, historia), como las entradas existentes: usa Grep para ver una sola entrada de la misma categoría y calcar el estilo. No leas `index.html` entero.
- Inserta la línea dentro de la **sección de su categoría** (comentarios `// ---------- CATEGORÍA ----------` en `IRACING`; los otros arrays agrupan igual sin comentario). La UI ordena alfabéticamente, así que la posición exacta no importa, pero mantén la agrupación por legibilidad.
- `notas` es un array de strings que se muestran como "NOTAS DE BOXES": úsalo para matices que las reglas genéricas no capturan (variantes del carro, dogleg, frenada peculiar, launch control).
- **Solo iRacing**: si la caja del carro se comporta distinto al default de su código `t` (ver `GBS`/`GB_MAP` en el archivo), agrega una entrada a `GB_MAP` con un fragmento único del nombre. Los defaults: `L`/`A` → secuencial semiautomático, `S` → secuencial de garras con corte, `N` → directa, `H`/`HD` → dogbox en H. Un manual de calle sincronizado necesita `synchroH`; un DCT necesita `dct`.

### 5. Verifica

- `cat` existe en `CATS`, el `b` (si lo pusiste) existe en `BRAKES`, y `t` es un código válido.
- La sintaxis JS es válida (comillas escapadas en la descripción si hace falta).
- Reporta al usuario en pocas líneas qué elegiste y **por qué** (asistencia de freno, tipo de caja, volante real).
