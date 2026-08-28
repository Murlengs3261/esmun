# ESMUN — Especificación de implementación

**Producto:** plataforma de registro y control de entrega de comida para ESMUN (Modelo de Naciones Unidas, Colegio Eagles).
**Stack destino:** Next.js (App Router) + React + Tailwind CSS + Supabase.
**Alcance:** 11 pantallas de la app del despachador (móvil, tema oscuro fijo), 12 pantallas móviles del administrador (tema del sistema), 3 vistas de escritorio del administrador, credencial impresa + pliego.
**Lienzo base:** 390 × 844 pt (1 pt = 1 px en las medidas de este documento). Escritorio 1440 × 900.

Este documento es autosuficiente: no requiere acceso al lienzo. Cuando una medida no aparece, es un error del documento, no una libertad de implementación — pregúntala.

**Decisión estructural del sistema:** el vocabulario visual sale de la **credencial** y del **sello** (el gesto de estampar una sola vez). Se traduce en tres reglas: rectángulos de esquina viva (`radius: 0`) porque una placa no tiene esquinas redondeadas; jerarquía por **reglas y bandas** en lugar de sombras; y un único gesto expresivo — el **cuño rotado −4°** con tipografía monoespaciada que aparece solo en el veredicto y en el acta de cierre. Fuera de ese gesto, el sistema es deliberadamente silencioso.

---

## 1. Tokens

Nombres por función. Dos temas: `dark` (app del despachador, siempre; admin en tema oscuro del sistema) y `light` (admin por defecto).

### 1.1 CSS custom properties

```css
:root {
  /* ——— Neutros sesgados a índigo (nunca gris puro) ——— */
  --bg-base:            #F5F5FA;
  --bg-sunken:          #ECECF4;
  --surface:            #FFFFFF;
  --surface-raised:     #FFFFFF;
  --surface-inverse:    #14162A;
  --surface-alt:        #F9F9FD;   /* fila alterna en tablas */

  --border:             #DCDCE8;   /* divisores y bordes decorativos */
  --border-control:     #8B8FA6;   /* bordes de campos, controles, botones fantasma (3.2:1) */
  --border-strong:      #14162A;   /* regla de acta, encabezado de tabla */

  --text-primary:       #14162A;
  --text-secondary:     #41455F;
  --text-tertiary:      #5A5E7A;
  --text-disabled:      #6F7288;
  --text-on-accent:     #FFFFFF;
  --text-on-inverse:    #EDEEF7;

  /* ——— Acento de marca: índigo. Nunca verde, rojo ni ámbar ——— */
  --accent:             #3B49C9;
  --accent-hover:       #2F3BA8;
  --accent-pressed:     #26308A;
  --accent-subtle:      #EEF0FC;

  /* ——— Semánticos: USO EXCLUSIVO DEL VEREDICTO Y SUS ECOS ——— */
  --state-granted:      #0B6B3A;
  --state-granted-ink:  #F2F7F3;
  --state-granted-soft: #E8F3EC;
  --state-duplicate:    #8E1B1B;
  --state-duplicate-ink:#FDF2F2;
  --state-duplicate-soft:#FDF2F2;
  --state-invalid:      #7A4A00;
  --state-invalid-ink:  #FFF8EA;
  --state-invalid-soft: #FFF8EA;
  --state-invalid-text: #5C3800;   /* texto ámbar sobre fondo claro */

  /* ——— Roles del gafete ——— */
  --role-mesa:          #14162A;
  --role-delegado:      #3B49C9;
  --role-staff:         #7A8199;
  --role-prensa:        #14162A;   /* + trama de 10 px, ver §10 */
  --role-invitado:      #FFFFFF;   /* + borde 3 px #14162A */

  --focus-ring:         #3B49C9;
  --overlay:            rgba(20, 22, 42, 0.56);
}

[data-theme="dark"] {
  --bg-base:            #0E0F1A;
  --bg-sunken:          #0A0B14;
  --surface:            #171A2B;
  --surface-raised:     #1F2338;
  --surface-inverse:    #EDEEF7;
  --surface-alt:        #1B1F31;

  --border:             #2C3150;
  --border-control:     #676E96;   /* 3.4:1 sobre --surface */
  --border-strong:      #EDEEF7;

  --text-primary:       #EDEEF7;
  --text-secondary:     #C2C6DC;
  --text-tertiary:      #A6AAC4;
  --text-disabled:      #6B7092;
  --text-on-accent:     #0E0F1A;
  --text-on-inverse:    #14162A;

  --accent:             #6E7BFF;
  --accent-hover:       #8390FF;
  --accent-pressed:     #5A67E8;
  --accent-subtle:      #1B1F3A;

  --state-granted:      #0B6B3A;   /* mismos hex: el veredicto no cambia con el tema */
  --state-duplicate:    #8E1B1B;
  --state-invalid:      #7A4A00;

  --focus-ring:         #6E7BFF;
  --overlay:            rgba(6, 7, 12, 0.68);
}
```

Tintes de apoyo usados sobre los fondos inundados del veredicto (no son tokens nuevos, son escalones fijos):

| Uso | Sobre `--state-granted` | Sobre `--state-duplicate` | Sobre `--state-invalid` |
|---|---|---|---|
| Nombre (32 pt) | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` |
| Cuerpo (17 pt) | `#D7EBDF` | `#F3D6D6` | `#F3E0BE` |
| Etiqueta/micro | `#C6E2D2` | `#F0C9C9` | `#EBD3A8` |
| Botón (fondo) | `#F2F7F3` | `rgba(253,242,242,.16)` + borde `rgba(253,242,242,.5)` | `#FFF8EA` |

### 1.2 Tailwind

```js
// tailwind.config.ts — theme.extend
colors: {
  bg:       { base:'var(--bg-base)', sunken:'var(--bg-sunken)' },
  surface:  { DEFAULT:'var(--surface)', raised:'var(--surface-raised)', inverse:'var(--surface-inverse)', alt:'var(--surface-alt)' },
  border:   { DEFAULT:'var(--border)', control:'var(--border-control)', strong:'var(--border-strong)' },
  fg:       { DEFAULT:'var(--text-primary)', secondary:'var(--text-secondary)', tertiary:'var(--text-tertiary)', disabled:'var(--text-disabled)', onAccent:'var(--text-on-accent)', onInverse:'var(--text-on-inverse)' },
  accent:   { DEFAULT:'var(--accent)', hover:'var(--accent-hover)', pressed:'var(--accent-pressed)', subtle:'var(--accent-subtle)' },
  granted:  { DEFAULT:'#0B6B3A', ink:'#F2F7F3', soft:'#E8F3EC' },
  duplicate:{ DEFAULT:'#8E1B1B', ink:'#FDF2F2', soft:'#FDF2F2' },
  invalid:  { DEFAULT:'#7A4A00', ink:'#FFF8EA', soft:'#FFF8EA', text:'#5C3800' },
  role:     { mesa:'#14162A', delegado:'#3B49C9', staff:'#7A8199', prensa:'#14162A', invitado:'#FFFFFF' },
},
borderRadius: { none:'0px', sm:'2px', DEFAULT:'0px' },   // el sistema es de esquina viva
spacing: { 1:'4px', 2:'8px', 3:'12px', 4:'16px', 5:'20px', 6:'24px', 8:'32px', 10:'40px', 14:'56px', 18:'72px' },
fontFamily: {
  sans:  ['"IBM Plex Sans"','system-ui','-apple-system','"Segoe UI"','Roboto','sans-serif'],
  plate: ['"IBM Plex Sans Condensed"','"IBM Plex Sans"','Impact','sans-serif'],
  mono:  ['"IBM Plex Mono"','ui-monospace','"SF Mono"','Menlo','monospace'],
},
fontSize: {
  verdict:  ['40px',{lineHeight:'1.05', letterSpacing:'0.02em', fontWeight:'700'}],
  name:     ['32px',{lineHeight:'1.15', letterSpacing:'-0.005em', fontWeight:'600'}],
  title:    ['28px',{lineHeight:'1.2',  letterSpacing:'0.01em',  fontWeight:'700'}],
  section:  ['22px',{lineHeight:'1.25', letterSpacing:'0.01em',  fontWeight:'700'}],
  body:     ['17px',{lineHeight:'1.5'}],
  sub:      ['15px',{lineHeight:'1.45'}],
  label:    ['13px',{lineHeight:'1.4',  fontWeight:'600'}],
  micro:    ['11px',{lineHeight:'1.3',  letterSpacing:'0.09em', fontWeight:'600'}],
  display:  ['64px',{lineHeight:'1',    fontWeight:'700'}],   // contador grande
  hero:     ['96px',{lineHeight:'1',    fontWeight:'700'}],   // panel de escritorio
},
transitionTimingFunction: { out:'cubic-bezier(0.2,0,0,1)', inout:'cubic-bezier(0.4,0,0.2,1)' },
```

---

## 2. Tipografía

| Familia | Uso | Enlace |
|---|---|---|
| **IBM Plex Sans** (400/500/600/700) | cuerpo, campos, nombres, etiquetas | ver `<link>` abajo |
| **IBM Plex Sans Condensed** (600/700) | «tipografía de placa»: veredicto, títulos, botones, nombre del gafete | idem |
| **IBM Plex Mono** (400/500/600) | micro-etiquetas en mayúsculas, horas, cifras comparables, tokens, cuños | idem |

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Condensed:wght@600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

Pila de respaldo: ver `fontFamily` en §1.2. Con `next/font/google` importar `IBM_Plex_Sans`, `IBM_Plex_Sans_Condensed`, `IBM_Plex_Mono` con `display:'swap'` y `subsets:['latin','latin-ext']` (latin-ext es obligatorio: «Villalobos-Echeverría»).

### Escala completa

| Rol | Familia | Tamaño | Peso | Interlínea | Tracking | Transform | Dónde |
|---|---|---|---|---|---|---|---|
| Veredicto | Condensed | 40 | 700 | 1.05 | +0.02em | UPPER | la palabra que resuelve el escaneo; alerta alimentaria |
| Nombre | Sans | 32 | 600 | 1.15 | −0.005em | — | persona escaneada; nombre en la ficha |
| Título de pantalla | Condensed | 28 | 700 | 1.2 | +0.01em | UPPER | encabezados de pantalla, títulos de modal |
| Sección | Condensed | 22 | 700 | 1.25 | +0.04em | UPPER | botones, contador de barra superior, nombre de puesto |
| Cuerpo | Sans | 17 | 400 (600 énfasis) | 1.5 | 0 | — | párrafos, filas, campos |
| Secundario | Sans | 15 | 400 (600 énfasis) | 1.45 | 0 | — | metadatos de fila, ayuda |
| Etiqueta | Sans | 13 | 600 | 1.4 | 0 | — | chips, enlaces de acción, subtítulos de fila |
| Micro | **Mono** | 11 | 600 | 1.3 | +0.09em (=+8%) | UPPER | eyebrow, estados, contadores pequeños |
| Contador grande | Condensed | 64 | 700 | 1.0 | 0 | — | cola pendiente, credenciales, panel móvil |
| Hero de escritorio | Condensed | 64→96 | 700 | 1.0 | 0 | — | total entregado en 1440 |

**Cifras tabulares obligatorias** (`font-variant-numeric: tabular-nums`, aplicado global en `body`) en: horas (`HH:MM:SS`), contadores, columnas numéricas de tablas, ritmos, progresos `n/m`, número de fila del CSV. En IBM Plex Mono las cifras ya son tabulares.

---

## 3. Espaciado, radios, bordes, sombras

- **Unidad base 4 pt.** Escala permitida: `4, 8, 12, 16, 20, 24, 32, 40, 56, 72`. Ninguna medida fuera de la escala.
- **Márgenes laterales móvil:** 20. **Canaleta:** 12. **4 columnas** de 82.5 (390 − 40 − 36 = 314; 314 − 36 = 278 / 4 = 69.5 de columna con 12 de canaleta → columna 69.5, redondear contenido a 4).
- **Escritorio 1440:** barra lateral 248 fija; contenido con márgenes 40, canaleta 24, 12 columnas de 72 (1440 − 248 − 80 = 1112; 12×72 + 11×24 = 864 + 264 = 1128 ≈ 1112 con columnas de 70.7 → usar `grid-template-columns: repeat(12, minmax(0,1fr)); gap:24px`).
- **Insets seguros:** 47 arriba, 34 abajo. Ningún elemento interactivo dentro.
- **Radios:** `0` en todo. Excepción única: troquel del cordón en el gafete (radio 4 mm) y el indicador circular de duplicado.
- **Bordes:** 1 px divisores (`--border`); 1 px controles (`--border-control`); 2 px botones secundarios y selección; 3 px doble en cuños; 6 px banda superior de tarjeta/hoja inferior; 8 px marco de la alerta alimentaria.
- **Elevación:** el sistema no usa sombras para jerarquía. Solo dos sombras, ambas de superposición:
  - `--shadow-sheet: 0 -8px 24px rgba(20,22,42,0.18)` (hoja inferior, modal).
  - `--shadow-fab: 0 4px 12px rgba(20,22,42,0.24)` (botón flotante «+»).
  Todo lo demás separa con borde, banda o cambio de superficie.
- **Foco de teclado:** `outline: 3px solid var(--focus-ring); outline-offset: 2px`. En fondos de veredicto: `outline-color: #FFFFFF`.

---

## 4. Especificación pantalla por pantalla

Convención: las franjas se dan como `y0–y1 (alto)` en px sobre el lienzo de 390 × 844. `SI-top` = 0–47, `SI-bottom` = 810–844.

### Verificación de anchos alternos (aplica a las 23 pantallas móviles)
- **360 × 800:** márgenes laterales bajan a 16; el visor de cámara mantiene 50 % del alto (400) y el marco de puntería baja a 224 × 224; el botón de acción sigue en 64 y se ancla a `bottom: SI-bottom`. Nombre a 32 pt puede pasar a dos líneas: reservar 2 líneas (74 px) en el bloque de nombre.
- **430 × 932:** márgenes 20; la cámara crece a 466 (50 %); la zona de veredicto absorbe el resto; el marco de puntería se mantiene en 240 (no escala). Ningún texto crece.
- Regla general: **solo la zona de cámara y la de veredicto son elásticas**; barra superior (56), banda de conexión (48), botón de acción (64) e insets son fijos.

---

## APP DEL DESPACHADOR — tema oscuro fijo, modo kiosco

Ruta base: `/app/(dispatch)`. Kiosco: `display:standalone` en el manifest, `viewport-fit=cover`, `theme-color #0E0F1A`, sin ningún enlace de navegación fuera de estas 11 pantallas. Sesión persistente 18 h.

---

### 01 · Ingreso
**Ruta:** `/ingresar`

| Región | y0–y1 (alto) | Contenido |
|---|---|---|
| SI-top | 0–47 | reloj y estado del sistema (nativo) |
| Marca | 119–171 (52) | placa `ESMUN`, borde 2 px acento, padding 12/16, x=20 |
| Título | 203–237 (34) | «Despacho de comida» (28 pt) |
| Bajada | 245–267 (22) | «Ingresa con la cuenta que te dio la organización.» (15 pt) |
| Campo correo | etiqueta 307–322, campo 330–386 (56) | ancho 350 (390−40) |
| Campo contraseña | etiqueta 406–421, campo 429–485 (56) | con acción «Ver» a la derecha |
| Ayuda | 501–545 | «¿Olvidaste la contraseña? Habla con el organizador: no hay recuperación automática durante el evento.» |
| Botón primario | 682–746 (64) | «Entrar», ancho 350, x=20 |
| Pie | 786–800 | «Colegio Eagles · ESMUN 2026» (micro, centrado) |

- Con teclado abierto: el contenedor hace `scroll-padding-bottom: 64px` y el botón se fija **sobre** el teclado (`position: sticky; bottom: 0`), nunca cubierto.
- Estados: reposo · foco (borde inferior 2 px acento) · cargando (botón con texto «Entrando…» y barra de 2 px animada, deshabilitado) · error (campo con borde `--state-duplicate` + mensaje 15 pt: «Correo o contraseña incorrectos. Revisa e intenta otra vez.»).
- Textos literales: `Despacho de comida` · `Ingresa con la cuenta que te dio la organización.` · `Correo` · `Contraseña` · `Ver` / `Ocultar` · `Entrar` · `Entrando…` · `Correo o contraseña incorrectos. Revisa e intenta otra vez.` · `Sin conexión: no se puede iniciar sesión. Busca señal y vuelve a intentar.` · `Colegio Eagles · ESMUN 2026`

### 02 · Elegir puesto
**Ruta:** `/puesto`

| Región | y0–y1 (alto) |
|---|---|
| Barra superior | 47–103 (56) — «Ana Solís» (13 pt), sin botón de volver |
| Título | 135–169 (34) — «¿En qué puesto estás?» |
| Bajada | 177–221 — «Queda registrada en cada entrega que hagas. Si te mueves de puesto, vuelve a esta pantalla.» |
| Opciones | 253–325, 337–409, 421–493 (72 cada una, gap 12) |
| Botón primario | 682–746 (64) — «Continuar en Puesto 1» |

- Cada opción: alto 72, padding lateral 20, título 22 pt Condensed + micro con la ubicación, indicador cuadrado 24 × 24 a la derecha (relleno acento si está elegida, borde `--border-control` si no). Seleccionada: borde 2 px acento.
- Textos: `¿En qué puesto estás?` · `Puesto 1` / `Patio central` · `Puesto 2` / `Pasillo de aulas` · `Puesto 3` / `Entrada del auditorio` · `Continuar en Puesto 1`
- El nombre y la ubicación de los puestos vienen de configuración del evento, no están fijos en código (ver DECISIONES §12.4).

### 03 · En espera
**Ruta:** `/escanear` (estado `sin sesión abierta`)

| Región | y0–y1 (alto) |
|---|---|
| Barra superior | 47–103 (56) — «Puesto 1 · Ana Solís» + indicador de conexión a la derecha |
| Bloque central | centrado en 103–844 | marca de espera 120 × 120 (borde 2 px punteado) con cuadrado 56 × 56 en pulso |
| Título | +32 bajo la marca (28 pt) — «Ninguna entrega abierta» |
| Cuerpo | 17 pt, 2 líneas — «La cámara se enciende sola en cuanto el organizador abra la sesión. No tienes que hacer nada.» |
| Tarjeta «siguiente» | ancho 310, padding 20, a 40 del cuerpo |
| Sello de frescura | micro — «Actualizado hace 4 s» |

- Se actualiza por Realtime; además *polling* de respaldo cada 20 s. Sin botón de recarga.
- Textos: `Ninguna entrega abierta` · `La cámara se enciende sola en cuanto el organizador abra la sesión. No tienes que hacer nada.` · `Siguiente en el programa` · `Día 1 · Refrigerio de la mañana` · `Prevista 9:30 · 350 personas esperadas` · `Actualizado hace 4 s` · `En línea`

### 04 · Escaneando (reposo) — **composición canónica**
**Ruta:** `/escanear`

| # | Región | y0–y1 (alto) | Detalle exacto |
|---|---|---|---|
| 1 | Barra superior | **47–103 (56)** | fondo `--surface`, borde inferior 1 px. Izquierda: nombre de la sesión (13 pt/600) + micro «Día 1 · Puesto 1». Derecha: contador del turno (22 pt Condensed) con micro «TURNO», y punto de conexión 8 × 8 |
| 2 | Visor de cámara | **103–525 (422 = 50,0 %)** | full-bleed horizontal. Marco de puntería **240 × 240** centrado: x 75–315, y 194–434 (91 px desde el borde superior del visor). Esquinas de 40 px, trazo 4 px, color acento. Sin overlay oscuro (roba luz) |
| 3 | Zona de veredicto | **525–746 (221)** | en reposo: título 28 pt «Apunta al gafete» (y 557–591), cuerpo 17 pt (599–650), contador 40 pt + glosa (674–714) |
| 4 | Acción única | **746–810 (64)** | ancho 350, x=20. En reposo es **secundaria** («Terminar turno», borde 2 px `--border-control`) — nunca hay un botón «escanear»: la cámara lee sola |
| — | SI-bottom | 810–844 | vacío |

- Rango permitido de la cámara: 45–55 % del alto. En 800 de alto → 400; en 932 → 466.
- Textos: `Refrigerio de la mañana` · `Día 1 · Puesto 1` · `TURNO` · `Apunta al gafete` · `Encuadra el código dentro del marco. Se lee solo; no tienes que tocar nada.` · `43 entregados en este turno · 2 rechazos` · `Terminar turno`
- Estados: reposo · leyendo (el marco cambia a trazo continuo 4 px y el contador de turno no se toca; ≤120 ms) · sin permiso de cámara (bloque 17 pt: «La app necesita la cámara para leer los gafetes. Ábrele el permiso en los ajustes del teléfono.» + botón «Abrir ajustes») · cámara ocupada por otra app (mismo patrón).

### 05 · Veredicto: habilitado
**Ruta:** `/escanear` (estado `granted`)

- **Inundación total:** `background: #0B6B3A` de 0 a 844, incluida el área de la cámara (la cámara se pausa: no hay visor visible bajo el veredicto).
- Franjas: barra superior 47–103 (56, transparente con borde inferior `rgba(242,247,243,.24)`) · marca de veredicto **cuadrada** 96 × 96 centrada en 159–255 · verbo 40 pt en 279–321 · regla 1 px en 353 · nombre 32 pt en 377–414 (hasta 2 líneas → 414+37) · foro · país 17 pt en 426–452 · micro de rol y dieta en 460–474 · cuño rotado −4° en 506–550 · botón de acción 746–810 (64), SI-bottom 810–844.
- **Forma/ícono/posición/texto** (para daltonismo): cuadrado + ✓ + **centrado** + verbo «Entrégale».
- Textos: `Entrégale` · `María Fernanda López` · `Consejo de Seguridad · Francia` · `Delegado · Sin restricciones alimentarias` · `Sellado 9:42:08` · `Continuar`
- Auto-avance: a los **1200 ms** vuelve a §04 solo si no hubo toque; el botón «Continuar» adelanta. (Ver DECISIONES §12.2.)

### 06 · Habilitado con alerta alimentaria
**Ruta:** `/escanear` (estado `granted` + `diet != null`)

- Misma inundación verde. **La alerta domina:** bloque blanco full-width (x 20–370) en **127–255**, con banda superior e inferior de 8 px `#0E0F1A`, micro «ATENCIÓN ANTES DE ENTREGAR», texto de la restricción a **40 pt Condensed mayúsculas** en `--text-primary`, y una línea de instrucción de 15 pt.
- El veredicto se degrada a 28 pt en 279–313, precedido por la marca cuadrada de 40 × 40; el nombre a 32 pt en 333–370; foro/país 17 pt en 378–404; cuño en 424–468.
- Botón 746–810: **«Leí la alerta · continuar»** — el texto cambia para forzar lectura. Sin auto-avance en esta variante (bloqueo 800 ms).
- Textos: `ATENCIÓN ANTES DE ENTREGAR` · `ALERGIA AL MANÍ` / `SIN GLUTEN` (mayúsculas, tal cual venga `dietary_notes` normalizado) · `Entrégale la bolsa marcada con cinta azul.` · `Habilitado` · `Sebastián Mejía` · `ECOSOC · Kenia` · `Leí la alerta · continuar`

### 07 · Veredicto: ya entregado
**Ruta:** `/escanear` (estado `duplicate`)

- Inundación `#8E1B1B` completa.
- Franjas: barra superior 47–103 · bloque de veredicto **alineado a la izquierda y arriba** en 127–191: círculo 64 × 64 (borde 6 px) con barra diagonal + verbo 40 pt «No entregar» · nombre 32 pt en 215–252 · foro/país 17 pt en 264–290 · **cuño de doble borde rotado −3°** en 318–422 (micro «YA SELLADO EN ESTA SESIÓN», hora 28 pt Condensed, «por Ana Solís · Puesto 2» 15 pt) · párrafo 17 pt en 450–525.
- **Forma/ícono/posición/texto:** círculo + barra diagonal + **arriba-izquierda** + verbo «No entregar».
- **Bloqueo de 2 s obligatorio:** el botón nace deshabilitado con relleno de progreso de izquierda a derecha (`rgba(253,242,242,.28)`) y contador descendente en décimas: `Espera 2 s · 1.2`. A los 2000 ms se convierte en `Volver a escanear` (fondo `#FDF2F2`, texto `#8E1B1B`). El toque durante el bloqueo no hace nada (no encola). El auto-avance está **prohibido** en este estado.
- Textos: `No entregar` · `Diego Ramírez` · `DISEC · Brasil` · `YA SELLADO EN ESTA SESIÓN` · `10:42:17` · `por Ana Solís · Puesto 2` · `Esta persona ya recibió su refrigerio hace 3 minutos. Si insiste, mándala con el organizador: solo él puede anular una entrega.` · `Espera 2 s · 1.2` · `Volver a escanear`

### 08 · Veredicto: QR no válido (dos casos)
**Ruta:** `/escanear` (estados `unknown_token` y `not_eligible`)

- Inundación `#7A4A00`. **Banda de trama diagonal 45°** de 56 px en 103–159 (líneas de 12 px `#FFF8EA`) — marca única de este estado, legible sin color.
- Bloque **alineado a la derecha y abajo**: verbo 40 pt «Revisa» + cuadrado 64 × 64 con `?` en 191–255 · titular 32 pt en 279–316 · explicación 17 pt en 328–380 · tarjeta del segundo caso en 412–540 · cierre 15 pt en 560–582.
- **Caso A `unknown_token`:** titular `Código no reconocido`; cuerpo `Este QR no pertenece a ESMUN. Puede ser el carnet del colegio o un código de otro evento.`
- **Caso B `not_eligible`:** titular `Rol sin derecho en esta sesión`; nombre real de la persona a 32 pt (**sí se muestra**, porque el despachador tiene que devolverle el gafete a alguien concreto) y cuerpo `Valentina Ortiz · Prensa. Esta sesión es solo para mesa y delegados.` La forma, el color y la posición son idénticos a A: los distingue el texto y la presencia de nombre.
- **Caso C `session_closed`:** mismo estado ámbar, titular `La sesión ya está cerrada`, cuerpo `El organizador cerró la entrega a las 12:38. Ya no se pueden registrar canjes.`
- Botón 746–810: `Volver a escanear`. Bloqueo 600 ms.
- Cierre común: `Pídele el gafete de ESMUN o mándala con el organizador.`

### 09 · Sin conexión (operando)
**Ruta:** `/escanear` (bandera `offline`)

| Región | y0–y1 (alto) |
|---|---|
| Barra superior | 47–103 (56) |
| **Banda de conexión** | **103–151 (48)** — fondo `--accent` (índigo, **no** ámbar: no es un error), texto `#0E0F1A`: «Modo local · sigue escaneando» + micro «7 en cola» |
| Visor de cámara | 151–549 (398 = 47,2 %) — marco 240 × 240 en y 230–470 |
| Zona de veredicto | 549–746 (197) — título «Todo funciona igual» + cuerpo |
| Acción | 746–810 (64) — secundaria acento: «Ver cola pendiente» |

- La banda es **permanente** mientras no haya red; nunca un *toast*. Los tres veredictos funcionan igual, validados contra la lista descargada al abrir la sesión.
- Textos: `Modo local · sigue escaneando` · `7 en cola` · `Todo funciona igual` · `El teléfono guarda cada canje y valida los duplicados con la lista que descargó al abrir la sesión. Cuando vuelva el wifi, sube solo.` · `Ver cola pendiente`
- Al reconectar: la banda cambia a `Volvió la señal · subiendo 7` durante la subida y desaparece con `Todo subido` (2 s). Nunca aparece la palabra «error» ni un ícono de advertencia.

### 10 · Cola pendiente
**Ruta:** `/cola`

| Región | y0–y1 (alto) |
|---|---|
| Barra superior con volver | 47–103 (56) — flecha 44 × 44 táctil + «Cola pendiente» |
| Contador grande | 135–199 — 64 pt + glosa «canjes esperando subir» |
| Tarjeta de estado | 223–347 — tres filas: «Más antiguo 10:58:41», «Sin señal desde hace 6 min», «Último intento hace 20 s» |
| Lista | 383–615 — filas de 52 con `Canje #113` + hora; última fila «y 4 más» |
| Nota | 639–719 — borde izquierdo 3 px acento |
| Acción | 746–810 (64) — primaria: «Volver a escanear» |

- **Sin botones peligrosos:** no hay «reintentar», «vaciar» ni «forzar subida». Solo volver.
- Textos: `Cola pendiente` · `7` / `canjes esperando subir` · `Más antiguo` · `Sin señal desde` · `Último intento` · `En espera` · `Canje #113` · `y 4 más` · `No hay nada que tocar aquí. En cuanto vuelva la señal se suben en orden y este número baja a cero. No cierres la app: la cola vive en este teléfono.` · `Volver a escanear`
- Estado vacío: contador `0`, título `Nada pendiente`, cuerpo `Todos los canjes de este turno ya están en el sistema.`

### 11 · Fin de turno
**Ruta:** `/turno`

| Región | y0–y1 (alto) |
|---|---|
| Barra superior con volver | 47–103 (56) |
| Encabezado | 131–169 — nombre de la sesión (28 pt) + micro «Puesto 1 · 9:30 – 11:36» |
| Rejilla de métricas | 197–393 — 2 × 2, tarjetas de 169 × 92, gap 12 |
| Desglose de rechazos | 413–585 — tarjeta con 3 filas |
| Estado de cola | 605–627 — punto 8 × 8 + «Todo subido. Cola en cero.» |
| Botón secundario | 678–734 (56) — «Seguir escaneando» |
| Botón destructivo | 746–810 (64) — «Cerrar sesión» + micro «Pide confirmación escrita» |

- Al pulsar «Cerrar sesión» aparece un **modal destructivo**: título `¿Cerrar tu sesión?`, cuerpo `Si cierras en medio del despacho, tendrás que volver a entrar con correo y contraseña, y la fila se detiene. Hay 0 canjes sin subir.`, campo de confirmación escrita `SALIR`, botones `Cerrar sesión` (destructivo) / `Seguir aquí`. Si la cola > 0, el modal se **bloquea**: `No puedes cerrar con 7 canjes sin subir. Busca señal primero.`
- Textos de métricas: `Entregados 128` · `Rechazos 9` · `Duración 2 h 06 min` · `Ritmo 1,0 / min` · `Desglose de rechazos` / `Ya entregado 6` / `QR no reconocido 2` / `Rol sin derecho 1`

---

## APP DEL ADMINISTRADOR (móvil) — tema del sistema

Ruta base: `/admin`. Barra de navegación inferior fija: **754–844** (56 de barra + 34 de inset), 4 destinos de 88 × 56 táctiles: `Vivo`, `Sesiones`, `Personas`, `Gafetes`. Contenido: **103–754** con desplazamiento.

### 12 · Ingreso (admin) — `/admin/ingresar`
Misma retícula que §01, tema claro. Campo correo 330–386, contraseña 429–485, nota informativa 509–573, botón primario 682–746.
Textos: `Consola de organización` · `Solo cuentas con permiso de administrador.` · `Si entras con una cuenta de despachador, la app te lleva al escáner y no a esta consola.` · `Entrar`

### 13 · Panel en vivo — `/admin` (pantalla más importante)
Jerarquía pensada para leerse **a metro y medio**: lo primero que se ve es el par `248 / 350` a 64 pt sobre bloque `--surface-inverse`.

| Región | y0–y1 (alho) | Contenido |
|---|---|---|
| Barra superior | 47–103 (56) | «Panel en vivo» + micro «Actualizado hace 2 s»; a la derecha etiqueta de estado `Abierta` (borde 1 px `--state-granted`) |
| **Bloque hero** | 119–303 (184) | fondo `#14162A`; micro de sesión; `248` 64 pt + `/ 350` 28 pt; barra de progreso 12 px (relleno `--accent` dark); pie con «71 % entregado» y «6,2 / min» |
| Tres métricas | 319–401 (82) | `Faltan 102` · `Rechazos 14` · `Puestos 3` — tarjetas de 102 × 82, gap 12 |
| Avance por foro | 421–605 | encabezado micro + enlace `Ver los 20`; 4 foros visibles: nombre 15 pt + `15/15` mono + barra 6 px |
| Flujo en vivo | 625–754 | encabezado micro + tarjeta con 3 filas de 62 px; la fila más reciente lleva borde izquierdo 3 px acento y entra con una animación de 120 ms |
| Nav inferior | 754–844 | `Vivo` activo |

- Realtime sobre `redemptions` (INSERT) + `dispatch_sessions` (UPDATE). Nunca recargar la página. Si el canal cae: micro pasa a `Reconectando…` y a los 10 s aparece un aviso emergente `Se perdió la conexión en vivo. Los números pueden estar atrasados.`
- Textos de fila: `Valentina Ortiz` / `ECOSOC · Noruega · Ana Solís / P2` / `10:14:02`.
- Fila de rechazo (solo escritorio y detalle): fondo `--state-duplicate-soft`, texto `#7A2020`, sufijo `· rechazado`.

### 14 · Sesiones de entrega — `/admin/sesiones`
- Intro 15 pt en 119–163: `Seis sesiones, dos por día. Solo una puede estar abierta a la vez.`
- 6 tarjetas desde 179, gap 12: cerrada (alto 106, opacidad 0.72), **abierta** (alto 178, borde 2 px `--border-strong`, con botón destructivo interno de 48), borrador (alto 106), tres borradores compactos (alto 62).
- Etiquetas de estado: `Cerrada` (borde 1 px `--text-tertiary`), `Abierta` (relleno `--state-granted`, texto blanco), `Borrador` (borde 1 px punteado).
- Textos: `Día 1 · Mañana` / `Ayer 9:30 – 11:36 · 341 de 350` · `Día 1 · Tarde` / `Desde 10:02 · 248 de 350 · 3 puestos activos` / `Cerrar sesión de entrega` · `Día 2 · Mañana` / `Prevista mañana 9:30 · mesa y delegados` · `Día 3 · Clausura`
- Si no hay ninguna abierta, cada borrador muestra botón primario `Abrir esta sesión`.

### 15 · Abrir sesión — hoja inferior sobre `/admin/sesiones`
- Superposición `--overlay` a pantalla completa; hoja anclada abajo, alto 604 (240–844), banda superior 6 px `--accent`, asa 44 × 4 centrada.
- Contenido: título 28 pt `Abrir «Día 1 · Tarde»` · cuerpo 17 pt · tabla de consecuencias con 4 filas de 48 (`Roles con derecho`, `Personas esperadas 338`, `Excluidos 12 invitados`, `Canjes por persona 1`) · nota con borde izquierdo acento · botón primario 64 `Abrir ahora` · botón fantasma 48 `Cancelar`.
- Textos: `En cuanto abras, los tres teléfonos de despacho encienden la cámara y empiezan a aceptar canjes.` · `La sesión de la mañana ya está cerrada, así que no hay conflicto.` · Si hubiera otra abierta: `No puedes abrir esta sesión: «Día 1 · Mañana» sigue abierta. Ciérrala primero.` (botón primario deshabilitado).

### 16 · Cerrar sesión (destructivo) — hoja inferior
- Igual geometría, banda superior 6 px `--state-duplicate`, alto 668 (176–844).
- Bloque de consecuencia: fondo `--state-duplicate-soft`, borde 1 px `#E4B4B4`, `102` a 40 pt + `personas no han pasado` + desglose 15 pt.
- **Confirmación escrita obligatoria:** campo con la palabra `CERRAR` (mono, tracking +0.12em); el botón primario destructivo permanece deshabilitado hasta que coincide exactamente.
- Textos: `Cerrar la entrega de la tarde` · `No se puede volver a abrir. Los tres teléfonos dejan de aceptar canjes de inmediato y se genera el acta de cierre.` · `28 de Asamblea General, 11 de DISEC, 5 de ECOSOC y 58 repartidas en 17 foros más. Quedan en el acta como «no pasó».` · `Escribe CERRAR para confirmar` · `Cerrar definitivamente` · `Seguir despachando`

### 17 · Reporte de cierre (acta) — `/admin/sesiones/[id]/acta`
Diseñada como **documento que se imprime y se archiva**, no como pantalla: fondo `--surface` puro, márgenes 20, regla de 2 px, cuño rotado −6° con la palabra `Cerrada`.

| Región | y0–y1 |
|---|---|
| Barra superior | 47–103 — «Acta de cierre» + acción `Compartir` |
| Encabezado del acta | 127–331 — marco 2 px: eyebrow `Colegio Eagles · ESMUN 2026`, título 28 pt, rango horario, cuño; regla 2 px; tres cifras a 40 pt (`Entregado 301`, `No pasó 37`, `Anulados 2`) |
| Por despachador | 351–491 — 3 filas con `128 · 1,0/min` en mono |
| No pasaron por foro | 511–711 — grupos con conteo y primeros nombres + `+6` |
| Pie del acta | 727–749 — micro `Ritmo pico 8,4/min a las 10:26 · generada 12:41 por Andrés Castillo` |
| Acciones | 746–810 — dos botones de 64: `PDF` (primario) y `CSV` (secundario), gap 12 |

- El acta se genera **sola** al cerrar y es inmutable. Si hay anulaciones posteriores, se genera una **versión 2** y la 1 queda archivada (ver DECISIONES §12.7).
- CSV: una fila por participante con `nombre, rol, foro, pais, estado (entregado|no_paso|anulado), hora, despachador, puesto, motivo_anulacion`.

### 18 · Participantes — `/admin/participantes`
| Región | y0–y1 |
|---|---|
| Barra superior | 47–103 — «Participantes» + total `350` en mono |
| Buscador + filtros | 103–229 (126) — campo 48 en 115–163; chips 32 en 173–205 |
| Encabezado de resultados | 229–261 (32) — micro `22 resultados · DISEC` |
| Filas | desde 261, alto 66 cada una |
| FAB `+` | 56 × 56 en x 314–370, y 682–738 |
| Nav inferior | 754–844 — `Personas` activo |

- Fila: nombre 17/600 + subtítulo 13 pt `Delegado · India · DISEC` (+ ` · Alergia al maní` si aplica) + etiqueta de credencial a la derecha (`Gafete` borde verde / `Pendiente` borde ámbar punteado). Inactivo: opacidad 0.6 y sufijo `· Inactivo`.
- Chips: activo = relleno `--surface-inverse`; disponible = borde 1 px punteado con `+`.
- Textos: `Buscar nombre, país o foro` · `Delegado ×` · `+ Foro` · `+ Rol` · `+ Credencial` · `22 resultados · DISEC` · vacío: `Nadie coincide con «velentina». Revisa la escritura o quita un filtro.`

### 19 · Ficha de participante — `/admin/participantes/[id]`
- Barra superior con volver + `Editar`.
- Tarjeta de identidad 123–331: **banda de rol de 6 px** arriba (color por rol, §1.1), nombre 32 pt, `Delegado · ECOSOC · Kenia` 17 pt, y si hay dieta, bloque ámbar (`--state-invalid-soft`, borde 1 px `#C79A44`): micro `Nota alimentaria` + valor 17/600 `#5C3800`.
- Tarjeta de QR 347–497: QR 110 × 110 con zona de silencio de 6 px, token en mono `esm-8f3c-91ad-4e02`, botón secundario 44 `Descargar gafete`.
- Historial 533–753: 6 filas fijas (las 6 sesiones) con hora + despachador; anulado en `--state-duplicate` con tachado; sin pasar en `--text-tertiary` con `No pasó`; futura con `—`.
- Botón inferior 754–810 (56): `Anular una entrega` (destructivo secundario). Solo visible si hay al menos un canje activo.

### 20 · Alta / edición — `/admin/participantes/nuevo` y `/[id]/editar`
- Control segmentado de rol en 131–179 (48), 4 segmentos iguales de 87.5 (`Delegado`, `Mesa`, `Staff`, `Prensa`; `Invitado` en desplazamiento horizontal o en el desplegable de rol si no cabe).
- Campos, con etiqueta micro 15 px arriba y ayuda 13 px abajo:
  - `Nombre completo` (56) en 227–283, ayuda `Como debe salir impreso en el gafete.`
  - `Foro` (desplegable, 56) en 331–387 — **siempre visible**, para todos los roles salvo `invitado`.
  - **Condicional:** rol `delegado` → `País que representa` (desplegable, 56) en 435–491 dependiente del foro. Rol `mesa` → `Cargo` (desplegable: `Presidente/a`, `Vicepresidente/a`, `Moderador/a`, `Oficial de actas`). Roles `staff`/`prensa` → `Área` (texto libre 40 car.). Rol `invitado` → sin foro ni país.
  - `Notas alimentarias (opcional)` (56) en 555–611, ayuda `Se le muestra al despachador en el momento de la entrega.`
- **Cupo:** al elegir país, validar `count(participants where forum_id AND delegation_id AND role='delegado' AND is_active) < delegations.seats` (por defecto 2). Si está lleno: borde del campo `--state-duplicate` + bloque de error 13 pt con cuadrado 16 × 16: `Cupo lleno: este país ya tiene 2 delegados en Consejo de Seguridad (Diego Ramírez y Valentina Ortiz). Elige otro país o cambia el foro.` El botón `Guardar` queda deshabilitado (`#B9B9CC` / `#6F7288`).
- Al guardar un delegado nuevo se genera `qr_token` automáticamente y se marca la credencial como pendiente de imprimir.

### 21 · Importar CSV — `/admin/participantes/importar`
Cuatro pasos: `Archivo` → `Mapeo` → `Vista previa` → `Confirmar`. Barra de progreso de 4 px justo bajo la barra superior (103–107), relleno 75 % en el paso 3.
- Paso 3 (el especificado): título 28 pt en 127–161; resumen 15 pt; dos métricas (`Listas 344` verde, `Con error 6` rojo) en 231–313; mapeo de columnas 349–469; lista de filas con problema desde 505, filas de 74 con borde izquierdo 3 px (`--state-duplicate` bloqueante, `--state-invalid` advertencia).
- Acciones 746–810: `Atrás` (96 × 64) + primario `Importar 344` con micro `y omitir 6`.
- Errores que debe detectar y su texto: `Brasil ya tiene 2 delegados en DISEC.` · `Falta el nombre` / `Se omite si no la corriges.` · `«UNICEF» no existe. Se crea o se corrige.` · `Posible duplicado de fila 203` · `Rol no reconocido` · `Mesa requiere cargo`.
- Formato aceptado: UTF-8, coma o punto y coma, primera fila de encabezados, columnas sugeridas `nombre, rol, comite, pais, cargo, dieta`. La importación **nunca borra**: agrega o actualiza por `nombre + forum_id`.

### 22 · Credenciales — `/admin/credenciales`
- Bloque hero `#14162A` en 119–303: micro `Gafetes generados`, `344 / 350` (64 pt / 28 pt), barra 8 px, glosa `6 personas sin QR: se generan al guardar su país.`
- Botón primario 64 en 319–383: `Generar los 6 faltantes` (estado cargando: `Generando 6…` con barra indeterminada).
- Lista de descargas 439–631: tres filas de 64 (`Pliego para imprenta` / `A4 · 8 gafetes por hoja · 44 hojas` / `PDF`; `ZIP por foro` / `20 carpetas · PNG individuales` / `ZIP`; `Un gafete suelto` / `Busca la persona y descarga` / `Buscar`).
- Recordatorio de prueba de impresión 651–751 con miniatura del gafete 64 × 90: `Imprime una hoja de prueba y verifica que el QR se lea a 15 cm.`

### 23 · Anular entrega — modal destructivo
- Superposición `--overlay`; tarjeta centrada-alta: x 20–370, y 180–740, banda superior 6 px `--state-duplicate`.
- Contenido: título 28 pt `Anular esta entrega` · tarjeta de contexto (nombre + `Día 2 · Mañana · 10:03:52 · Luis Peña / Puesto 1`) · cuerpo 15 pt · área de texto **obligatoria** de 96 px con contador de caracteres (`Mínimo 15 caracteres.`) · botón destructivo 56 `Anular y registrar` · fantasma 48 `Cancelar`.
- Texto de consecuencia: `Al anular, la persona vuelve a poder canjear en esta sesión. La anulación queda en el acta con tu nombre y la hora.`

---

## VISTAS DE ESCRITORIO (1440 × 900)

Estructura común: barra lateral **0–248** (`#14162A`, padding 32/20), contenido 248–1440. Encabezado de contenido **0–80** (fondo `--surface`, borde inferior 1 px). Márgenes internos 40. Ítems de navegación de 48 de alto, activo con relleno `--accent` dark y texto `#0E0F1A`.

### 24 · Panel en vivo — `/admin` (≥1280 px)
- Encabezado 0–80: título 28 pt + micro de frescura; derecha: etiqueta `En vivo` y nombre del admin.
- Cuerpo 80–900, padding 32/40, dos columnas con gap 24: **izquierda elástica**, **derecha 432 fija** (flujo en vivo).
- Izquierda: bloque hero `#14162A` de 168 de alto (padding 32) con `248` a **96 pt** + `/ 350` a 40 pt y, a su derecha, barra de progreso de 16 px con pie `71 % · faltan 102` / `6,2 / min · pico 8,4`. Debajo, tarjeta `Avance por foro · 20 comités` que ocupa el resto, con rejilla de **2 columnas** (gap 16/32), barras de 8 px, y pie `12 foros más abajo`.
- Derecha: tarjeta de flujo con encabezado (`Flujo en vivo` + `Pausar`), 7 filas visibles de 68 px (nombre 17/600 + hora 15 mono a la derecha, subtítulo 13 pt), y pie fijo `Puestos activos · P1 104 · P2 128 · P3 16`.
- Lectura a 1,5 m: solo el `248` de 96 pt y la barra de progreso están pensados para eso; todo lo demás es lectura de escritorio.

### 25 · Participantes — `/admin/participantes` (≥1280 px)
- Encabezado 0–80: título + buscador de 360 × 44; derecha: `Importar CSV` (secundario) y `Nuevo participante` (primario), ambos de 44.
- Barra de filtros 80–144 (64): chips de 36 + contador `22 de 350` alineado a la derecha.
- Tabla desde 168 con márgenes 40: encabezado de 44 con borde inferior 2 px `--border-strong`; columnas `2.2fr | 1fr | 1.4fr | 1.2fr | 1fr | 0.8fr` = `Nombre · Rol · Foro · País/cargo · Nota · Gafete`; filas de 50, alternas `--surface-alt`; **10 filas por página**.
- Paginación bajo la tabla: `Mostrando 1–10 de 22` + controles de 44 × 44.
- Fila con nota alimentaria: la celda `Nota` en `#5C3800`/600. Credencial: `Sí` verde 600, `Pendiente` ámbar 600.

### 26 · Importar CSV — `/admin/participantes/importar` (≥1280 px)
- Encabezado 0–80: título + **pasos horizontales** (círculo 24 × 24 + etiqueta 15 pt, conectores de 24 × 1).
- Cuerpo dos columnas, gap 24: **izquierda 320 fija** (tarjetas `Archivo`, `Mapeo` con 7 pares columna→campo, resumen `344 / 6`, y al fondo `Atrás` + `Importar 344` de 56); **derecha elástica** con la tabla de vista previa.
- Tabla de vista previa: filtro `Solo errores (6)` / `Todas`; columnas `64 | 2fr | 1fr | 1.2fr | 1.4fr | 1.6fr` = `Fila · Nombre · Rol · Foro · País · Problema`; borde izquierdo 3 px por severidad; celdas con problema en el color del estado. Pie: `Puedes corregir aquí mismo cada celda marcada, o importar 344 y arreglar las 6 a mano después.`
- Las celdas marcadas son editables en línea (`input` de 15 pt que hereda la celda); al corregir, la fila sale del filtro con una animación de 160 ms.

---

## 5. Biblioteca de componentes

Alturas: `sm 40` · `md 48` · `lg 56` · `xl 64` (solo la acción única del scanner y los primarios de confirmación). Todos los objetivos táctiles ≥ 48 × 48 (los iconos de 24 llevan área táctil de 48).

### Botón — `<Button>`
`props: variant 'primary'|'secondary'|'destructive'|'ghost'; size 'sm'|'md'|'lg'|'xl'; fullWidth?; loading?; disabled?; icon?; subLabel?; onPress`
- Tipografía: `section` (22 pt Condensed UPPER +0.04em) en `lg`/`xl`; `body`/600 en `sm`/`md`.
- primary: relleno `--accent`, texto `--text-on-accent`. secondary: transparente + borde 2 px `--border-control` (o `--accent` cuando refuerza una acción segura). destructive: relleno `--state-duplicate` + texto `#FFF` (o borde 2 px cuando es secundaria). ghost: solo texto `--text-tertiary`.
- Estados: reposo · presionado (`filter: brightness(0.92)` + `scale(0.99)`, 80 ms) · foco (anillo §3) · deshabilitado (`#B9B9CC` fondo / `#6F7288` texto, sin opacidad) · cargando (texto reemplazado, barra de 2 px indeterminada al pie, `aria-busy`).
- `subLabel`: micro bajo la etiqueta (`y otras 6`, `Pide confirmación escrita`).

### Campo de texto — `<Field>`
`props: label; value; onChange; help?; error?; type; trailing?; multiline?; maxLength?; required?`
- Alto 56 (`multiline` 96); borde 1 px `--border-control`; padding 16; texto 17 pt.
- Foco: borde inferior 2 px `--accent` + anillo. Error: borde 1 px `--state-duplicate` + mensaje 13 pt con cuadrado 16 × 16. Deshabilitado: fondo `--bg-sunken`, texto `--text-disabled`.
- La etiqueta es micro (11 pt mono UPPER) **encima**, nunca flotante.

### Selector desplegable — `<Select>`
Mismo marco que `Field` + chevron `▾` de 16 a la derecha; abre hoja inferior en móvil (lista de opciones de 56, la elegida con cuadrado relleno) y menú nativo-estilizado en escritorio. `props: options[{value,label,disabled,note}]; placeholder; searchable?` (searchable obligatorio para país y foro).

### Selector de rol — `<SegmentedControl>`
`props: options; value; onChange` — alto 48, borde 1 px, segmentos iguales; activo relleno `--surface-inverse` + texto invertido; 2–4 segmentos visibles, el resto por desplazamiento.

### Buscador — `<SearchInput>`
Alto 48 móvil / 44 escritorio; ícono `search` 14–16 a la izquierda; `placeholder` `Buscar nombre, país o foro`; limpiar con `×` de 44 táctil; *debounce* 200 ms.

### Chip de filtro — `<FilterChip>`
`props: label; active; removable; onToggle` — alto 32 (36 escritorio), padding 6/12, texto 13/600. Activo: relleno `--surface-inverse` + `×`. Disponible: borde 1 px punteado + `+`.

### Etiqueta de estado — `<StatusTag>`
`props: kind 'draft'|'open'|'closed'|'delivered'|'pending'|'void'` — alto 22, padding 2/8, micro. draft borde punteado; open relleno verde/texto blanco; closed borde 1 px gris; delivered borde verde; pending borde ámbar punteado; void relleno rojo suave + tachado.

### Fila de participante — `<ParticipantRow>`
`props: name; role; forum; delegationOrPosition; diet?; credential 'ready'|'pending'; inactive?; onPress` — alto 66 móvil / 50 escritorio; nombre 17/600; subtítulo 13 pt con separadores `·`; etiqueta a la derecha; toda la fila táctil.

### Fila del flujo en vivo — `<FeedRow>`
`props: name; forum; delegation; dispatcher; deviceLabel; time; rejected?; reason?` — alto 62 móvil / 68 escritorio; hora en mono a la derecha; la más nueva con borde izquierdo 3 px acento durante 4 s; si `rejected`, fondo `--state-duplicate-soft`.

### Tarjeta de métrica — `<MetricCard>`
`props: label; value; comparison?; tone 'neutral'|'granted'|'duplicate'|'invalid'` — padding 14–16; label micro; valor 28–40 pt Condensed; comparación 13 pt (`+18 vs. sesión anterior`).

### Barra de progreso por foro — `<ForumProgress>`
`props: name; done; total` — nombre 15 pt + `19/24` en mono; riel 6 px (8 en escritorio) `--border`; relleno `--accent`. Al 100 % el relleno queda lleno (no cambia de color: el verde es del veredicto).

### Contador grande — `<BigCount>`
`props: value; total?; unit?` — 64 pt Condensed (96 en el hero de escritorio); `total` a 28–40 pt en `--text-tertiary`.

### Marco de puntería — `<ReticleFrame>`
240 × 240; 4 esquinas de 40 px con trazo 4 px `--accent`. Estados: reposo (esquinas) · leyendo (rectángulo completo 4 px, 120 ms) · éxito (desaparece con el veredicto). No usa animación de barrido.

### Panel de veredicto — `<VerdictPanel>`
`props: status 'granted'|'duplicate'|'unknown_token'|'not_eligible'|'session_closed'; name?; detail?; diet?; redeemedAt?; by?; onContinue`
Contrato de diferenciación (obligatorio, no estético):

| status | Color | Forma | Ícono | Posición del bloque | Verbo | Bloqueo |
|---|---|---|---|---|---|---|
| granted | `#0B6B3A` | cuadrado 96 | `check` | centrado | `Entrégale` | auto-avance 1200 ms |
| granted + diet | `#0B6B3A` | bloque blanco full-width con bandas 8 px | `alert-triangle` | arriba, domina | `ALERGIA AL MANÍ` sobre `Habilitado` | 800 ms, sin auto-avance |
| duplicate | `#8E1B1B` | círculo 64 con barra diagonal | `slash` | arriba-izquierda | `No entregar` | **2000 ms con progreso visible** |
| unknown_token / not_eligible / session_closed | `#7A4A00` | banda de trama 45° + cuadrado 64 | `help-circle` | abajo-derecha | `Revisa` | 600 ms |

### Banner de conexión — `<ConnectionBanner>`
Alto 48, full-width, relleno `--accent`, texto `--text-on-accent`; cuadrado 14 × 14 de 3 px a la izquierda; contador de cola a la derecha. Nunca rojo ni ámbar, nunca *toast*, nunca descartable.

### Modal de confirmación / destructivo / hoja inferior
`<ConfirmSheet>`: hoja anclada abajo, asa 44 × 4, banda superior 6 px (`--accent` o `--state-duplicate`), padding 24/20/34, tabla de consecuencias opcional, primario 64 + fantasma 48.
`<DestructiveSheet>`: además `confirmWord` (`CERRAR`, `SALIR`) y/o `reason` obligatorio con `minLength`.
`<Modal>` (escritorio): 520 de ancho, centrado, mismas bandas.

### Aviso emergente — `<Toast>`
Ancho 350, alto ≥56, `--surface-inverse`, texto `--text-on-inverse`, 4 s, aparece a 16 sobre la nav inferior. **Prohibido para veredictos y para el estado de conexión.**

### Estado vacío — `<EmptyState>`
Marca 120 × 120 (borde 2 px punteado), título 28 pt, cuerpo 17 pt centrado, acción opcional. Textos por pantalla en §4.

### Esqueleto de carga — `<Skeleton>`
Bloques `--bg-sunken` de la altura real del contenido; pulso `opacity .35→1`, 1400 ms, `ease-inout`. Nunca *spinner* de página completa. En el scanner **no hay esqueleto**: la cámara y el contador aparecen ya operativos.

### Barra de navegación inferior — `<AdminTabBar>`
Alto 56 + 34 de inset; 4 destinos; ícono 20 (relleno acento cuando activo, borde 2 px cuando no) + micro. Área táctil 88 × 56 (≥48).

---

## 6. Iconografía

**Set:** [Lucide](https://lucide.dev) (`lucide-react`), trazo **2 px**, tamaños **16 / 20 / 24** (24 en barras y filas, 20 en nav, 16 en chips y ayudas). Nunca íconos rellenos.

| Ícono Lucide | Uso |
|---|---|
| `check` | veredicto habilitado (dibujado como glifo de 44 × 24 dentro del cuadrado blanco, trazo 8) |
| `slash` | veredicto duplicado (barra diagonal dentro del círculo, trazo 6) |
| `help-circle` | veredicto no válido (o el glifo `?` en Condensed 40) |
| `alert-triangle` | alerta alimentaria, errores de formulario |
| `wifi-off` / `wifi` | banda de conexión, indicador de barra superior |
| `scan-line` | marco de cámara en estados vacíos |
| `camera-off` | permiso de cámara denegado |
| `search` | buscador |
| `plus` | FAB de nuevo participante, chips disponibles |
| `x` | cerrar, quitar chip |
| `chevron-left` | volver |
| `chevron-down` | desplegables |
| `chevron-right` | filas navegables (solo escritorio) |
| `download` | PDF, CSV, ZIP, gafete |
| `upload` | importar CSV |
| `qr-code` | credenciales |
| `users` | participantes (nav) |
| `layout-dashboard` | panel en vivo (nav) |
| `calendar-clock` | sesiones (nav) |
| `id-card` | gafetes (nav) |
| `clock` | horas, cola pendiente |
| `ban` | anular entrega |
| `printer` | pliego de imprenta |
| `refresh-cw` | reconectando (girando, solo con `prefers-reduced-motion: no-preference`) |

Prohibido: emojis en cualquier parte del producto, incluidos textos de estado y CSV.

---

## 7. Movimiento

Nada en el flujo del scanner supera **200 ms**; el objetivo de comprensión es < 400 ms desde que el QR entra al encuadre.

| Transición | Disparador | Duración | Curva | Propiedad |
|---|---|---|---|---|
| QR detectado → marco continuo | lectura del código | 100 ms | `cubic-bezier(0.2,0,0,1)` | `border-width`, `opacity` |
| Marco → veredicto (inundación) | respuesta de `redeem_qr` (u optimista local) | **120 ms** | `cubic-bezier(0.2,0,0,1)` | `background-color`, `opacity` del contenido |
| Entrada del nombre y detalle | idem, con 40 ms de retardo | 120 ms | `out` | `opacity`, `translateY 8px → 0` |
| Cuño (sello) | idem, 80 ms de retardo | 140 ms | `cubic-bezier(0.34,1.2,0.64,1)` | `scale 1.06 → 1`, `rotate` fijo |
| Veredicto → escaneando | `Continuar` o auto-avance | 120 ms | `out` | `opacity` |
| Progreso de bloqueo (2 s) | veredicto duplicado | 2000 ms | `linear` | `width` |
| Banda de conexión entra/sale | cambio de `navigator.onLine` | 160 ms | `inout` | `translateY -48 → 0` |
| Hoja inferior | abrir/cerrar modal | 220 ms / 180 ms | `out` / `inout` | `translateY`, `opacity` del overlay |
| Fila nueva del flujo en vivo | INSERT en `redemptions` | 120 ms | `out` | `opacity`, `translateY -6px → 0` |
| Cambio de cifra (contadores) | valor nuevo | 0 ms | — | **sin animación**: las cifras cambian en seco para que se puedan leer |
| Pulso de espera (pantalla 03) | permanente | 2400 ms bucle | `inout` | `opacity .35 → 1` |
| Esqueleto | carga de lista | 1400 ms bucle | `inout` | `opacity` |
| Corrección de celda (CSV) | celda válida | 160 ms | `out` | `opacity`, `height` |
| Presionado de botón | `pointerdown` | 80 ms | `out` | `transform scale(0.99)`, `brightness` |

**`prefers-reduced-motion: reduce`:** todas las transiciones de posición y escala pasan a **0 ms**; se conservan únicamente cambios de opacidad de **80 ms** para que no haya saltos duros. El cuño aparece sin `scale`. Los bucles (pulso, esqueleto, `refresh-cw`) se detienen: el pulso se sustituye por un borde continuo, el esqueleto por bloques estáticos, el ícono por texto `Reconectando…`. **El progreso de bloqueo de 2 s se mantiene siempre** (es información, no decoración): con movimiento reducido se muestra solo el contador numérico descendente.

---

## 8. Retroalimentación no visual

El despachador opera de oído en una fila ruidosa. Los tres estados deben distinguirse **con el teléfono en el bolsillo**, sin mirar.

| Estado | Sonido | Vibración (`navigator.vibrate`) |
|---|---|---|
| **Habilitado** | un tono **corto y agudo**: onda senoidal 880 Hz (A5), 90 ms, ataque 5 ms / caída 40 ms, ganancia 0.35 | `[35]` — un golpe seco |
| **Habilitado con alerta alimentaria** | **dos** tonos 880 Hz de 70 ms separados 70 ms, seguidos de 1320 Hz 90 ms (asciende: «atención») | `[30, 60, 30, 60, 120]` |
| **Ya entregado** | **dos tonos graves descendentes**: 220 Hz 160 ms + 165 Hz 220 ms, ganancia 0.45 (el más largo y fuerte del sistema) | `[120, 90, 120]` — dos golpes largos |
| **QR no válido** | **un solo tono medio, largo y plano**: 440 Hz, 300 ms, sin variación de altura | `[220]` — un golpe largo continuo |
| Canje subido tras reconexión | 660 Hz 60 ms, ganancia 0.15 (apenas audible) | ninguna |
| Sin conexión / reconexión | ninguno | ninguna (no es un evento del despacho) |

Reglas de implementación:
- Web Audio API con un `AudioContext` desbloqueado en el primer toque tras el ingreso; nunca archivos `mp3` (latencia).
- El sonido se dispara **al mismo frame** que la inundación de color, no después de la animación.
- Diferenciación garantizada por **tres ejes**: número de golpes (1 / 3 / 2 / 1), duración (corto / corto-ascendente / largo / largo-plano) y dirección de altura (agudo / asciende / desciende / plana).
- Interruptor en ajustes del despachador: `Sonido` y `Vibración` independientes; si el usuario apaga el sonido, la vibración es obligatoria y no se puede apagar también (al menos un canal no visual siempre activo).
- Respetar el modo silencio del sistema para el sonido; la vibración se mantiene.

---

## 9. Accesibilidad

### 9.1 Contrastes verificados (WCAG 2.1, texto normal 4.5:1 · texto grande y UI 3:1)

**Tema oscuro (despachador)**

| Par | Ratio | Uso | ✔ |
|---|---|---|---|
| `#EDEEF7` / `#0E0F1A` | 15.9:1 | texto primario | AAA |
| `#A6AAC4` / `#0E0F1A` | 7.9:1 | texto terciario, micro | AAA |
| `#6E7BFF` / `#0E0F1A` | 5.3:1 | acento sobre fondo | AA |
| `#0E0F1A` / `#6E7BFF` | 5.3:1 | texto de botón primario | AA |
| `#EDEEF7` / `#171A2B` | 14.2:1 | texto en tarjeta | AAA |
| `#676E96` / `#171A2B` | 3.4:1 | borde de campo/control | AA (UI) |
| `#6B7092` / `#0E0F1A` | 4.6:1 | texto deshabilitado / pie | AA |

**Veredictos (inundación)**

| Par | Ratio | Uso | ✔ |
|---|---|---|---|
| `#FFFFFF` / `#0B6B3A` | 6.6:1 | nombre 32 pt | AAA (grande) |
| `#F2F7F3` / `#0B6B3A` | 6.0:1 | verbo 40 pt, botón | AA |
| `#D7EBDF` / `#0B6B3A` | 5.2:1 | cuerpo 17 pt | AA |
| `#C6E2D2` / `#0B6B3A` | 4.7:1 | micro 11 pt | AA |
| `#FFFFFF` / `#8E1B1B` | 9.0:1 | nombre | AAA |
| `#FDF2F2` / `#8E1B1B` | 8.1:1 | verbo, cuño | AAA |
| `#F3D6D6` / `#8E1B1B` | 6.6:1 | cuerpo | AAA |
| `#F0C9C9` / `#8E1B1B` | 6.0:1 | micro | AA |
| `#FFF8EA` / `#7A4A00` | 7.1:1 | verbo, botón | AAA |
| `#F3E0BE` / `#7A4A00` | 5.8:1 | cuerpo | AA |
| `#EBD3A8` / `#7A4A00` | 5.2:1 | micro | AA |
| `#14162A` / `#FFFFFF` (alerta alimentaria) | 16.0:1 | restricción 40 pt | AAA |

**Tema claro (admin)**

| Par | Ratio | Uso | ✔ |
|---|---|---|---|
| `#14162A` / `#F5F5FA` | 16.0:1 | texto primario | AAA |
| `#41455F` / `#FFFFFF` | 9.5:1 | texto secundario | AAA |
| `#5A5E7A` / `#F5F5FA` | 5.8:1 | terciario, micro | AA |
| `#3B49C9` / `#FFFFFF` | 7.1:1 | enlaces, acento | AAA |
| `#FFFFFF` / `#3B49C9` | 7.1:1 | botón primario | AAA |
| `#8B8FA6` / `#FFFFFF` | 3.2:1 | borde de campo/control | AA (UI) |
| `#0B6B3A` / `#FFFFFF` | 6.6:1 | etiqueta «entregado» | AAA |
| `#8E1B1B` / `#FFFFFF` | 9.0:1 | destructivo, errores | AAA |
| `#7A4A00` / `#FFFFFF` | 7.5:1 | etiqueta «pendiente» | AAA |
| `#5C3800` / `#FFF8EA` | 9.8:1 | texto de nota alimentaria | AAA |
| `#6F7288` / `#B9B9CC` | 3.1:1 | botón deshabilitado | AA (UI) |
| `#DCDCE8` / `#FFFFFF` | 1.4:1 | **solo divisores decorativos**; nunca borde de control | n/a |

### 9.2 Verificación de daltonismo (deuteranopia y protanopia)

Simulados, los tres fondos convergen: verde → oliva `#4A5A34`, rojo → mostaza oscuro `#6B5A17`, ámbar → `#6E5A19`. Rojo y ámbar quedan **casi idénticos**. Por eso la diferenciación real no es el color:

| | Habilitado | Ya entregado | No válido |
|---|---|---|---|
| Forma | cuadrado 96 | círculo 64 | cuadrado 64 + banda de trama 45° de 56 px |
| Ícono | `check` | barra diagonal | `?` |
| Posición | centrado vertical y horizontal | arriba-izquierda | abajo-derecha |
| Verbo | `Entrégale` | `No entregar` | `Revisa` |
| Sonido | 1 tono agudo corto | 2 tonos graves descendentes | 1 tono medio largo plano |
| Vibración | `[35]` | `[120,90,120]` | `[220]` |
| Bloqueo | ninguno | 2 s con progreso | 0.6 s |

En escala de grises los tres siguen siendo inequívocos (verificado). **Ninguna información del producto depende solo del color**, incluidas las bandas de rol del gafete (§10) y las etiquetas de estado (borde punteado / relleno / borde continuo).

### 9.3 Orden de foco y lectores de pantalla

Orden de foco por pantalla (Tab / lector):
- **01 / 12:** correo → ver-contraseña → contraseña → entrar → (ayuda es texto).
- **02:** puesto 1 → puesto 2 → puesto 3 → continuar. Grupo `role="radiogroup"` con `aria-label="Puesto de despacho"`.
- **03:** región `aria-live="polite"` con el estado; sin controles enfocables.
- **04:** contador (no enfocable) → `Terminar turno`. El visor de cámara es `aria-hidden` con texto alternativo en la región viva.
- **05–08:** el panel de veredicto es `role="alertdialog"` con `aria-live="assertive"`, foco movido al contenedor; primer y único elemento enfocable: la acción. Anuncio literal: `Habilitado. María Fernanda López. Consejo de Seguridad, Francia. Delegado. Sin restricciones alimentarias.` / `Alerta alimentaria: alergia al maní. Habilitado. Sebastián Mejía.` / `No entregar. Diego Ramírez ya recibió su refrigerio a las 10:42:17, entregado por Ana Solís en Puesto 2. Espera dos segundos.` / `Revisa. Código no reconocido. Este QR no pertenece a ESMUN.`
- **09:** banda (`role="status"`) → `Ver cola pendiente`.
- **10:** volver → `Volver a escanear` (la lista es tabla estática con `aria-label="Canjes en espera"`).
- **11:** volver → `Seguir escaneando` → `Cerrar sesión` → (modal) campo → confirmar → cancelar.
- **13 / 24:** encabezado → `Ver los 20` → tarjeta de flujo (`aria-live="polite"`, solo la fila nueva se anuncia: `Valentina Ortiz, ECOSOC, Noruega, 10:14:02`) → nav inferior.
- **18 / 25:** buscador → chips en orden visual → filas (una parada por fila, `aria-label` = nombre + rol + foro + país + estado de credencial) → paginación → FAB.
- **20:** segmentado de rol → nombre → foro → país/cargo → notas → guardar. El error de cupo va en `aria-describedby` del campo país y se anuncia `assertive`.
- **21 / 26:** filtro → celdas con error en orden de fila → atrás → importar.
- Modales y hojas: foco atrapado, `Esc` cierra los no destructivos, los destructivos exigen la palabra escrita; al cerrar, el foco vuelve al disparador.

Otras reglas: `lang="es"` en `<html>`; el estado del progreso de bloqueo se expone como `role="timer"` con `aria-valuetext="Espera 1,2 segundos"`; todos los iconos decorativos `aria-hidden="true"`; las horas se anuncian con `<time datetime>`; los totales `n/m` llevan `aria-label="248 de 350 entregados"`.

---

## 10. Impresión

### 10.1 Gafete — 74 × 105 mm (A7 vertical)

| Elemento | Posición / medida |
|---|---|
| Formato | 74 × 105 mm; sangrado 3 mm por lado (78 × 111 mm con sangrado) |
| Margen de seguridad | 5 mm en los cuatro lados |
| **Banda de rol** | 74 × **6 mm** al borde superior (a sangre, sin margen). Texto del rol centrado, 7 pt mono, mayúsculas, tracking +0.16em |
| Troquel del cordón | ranura de 12 × 3 mm, radio 1.5 mm, centrada horizontalmente, con su **eje a 8 mm del borde superior** (dentro de la banda de rol) |
| **QR** | **42 × 42 mm**, centrado horizontalmente, borde superior a **15 mm** del borde de la hoja. Corrección de errores **nivel Q (25 %)**. Zona de silencio 4 módulos ≙ **2 mm** blancos alrededor (no imprimir nada dentro de 46 × 46 mm) |
| Nombre | bloque desde **61 mm**, ancho 64 mm (5 mm de margen), centrado. IBM Plex Sans Condensed 700, mayúsculas. **18 pt** si cabe en una línea; **16 pt** si cabe en dos; **14 pt** para dos líneas largas. Máximo 2 líneas, interlínea 1.02, partición con guion permitida |
| Regla | 1 pt (0.35 mm) negra, ancho 64 mm, 2.5 mm bajo el nombre |
| Foro y país | 2.5 mm bajo la regla, **10 pt**, `#41455F`, centrado, hasta 2 líneas (interlínea 1.25) |
| Pie | a 4 mm del borde inferior: `ESMUN 2026` izquierda y los 8 primeros caracteres del token derecha, 6.5 pt mono, tracking +0.12em, `#8B8FA6` |
| Reverso | blanco, o texto de contacto de logística si se imprime a doble cara |

**Colores por rol** (banda de 6 mm) — reconocibles a 10 m **sin leer** por color *y* por textura:

| Rol | Fondo | Texto | Refuerzo no cromático |
|---|---|---|---|
| Mesa | `#14162A` | blanco | banda maciza oscura |
| Delegado | `#3B49C9` | blanco | banda maciza índigo |
| Staff | `#7A8199` | blanco | banda maciza media |
| Prensa | `#14162A` | blanco sobre trama | **trama vertical** de 2.5 mm blanco/oscuro |
| Invitado | `#FFFFFF` | `#14162A` | **marco** de 1 mm `#14162A` en los 4 lados de la banda |

**Caso extremo obligatorio (probado):** `MARÍA FERNANDA VILLALOBOS-ECHEVERRÍA` en `Consejo de Seguridad` / `República Democrática del Congo` → nombre a 14 pt en dos líneas (`MARÍA FERNANDA` / `VILLALOBOS-ECHEVERRÍA`), foro y país en dos líneas de 10 pt. Cabe con 3.5 mm de aire sobre el pie. Regla de implementación: medir el texto y bajar de 18 → 16 → 14 pt; si a 14 pt en dos líneas sigue desbordando, recortar el **país** a su forma corta (`Rep. Dem. del Congo`), nunca el nombre.

### 10.2 Pliego de impresión — A4

- Hoja A4 210 × 297 mm, retícula **2 × 4** = 8 gafetes por hoja.
- Área ocupada por gafetes: 148 × 420 mm → **no cabe en A4 en vertical** con 4 filas de 105 mm (420 > 297). Solución adoptada: **los gafetes se imprimen a 74 × 105 mm en A4 horizontal 2 × 2 (4 por hoja)** *o* se mantiene 2 × 4 en **A3**. Decisión por defecto: **A4 vertical con retícula 2 × 4 de gafetes escalados a 74 × 70 mm** rompería el formato A7, así que se implementa **A3 vertical (297 × 420 mm) con 2 × 4 gafetes a tamaño real**, y se ofrece además un PDF A4 de 2 × 2. Ver **DECISIONES §12.1** — esta es la única contradicción del encargo y necesita tu confirmación.
- Sangrado: 3 mm por gafete; los gafetes se colocan **sin separación** (corte compartido) para que una sola línea de corte sirva a dos.
- Marcas de corte: líneas de 0.25 pt negras, longitud 5 mm, a 3 mm del área de corte, en las cuatro esquinas de la retícula y en cada intersección de calles. Marcas de registro no necesarias (impresión digital CMYK).
- Márgenes de hoja: A3 → 15 mm laterales, 8.5 mm superior/inferior. A4 2 × 2 → 31 mm laterales, 43.5 mm superior/inferior.
- Numeración de hoja al pie fuera del área de corte: `ESMUN 2026 · hoja 07 de 44 · Consejo de Seguridad` en 6 pt mono.
- **350 personas:** 44 hojas a 8 por hoja (A3); 88 hojas a 4 por hoja (A4).
- Generación: `@react-pdf/renderer` o Puppeteer con `@page { size: A3 portrait; margin: 0 }`, QR como SVG (nunca PNG escalado), perfil CMYK no requerido (impresión digital), 300 ppp mínimo para cualquier trama.
- Prueba obligatoria antes de la tirada: imprimir 1 hoja y verificar que el QR se lee a 15 cm con la cámara del teléfono más viejo del staff.

---

## 11. Mapa componente → dato

Esquema de referencia (Supabase / Postgres):

`participants(full_name, role[mesa|delegado|staff|prensa|invitado], forum_id, delegation_id, position, dietary_notes, qr_token, is_active)` · `forums(name, short_name)` · `delegations(country, seats)` · `dispatch_sessions(name, kind, state[draft|open|closed], opened_at, closed_at, eligible_roles)` · `redemptions(participant_id, session_id, dispatched_by, device_label, redeemed_at, voided_at, void_reason)` · `profiles(display_name, role[admin|dispatcher])`
`redeem_qr(token) → { status[granted|duplicate|unknown_token|not_eligible|session_closed], name, detail, diet, redeemed_at, by }`

| Pantalla · elemento visible | Dato |
|---|---|
| **04** barra: nombre de sesión | `dispatch_sessions.name` (de la sesión con `state='open'`) |
| **04** barra: micro «Día 1 · Puesto 1» | `dispatch_sessions.kind` + `redemptions.device_label` elegido en §02 |
| **04** contador del turno | `count(redemptions)` donde `dispatched_by = auth.uid()` y `session_id = open.id` y `voided_at is null` |
| **04** «2 rechazos» | contador local del dispositivo (no persiste; ver §12.6) |
| **05–08** verbo del veredicto | `redeem_qr().status` |
| **05–08** nombre 32 pt | `redeem_qr().name` ← `participants.full_name` |
| **05** «Consejo de Seguridad · Francia» | `redeem_qr().detail` ← `forums.name` + `delegations.country` (o `participants.position` si `role='mesa'`) |
| **05** micro «Delegado · Sin restricciones» | `participants.role` + (`dietary_notes` vacío) |
| **06** restricción a 40 pt | `redeem_qr().diet` ← `participants.dietary_notes`, normalizado a mayúsculas |
| **05/06** cuño «Sellado 9:42:08» | `redemptions.redeemed_at` de la fila recién creada |
| **07** hora del cuño | `redeem_qr().redeemed_at` |
| **07** «por Ana Solís · Puesto 2» | `redeem_qr().by` ← `profiles.display_name` (vía `redemptions.dispatched_by`) + `redemptions.device_label` |
| **08** caso A | `status='unknown_token'` (sin `name`) |
| **08** caso B nombre y rol | `status='not_eligible'` + `name` + `participants.role` vs `dispatch_sessions.eligible_roles` |
| **08** caso C | `status='session_closed'` + `dispatch_sessions.closed_at` |
| **09** banda de conexión | `navigator.onLine` + tamaño de la cola local (IndexedDB) |
| **09/10** «7 en cola» | filas pendientes en IndexedDB (no en Supabase) |
| **10** «Más antiguo 10:58:41» | `min(redeemed_at)` de la cola local |
| **11** métricas del turno | agregados de `redemptions` filtrados por `dispatched_by` + `session_id` |
| **11** desglose de rechazos | contadores locales por `status` |
| **13/24** `248` | `count(redemptions where session_id=open and voided_at is null)` |
| **13/24** `/ 350` | `count(participants where is_active and role = any(eligible_roles))` |
| **13/24** ritmo `6,2 / min` | ventana móvil de 5 min sobre `redeemed_at`; pico = máximo por minuto |
| **13/24** avance por foro | `group by participants.forum_id`; etiqueta `forums.name` (móvil: `short_name`) |
| **13/24** fila del flujo | `participants.full_name`, `forums.short_name`, `delegations.country`, `redemptions.redeemed_at`, `profiles.display_name`, `redemptions.device_label` |
| **13/24** `Puestos 3` | `count(distinct redemptions.device_label)` en la sesión |
| **14** tarjeta de sesión | `dispatch_sessions.name`, `.state`, `.opened_at`, `.closed_at` + conteo de canjes |
| **15** `Personas esperadas 338` | `count(participants)` con `role = any(eligible_roles)` y `is_active` |
| **15** `Excluidos 12 invitados` | roles fuera de `eligible_roles` |
| **16** `102 personas no han pasado` | elegibles − canjeados; desglose por `forum_id` |
| **17** cifras del acta | agregados congelados al `closed_at`; `Anulados` = `count(voided_at is not null)` |
| **17** por despachador | `group by dispatched_by` + `device_label`; ritmo = canjes / (closed−opened) |
| **17** no pasaron por foro | elegibles sin fila en `redemptions` para esa sesión, agrupados por `forum_id` |
| **18/25** fila de participante | `full_name`, `role`, `forums.name`, `delegations.country`\|`position`, `dietary_notes`, `qr_token is not null`, `is_active` |
| **18/25** filtros | `forum_id`, `role`, `qr_token is null` |
| **19** QR y token | `participants.qr_token` |
| **19** historial | `redemptions` del participante × las 6 `dispatch_sessions` (`redeemed_at`, `voided_at`, `dispatched_by`) |
| **20** desplegable de país | `delegations` del `forum_id`; agotado si `count(delegados activos) >= delegations.seats` |
| **20** cargo | `participants.position` |
| **21/26** columnas mapeadas | `full_name`, `role`, `forum_id` (por `forums.name`\|`short_name`), `delegation_id` (por `delegations.country`), `position`, `dietary_notes` |
| **22** `344 / 350` | `count(qr_token is not null)` / `count(participants where is_active)` |
| **23** contexto y motivo | `redemptions.participant_id`, `.session_id`, `.redeemed_at`, `.dispatched_by`, `.device_label`; escribe `voided_at` + `void_reason` (y el `auth.uid()` del admin) |

**Reglas de datos no negociables**
1. La app del despachador **solo** puede leer, de participantes, lo que devuelve `redeem_qr(token)`. No hay `select` sobre `participants` desde el rol `dispatcher` (RLS). Sin buscador, sin listado, sin totales del evento.
2. `redeem_qr` es la única vía de escritura de canjes; es idempotente por `(participant_id, session_id)` y devuelve `duplicate` con los datos de la primera entrega.
3. Índice único en base de datos: `unique (participant_id, session_id) where voided_at is null`.
4. Modo local: la app descarga al abrir la sesión un índice de `qr_token → {name, detail, diet, elegible}` **de los participantes elegibles** y valida duplicados contra su propia cola. Al reconectar, cada canje se reenvía a `redeem_qr`; si el servidor responde `duplicate`, el canje local se marca como conflicto y aparece en el acta como anomalía (no se pierde información).

---

## 12. DECISIONES PENDIENTES

Cada punto es una suposición que tomé para poder cerrar el diseño. Confírmalas o corrígelas.

1. **El pliego 2 × 4 de gafetes A7 no cabe en A4.** 4 × 105 mm = 420 mm > 297 mm. Asumí **A3 vertical con 2 × 4 a tamaño real (44 hojas)** y un PDF alternativo **A4 con 2 × 2 (88 hojas)**. La otra salida sería reducir el gafete a 74 × 70 mm y perder el A7. ¿Cuál de las tres?
2. **Auto-avance del veredicto habilitado a los 1200 ms.** Lo asumí para no exigir un toque por persona (la mano tiene comida). El duplicado nunca se auto-avanza y la alerta alimentaria tampoco. ¿Confirmas 1200 ms, o prefieres toque siempre?
3. **La alerta alimentaria se muestra a *todos* los roles**, no solo delegados, y el texto se toma literal de `dietary_notes`. Asumí que alguien normaliza esas notas antes del evento a un vocabulario corto (`SIN GLUTEN`, `ALERGIA AL MANÍ`, `VEGETARIANO`). ¿Quién y cuándo?
4. **Los puestos son tres y fijos** («Patio central», «Pasillo de aulas», «Entrada del auditorio»). Los puse configurables por sesión. ¿Pueden cambiar de nombre o de número entre días?
5. **`not_eligible` muestra el nombre de la persona.** Rompe parcialmente la regla de «el despachador no ve datos», pero sin nombre no puede devolverle el gafete a nadie. ¿De acuerdo? La alternativa es mostrar solo `Prensa · sin derecho en esta sesión`.
6. **Los rechazos no se persisten** (solo contador local del turno) para no crear una tabla de intentos con datos de menores. Eso hace que el acta no pueda auditar rechazos por despachador. ¿Los quieres persistidos?
7. **Anular después de cerrar la sesión genera un acta v2.** Asumí que el acta original queda archivada y visible. ¿O prefieres que el acta sea inmutable y las anulaciones vivan en un anexo?
8. **Bloqueo de 2 s exacto en duplicado**, sin posibilidad de saltarlo con un gesto oculto. Con filas de 60 personas cuesta ~2 s por duplicado. ¿Confirmas?
9. **Cupo de 2 delegados por país y foro** viene de `delegations.seats`, con 2 por defecto y editable por delegación. Asumí que la mesa (rol `mesa`) **no** consume cupo de país. ¿Correcto?
10. **Sesión del despachador de 18 h** sin re-autenticar (cubre un día completo). ¿O quieres cierre automático al terminar cada sesión de entrega?
11. **Contador del turno = canjes de este dispositivo en esta sesión de entrega**, no del día. Si el despachador cambia de puesto, el contador se reinicia. ¿O debe acumular por persona?
12. **Un solo dispositivo por puesto.** Si dos teléfonos eligen «Puesto 2», los canjes se mezclan bajo la misma etiqueta. ¿Debo impedirlo?
13. **Invitados sin foro ni país** y excluidos de la mayoría de sesiones (`eligible_roles`). ¿Los invitados comen? Asumí que solo en la sesión de clausura.
14. **Importar CSV actualiza por `nombre + foro`.** Con dos homónimos en el mismo foro se pisan. ¿Hay un identificador externo (código de estudiante) que deba usar como clave?
15. **El token del QR es opaco y aleatorio** (`esm-` + 12 hex, sin datos personales) y no rota entre días: un gafete sirve los tres días. ¿Correcto?
16. **Idioma único, español latinoamericano.** Sin selector de idioma ni versión en inglés del gafete. ¿Confirmas?
17. **La app del admin no tiene escáner.** Si el organizador necesita despachar, entra con una cuenta de despachador. ¿O quieres el escáner también en la consola?
18. **Escritorio solo en tres pantallas** (panel, participantes, importar). Las otras nueve del admin se ven en móvil dentro de una columna centrada de 390 en pantallas grandes. ¿Suficiente, o hay que resolver también sesiones y acta en 1440?
19. **`prefers-reduced-motion` mantiene el progreso de bloqueo.** Lo consideré información, no animación. ¿De acuerdo?
20. **Sonido y vibración por defecto encendidos**, con la regla de que no se pueden apagar los dos a la vez. ¿Aceptas esa restricción?
21. **Nombre del evento y año** («ESMUN 2026», «Colegio Eagles») están en el pie del ingreso y del gafete. ¿El año correcto y el nombre oficial son esos?
22. **Los 20 foros y sus nombres cortos** los inventé para las maquetas (`C. de Seguridad`, `DISEC`, `ECOSOC`, `Asamblea General`, `Corte Internacional`, `UNESCO`, `OMS`, `Derechos Humanos`…). Necesito la lista real con `short_name` para verificar que ninguno rompa el ancho de la fila del flujo.
23. **Contador `/ 350` se calcula sobre elegibles de la sesión, no sobre 350 fijo.** En la sesión de la tarde son 338. ¿Prefieres mostrar siempre 350 para que la cifra sea comparable entre sesiones?
24. **Sin foto en el gafete.** El QR ocupa el espacio que tendría la foto. ¿Se necesita foto por seguridad del colegio?
