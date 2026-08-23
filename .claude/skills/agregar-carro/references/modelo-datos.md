# Modelo de datos de Pit Wall

Todo vive en `index.html`. Tablas de referencia para mapear un carro real a la entrada `c(...)`.

## Contenido

1. [Categorías (`CATS`)](#1-categorías-cats)
2. [Códigos de transmisión (`t`)](#2-códigos-de-transmisión-t)
3. [Volantes (`w` / `WHEELS`)](#3-volantes-w--wheels)
4. [Perfiles de freno (`b` / `BRAKES`) y árbol de decisión](#4-perfiles-de-freno-b--brakes)
5. [Overrides y ejemplos reales](#5-overrides-y-ejemplos-reales)
6. [Caja de cambios de iRacing (`GB_MAP`)](#6-caja-de-cambios-de-iracing-gb_map)

---

## 1. Categorías (`CATS`)

Cada categoría define el default de volante (`w`) y perfil de freno (`b`). El carro hereda ambos salvo override.

| Clave | Label | Volante default | Freno default |
|---|---|---|---|
| `formula` | Fórmula | formula | formula |
| `proto` | Prototipos | formula | proto |
| `gt3` | GT3 | gt3 | gt3 |
| `gt4` | GT4 | gt3 | gt4 |
| `gte` | GTE | gt3 | gte |
| `gt2` | GT2 | gt3 | gte |
| `gt1` | GT1 / clásicos GT | gt3 | gte |
| `copa` | Copas monomarca | gt3 | gt3 |
| `tcr` | TCR / Turismos | gt3 | turismo |
| `supercars` | Supercars / Stock Car | redondo | supercars |
| `calle` | Calle | redondo | calle |
| `hiper` | Superdeportivos | podium | hiper |
| `clasico` | Clásicos | redondo | clasicoCalle |
| `rally` | Rally / Rallycross | redondo | rally |
| `nascar` | NASCAR / Óvalo | redondo | oval |
| `dirt` | Dirt Oval | redondo | dirt |
| `offroad` | Off-Road | redondo | offroad |

**Todos los carros de rally van a `cat: "rally"`** sin importar la era: comparten el perfil de freno `rally`, separado del de calle a propósito.

## 2. Códigos de transmisión (`t`)

Elige por cómo cambia el **carro real**:

| Código | Cuándo | Ejemplos |
|---|---|---|
| `L` | Levas al volante (secuencial semiautomático, DCT/PDK, híbridos F1) | GT3 modernos, LMDh, F1 |
| `S` | Palanca secuencial física | WRC/Rally2, Supercars, DPi viejos, Radical SR8 |
| `H` | Palanca en H (sincronizada de calle o dogbox de carrera) + embrague | Clásicos, NASCAR, MX-5 |
| `HD` | H con patrón dogleg (1ª abajo-izquierda) | 190E Evo II, Countach, Stratos |
| `N` | Sin cambios: transmisión directa, marcha única o eléctrico | Sprint cars, karts sin caja, EVs |
| `A` | Automático con opción manual | Camionetas off-road Pro 2/Pro 4 |

## 3. Volantes (`w` / `WHEELS`)

| Clave | Aro | Cuándo |
|---|---|---|
| `redondo` | Redondo 332mm + Button Rally Module (sin levas) | Todo carro que cambie con palanca o no tenga cambios: clásicos, rally, óvalo, tierra. El embrague va en el pedal. |
| `gt3` | CSL GT3 (levas de cambio + clutch paddles) | GT3/GT4/GTE/GT2/copas/TCR: el carro real arranca con clutch paddles. |
| `formula` | Formula 2.5X (levas de cambio, embrague y 2 extra) | Monoplazas y prototipos. |
| `podium` | Podium 330mm flat bottom (levas, sin clutch paddles) | Carros de calle/superdeportivos con DCT/PDK donde el embrague real es 100% automático. |

Caso especial recurrente: un carro de calle con DSG/PDK y volante redondo real → `podium` es el compromiso (el redondo no tiene levas); deja una nota explicándolo (ver VW Jetta TDI Cup).

## 4. Perfiles de freno (`b` / `BRAKES`)

El perfil se decide por **tipo de asistencia**, con este árbol de preguntas sobre el carro real:

1. **¿Es de rally/rallycross?** → `rally` (siempre, sin importar era ni potencia).
2. **¿Corre en óvalo de asfalto / tierra / off-road?** → `oval` / `dirt` / `offroad`.
3. **¿Conserva servo (booster)?**
   - Calle normal → `calle` · Superdeportivo moderno con ABS potente → `hiper` · Clásico de calle (neumático estrecho) → `clasicoCalle`.
4. **Sin servo, ¿conserva ABS?** (copas derivadas de calle: TCR, Clio Cup, M2 CS Racing, Jetta TDI Cup, Group A con ABS) → `turismo`.
5. **Sin servo y sin ABS, ¿qué tan liviano y con cuánto downforce?**
   - Chasis liviano sin downforce (spec ligera: MX-5 Cup, Caterham, Spec Racer, Formula Vee, karts) → `ligero`.
   - Fórmula junior con poco downforce (F4, FR2.0, USF2000) → `formulaJunior`.
   - Competición clásica de fuerza alta (F1 histórico, Group C, IMSA GTO, M1 Procar, Ultima GTR) → `raceNoServo`.
   - GT4 → `gt4` · GT3/Cup moderno → `gt3` · GTE/GT1/GT2 → `gte`.
   - Sedán/stock car pesado sin ABS (Supercars, Stock Car Brasil) → `supercars`.
   - Prototipo con downforce → `proto` · Fórmula de máximo downforce (F1, IndyCar, SF) → `formula`.

Tabla completa (resorte / tie-rod / preload / kg):

| Perfil | Resorte | Tie-rod | Preload | kg |
|---|---|---|---|---|
| `calle` | Azul | Corta | 0 | 60–70 |
| `hiper` | Azul | Corta | 0 | 55–70 |
| `clasicoCalle` | Azul | Stock | 0 | 55–70 |
| `ligero` | Azul | Stock | 0 | 55–75 |
| `rally` | Azul (rojo opcional) | Corta | 0 | 60–70 |
| `turismo` | Azul | Stock | 0 | 55–70 |
| `oval` | Azul | Corta | 0 | 45–60 |
| `dirt` | Azul | Corta | 0 | 35–50 |
| `offroad` | Azul | Corta | 0 | 50–65 |
| `formulaJunior` | Rojo | Corta | 0 | 75–100 |
| `gt4` | Rojo | Corta | 0 a leve | 75–100 |
| `raceNoServo` | Rojo | Stock | 0 a leve | 85–110 |
| `gt3` | Rojo | Stock | Leve | 85–110 |
| `gte` | Rojo | Stock a larga | Leve a moderado | 90–120 |
| `supercars` | Rojo | Stock | Leve | 90–120 |
| `proto` | Rojo | Larga | Moderado | 100–130 |
| `formula` | Rojo | Larga | Moderado | 110–140 |

Si un carro nuevo no encaja en ningún perfil, propónle al usuario agregar un perfil a `BRAKES` en vez de forzar uno — pero es raro: 17 perfiles cubren casi todo.

## 5. Overrides y ejemplos reales

El override existe para cuando **el carro real contradice el default de su categoría**. Ejemplos del catálogo:

```js
// Clásico que en realidad es competición pura sin servo: freno rojo
c("Lotus 79", "clasico", 1978, "H", "…", { b: "raceNoServo", notas: ["…"] }),

// Copa que conserva ABS de calle: turismo, no gt3
c("BMW M2 CS Racing", "copa", 2020, "L", "…", { b: "turismo", s: "azul", w: "podium" }),

// Copa ligera sin servo: ligero, no gt3
c("Global Mazda MX-5 Cup", "copa", 2025, "S", "…", { w: "redondo", s: "azul", b: "ligero", notas: ["…"] }),

// Carro de calle extremo con servo+ABS: hiper, no calle
c("Porsche 911 GT3 RS (992)", "calle", 2022, "L", "…", { b: "hiper", w: "podium" }),

// Fórmula junior sin downforce serio
c("FIA F4", "formula", 2016, "L", "…", { b: "formulaJunior" }),
```

`s` (resorte) y `kg` también son overrideables, pero casi nunca hacen falta si el perfil `b` es correcto. Prefiere `b`.

## 6. Caja de cambios de iRacing (`GB_MAP`)

Solo la pestaña iRacing muestra el bloque "CAJA DE CAMBIOS" con instrucciones de subir/bajar. `gearboxOf(car)` busca un fragmento del nombre en `GB_MAP`; si no hay match usa el default del código `t`:

| `t` | Default |
|---|---|
| `L` / `A` | `semiAuto` (sin lift, sin embrague) |
| `S` | `dogSeqCut` (secuencial de garras con corte: full throttle al subir, blip al bajar) |
| `N` | `direct` |
| `H` / `HD` | `dogH` (dogbox: lift al subir, blip al bajar, sin embrague) |

Agrega a `GB_MAP` cuando el carro real difiere del default. Los tipos disponibles en `GBS`: `semiAuto`, `dct`, `dogSeqCut`, `dogSeqNoCut`, `dogH`, `synchroH`, `dog12`, `direct`, `autoMS`. Casos típicos:

- Manual de calle sincronizado (MX-5 Roadster, Solstice) → `synchroH` (con embrague siempre).
- DCT/PDK (GT4s, M2 CS Racing, Jetta) → `dct`.
- Secuencial sin corte de encendido (Next Gen, Skip Barber) → `dogSeqNoCut`.
- Caja de 1-2 marchas de óvalo (Late Models, Modifieds) → `dog12`.
