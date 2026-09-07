# Decisiones — respuesta a `handoff-esmun.md` §12

Las 24 suposiciones del diseño, resueltas. Donde cambio algo respecto al handoff, digo por qué.

| # | Tema | Decisión |
|---|---|---|
| 1 | Pliego de impresión | **A4 con 2 × 2 = 4 gafetes por hoja, 88 hojas.** El diseño detectó un error mío: 4 × 105 mm = 420 mm no cabe en los 297 mm de un A4. A3 se descarta porque un colegio imprime en A4. El gafete conserva su tamaño A7 real. |
| 2 | Auto-avance | **Confirmado a 1200 ms** en «habilitado» sin alerta. Configurable por evento. Nunca en duplicado ni en alerta alimentaria. |
| 3 | Normalización de alergias | El formulario de alta ofrece fichas rápidas (`SIN GLUTEN`, `ALERGIA AL MANÍ`, `VEGETARIANO`, `SIN LACTOSA`) más campo libre. La responsabilidad de normalizar es del admin al cargar, y el importador CSV avisa de valores fuera del vocabulario. |
| 4 | Puestos | **Configurables**, tabla `stations` por evento. Se pueden renombrar entre días sin tocar código. |
| 5 | Nombre en `not_eligible` | **Sí se muestra.** Sin nombre, el despachador no puede devolverle el gafete a nadie. |
| 6 | Persistir rechazos | **Sí, en `scan_attempts`.** Discrepo del diseño: sin esto no se puede responder «yo nunca recibí mi refrigerio» ni detectar un lector roto durante el evento. La tabla no guarda datos personales propios, solo referencias, y entra en la política de retención. |
| 7 | Acta tras anulación | El acta **se calcula sobre los datos**, no se congela. Una anulación posterior aparece en la sección «anomalías» con motivo, hora y responsable. Sin versiones. |
| 8 | Bloqueo de 2 s | **Confirmado**, sin gesto para saltarlo. |
| 9 | Cupo de país | **La mesa no consume cupo.** Impuesto por `check (delegation_id is null or role = 'delegado')`. Cupo por defecto 2, editable por delegación. |
| 10 | Sesión del despachador | **18 h.** Cubre un día completo sin re-autenticar en medio de una fila. |
| 11 | Contador del turno | Por **dispositivo + sesión de entrega**. Se reinicia al cambiar de puesto. |
| 12 | Dos teléfonos en un puesto | **No se impide**, pero cada canje guarda `device_id` además de `station_label`, así que el acta los separa aunque compartan etiqueta. |
| 13 | ¿Comen los invitados? | Se resuelve por sesión con `eligible_roles`, que el admin ajusta al abrir. Por defecto los invitados quedan fuera. **Confírmalo cuando definas el programa.** |
| 14 | Clave de importación CSV | Añadí `external_code` opcional y único por evento. Si tienes código de estudiante, úsalo y los homónimos dejan de ser un problema. Sin él, la clave es `nombre + foro`. |
| 15 | Token del QR | Opaco y aleatorio, **128 bits** (`esm-` + 32 hex) en vez de los 48 bits del diseño: no cuesta nada y quita la duda. No rota: un gafete sirve los tres días. |
| 16 | Idioma | **Español latinoamericano único.** |
| 17 | Escáner en la consola de admin | **No.** Si el organizador despacha, entra con cuenta de despachador. |
| 18 | Escritorio | **Tres pantallas** (panel, participantes, importar). El resto en columna de 390 centrada. |
| 19 | `prefers-reduced-motion` | **Conserva el progreso del bloqueo**: es información, no animación. |
| 20 | Sonido y vibración | Encendidos por defecto; no se pueden apagar los dos a la vez. |
| 21 | Nombre y fechas | Sembrado como **ESMUN 2026, 16–18 de septiembre**. Provisional — se edita desde el panel. **Confírmame las fechas reales.** |
| 22 | Los 20 foros | Sembré 8 provisionales. **Necesito la lista real con nombre corto** para verificar anchos de fila. |
| 23 | Denominador del contador | **Elegibles de la sesión**, no 350 fijo. Comparar sesiones con distinto denominador engaña más de lo que informa. |
| 24 | Foto en el gafete | **No.** El QR ocupa ese espacio. Se puede añadir después reduciendo el QR a 34 mm. |

## Una tensión que el diseño no resolvió y hubo que resolver

El handoff dice a la vez que el despachador **nunca** ve datos de participantes (§11.1) y que el teléfono **descarga un padrón** para operar sin red (§11.4). Las dos cosas no pueden ser ciertas: para mostrar un nombre y una alerta de alergia sin conexión, esos datos tienen que estar en el teléfono.

Resolución: gana el modo offline, porque una alergia no avisada es un riesgo médico. Las mitigaciones quedan implementadas en `session_roster()`:

- Solo devuelve algo **mientras hay una sesión abierta**.
- Solo los participantes **elegibles para esa sesión**.
- Solo cuatro campos: token, nombre, foro/país, restricción alimentaria. Sin fechas, sin contactos, sin códigos.
- **Cada descarga queda registrada** en `audit_log` con quién y cuándo.
- El padrón se borra del teléfono al cerrar la sesión o al cerrar el turno.

Fuera de esa ventana, la regla original se mantiene entera: no existe ninguna política RLS que le dé a un despachador acceso a `participants`.

## Modo local (implementado el 7 de septiembre de 2026)

El escáner ya no depende de la red para cada lectura:

- Al abrir la sesión, cada teléfono descarga el padrón de elegibles con `session_roster()` y lo guarda en IndexedDB (`src/lib/offline.ts`). Se refresca cada 10 minutos mientras hay señal y se borra al cerrar la sesión o el turno.
- Cada canje va primero al servidor con un tope de 8 segundos. Si la llamada falla por red, el teléfono pasa a modo local: valida contra el padrón y contra lo que él mismo ya selló, guarda el canje en una cola y muestra el veredicto igual, marcado «Guardado en el teléfono».
- Con señal, la cola sube sola cada 8 segundos, en orden y con la hora original (`p_redeemed_at`). Si el servidor responde que otro puesto ya había entregado, el canje queda como conflicto visible en `/cola`; el intento ya quedó registrado en `scan_attempts`.
- Un teléfono sin padrón y sin señal muestra «Sin señal» en índigo y no registra nada: ese gafete hay que volver a escanearlo con conexión.
- Límite conocido: sin red, un teléfono no puede saber lo que entregaron otros puestos. Ese duplicado lo detecta el servidor al subir la cola.
- `/turno` (fin de turno) y `/cola` (cola pendiente) existen desde esta fecha; cerrar sesión se bloquea mientras haya canjes sin subir.
