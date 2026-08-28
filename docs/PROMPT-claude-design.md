# Prompt para Claude Design — Sistema de interfaz ESMUN

> **Cómo usar este archivo:** copia todo lo que está debajo de la línea (desde `# ENCARGO` hasta el final) y pégalo en Claude Design. Cuando termine, descarga el archivo `handoff-esmun.md` que va a generar y pásamelo de vuelta para empezar el desarrollo.

---

# ENCARGO: Sistema de interfaz móvil para ESMUN

Necesito el diseño completo de la interfaz de una plataforma real que se usa durante un evento de tres días. No es un concepto ni una exploración: es el diseño que se va a implementar tal cual la semana siguiente. Todo lo que dejes sin especificar lo voy a tener que inventar yo, y eso se nota en el producto final.

Al terminar tienes que entregarme **un archivo Markdown descargable llamado `handoff-esmun.md`** con la especificación exacta. La estructura obligatoria de ese archivo está al final de este encargo (sección 11). El diseño visual y el archivo son un solo entregable: uno sin el otro no me sirve.

---

## 1. Qué es ESMUN y por qué importa el contexto

ESMUN es el Modelo de Naciones Unidas del Colegio Eagles. Durante tres días, **350 estudiantes** repartidos en **20 foros** (comités como Consejo de Seguridad, ECOSOC, DISEC) simulan sesiones de la ONU. Cada participante tiene un rol: es **mesa** (preside un foro) o **delegado** (representa un país dentro de un foro). También hay staff, prensa e invitados.

La plataforma hace dos cosas:

1. **Registra** a las 350 personas y les genera un **gafete impreso con código QR**.
2. **Controla la entrega de comida.** Hay 6 momentos de entrega (dos por día). En cada uno, un despachador escanea el QR de cada persona y le da su snack. **Cada persona tiene derecho a un solo canje por sesión.** Si intenta escanear dos veces, el sistema lo rechaza y muestra a qué hora y quién se lo entregó la primera vez.

Hay dos tipos de usuario, y sus interfaces son productos distintos:

| | **Despachador** | **Administrador** |
|---|---|---|
| Quién es | Un estudiante voluntario o un docente | El organizador del evento |
| Dónde está | De pie, en un pasillo o patio, con una fila de 60 personas enfrente y comida en la otra mano | Sentado, con tiempo, revisando |
| Qué hace | **Solo escanear.** Nada más. | Todo lo demás |
| Cuánto tiempo tiene por interacción | 2 segundos | El que necesite |
| Qué pasa si se equivoca | Se traba la fila y alguien se queda sin comer | Lo puede corregir |

**Esa asimetría es el corazón del diseño.** La app del despachador tiene que ser legible de reojo, operable con una mano, y no tener ni un solo elemento que se pueda tocar por error. La del admin puede ser densa en información.

---

## 2. Restricciones duras — no negociables

Estas no son preferencias. Si el diseño las rompe, no se puede implementar.

1. **El despachador nunca ve una lista de participantes.** Ni un buscador, ni un total, ni un nombre que no acabe de escanear. Son datos de menores de edad y el teléfono se puede perder. Lo único que ve además del veredicto es un contador de su turno.
2. **El veredicto se distingue sin leer y sin color.** Un 8% de los hombres tiene daltonismo rojo-verde y el pasillo tiene mala luz. Cada estado necesita **forma, ícono, posición y texto** diferentes, no solo color. Verifícalo simulando deuteranopia.
3. **El estado "ya entregado" no se puede cerrar por accidente.** Bloquea la acción 2 segundos. Si el despachador lo cierra sin leer, entrega comida dos veces y el sistema queda desmentido.
4. **Todo funciona sin internet.** El wifi del colegio es intermitente. Cada pantalla del scanner necesita su variante con la conexión caída, y tiene que quedar claro que la operación **sigue funcionando** — no es un error, es un modo.
5. **Objetivos táctiles: mínimo 48×48 pt.** El botón principal del scanner: **64 pt de alto**, ancho completo menos márgenes, en el tercio inferior de la pantalla (zona del pulgar).
6. **Contraste WCAG AA:** 4.5:1 en texto normal, 3:1 en texto grande y en elementos de interfaz. Sin excepciones para "que se vea más elegante".
7. **El nombre de la persona escaneada se lee a un metro de distancia.** Mínimo 32 pt, peso alto.
8. **Sin lorem ipsum.** Todos los textos, en español latinoamericano, redactados de verdad. Los nombres de ejemplo son personas plausibles: María Fernanda López, Diego Ramírez, Andrés Castillo, Valentina Ortiz, Sebastián Mejía.

---

## 3. Dirección visual

Quiero un diseño **excelente**, no uno correcto. Tienes libertad total en paleta y tipografía siempre que respetes lo de arriba. Pero quiero que la libertad se gaste en algo específico, no en lo de siempre.

**De dónde sacar el lenguaje visual.** El mundo de este proyecto tiene objetos propios: la **placa de nombre** sobre el escritorio del delegado, la **credencial con cordón**, el **sello** que se estampa una sola vez, la **lista de pase de lista**, el mazo, la placa de país. Ese vocabulario —tipografía de placa, el gesto de "sellado", el formato de credencial— es de donde deberían salir las decisiones distintivas. No lo hagas literal ni decorativo: que se note en la estructura, no en un ícono de mazo.

**Restricciones de color con razón de ser:**
- Los tres colores semánticos (éxito, error, advertencia) son de uso exclusivo del veredicto del scanner. **El color de acento de la marca no puede ser verde, rojo ni ámbar** o compite con el único mensaje que importa.
- La app del despachador es **oscura por defecto**: pasillos con poca luz, menos deslumbramiento a las 7 de la mañana, y más batería en un teléfono que va a estar seis horas con la cámara abierta.
- La app del admin sigue el tema del sistema, con ambos temas resueltos con el mismo cuidado.
- Los neutros no son grises puros: sesgados hacia el acento.

**Lo que NO quiero** — son los defectos que produce el diseño generado en piloto automático, y los voy a reconocer:
- Crema `#F4F1EA` con serif de display y acento terracota.
- Negro con un solo verde ácido o bermellón de contraste.
- Degradado morado-a-azul en el encabezado.
- Inter o Space Grotesk como tipografía "segura".
- Emojis como marcadores de sección.
- Todo centrado, todo con `border-radius` mediano, tarjetas con una barrita de color a la izquierda.
- Números 01 / 02 / 03 decorativos donde no hay una secuencia real.

**Toma un riesgo estético de verdad, en un solo lugar,** y mantén todo lo demás en silencio. Un sistema que se opera a toda velocidad no aguanta personalidad en cada esquina: aguanta un gesto memorable y mucha disciplina alrededor.

---

## 4. Sistema base — medidas obligatorias

Diseña sobre estas medidas y **declara en el handoff el valor exacto en px de cada región de cada pantalla.**

**Lienzo**
- Base: **390 × 844 pt** (iPhone 14/15/16). Artboards a 1×.
- Verificar que no se rompe en **360 × 800** (Android común) y **430 × 932** (Pro Max).
- Insets seguros: **47 pt arriba**, **34 pt abajo**. Ningún contenido interactivo dentro de ellos.

**Retícula y espaciado**
- Unidad base: **4 pt**. Toda medida es múltiplo de 4.
- Márgenes laterales: **20 pt**. Canaleta: **12 pt**. 4 columnas.
- Escala de espaciado: `4, 8, 12, 16, 20, 24, 32, 40, 56, 72`.

**Escala tipográfica** — define familias y pesos tú, respeta los tamaños:

| Rol | Tamaño | Interlínea | Uso |
|---|---|---|---|
| Veredicto | 40 pt | 1.05 | La palabra que resuelve el escaneo |
| Nombre | 32 pt | 1.15 | La persona escaneada |
| Título de pantalla | 28 pt | 1.2 | |
| Sección | 22 pt | 1.25 | |
| Cuerpo | 17 pt | 1.5 | Mínimo para texto leíble |
| Secundario | 15 pt | 1.45 | |
| Etiqueta | 13 pt | 1.4 | |
| Micro | 11 pt | 1.3 | Mayúsculas, +8% de tracking, siempre monoespaciada |

Los números que se comparan o se alinean en columna van en **cifras tabulares**.

**Composición obligatoria de la pantalla de escaneo** (declara los px exactos de cada franja):
1. Barra superior: nombre de la sesión activa, contador del turno, indicador de conexión. **Mínimo 56 pt.**
2. Visor de cámara: full-bleed horizontal, **entre el 45% y el 55%** del alto, con marco de puntería centrado de **240 × 240 pt**.
3. Zona de veredicto: ocupa el resto. Cuando hay veredicto, **inunda la pantalla completa** con el color del estado, incluida el área de la cámara.
4. Acción única, anclada abajo, 64 pt de alto, sobre el inset seguro.

**Objetivo de rendimiento visual:** del momento en que el QR entra al encuadre al momento en que el despachador entiende el veredicto deben pasar **menos de 400 ms**. Diseña para eso: nada que requiera leer dos veces, nada que aparezca con una animación de más de 150 ms.

---

## 5. Pantallas a diseñar — App del despachador

Móvil, tema oscuro, modo kiosco (pantalla completa, sin barra de navegador). Once artboards.

1. **Ingreso** — correo y contraseña. Un solo campo visible a la vez si mejora el enfoque. Teclado sin cubrir el botón.
2. **Elegir puesto** — el despachador escoge su etiqueta de dispositivo: "Puesto 1", "Puesto 2", "Puesto 3". Queda registrada en cada entrega.
3. **En espera** — no hay ninguna sesión de entrega abierta. Pantalla tranquila que diga qué está pasando y qué va a pasar cuando el admin abra. Se actualiza sola.
4. **Escaneando** — estado de reposo con la cámara activa, marco de puntería, contador "43 entregados en este turno".
5. **Veredicto: habilitado** — verde a pantalla completa. Nombre a 32 pt, debajo el foro y el país ("Consejo de Seguridad · Francia"), botón "Continuar".
6. **Veredicto: habilitado con alerta alimentaria** — variante del anterior. Aviso de restricción (`SIN GLUTEN`, `ALERGIA AL MANÍ`) que **domina la pantalla por encima del nombre**. Es el único momento en que ese dato existe y evita una emergencia médica.
7. **Veredicto: ya entregado** — rojo a pantalla completa. Nombre, y debajo "Entregado 10:42:17 por Ana Solís · Puesto 2". Acción bloqueada 2 segundos con indicador visible de la espera.
8. **Veredicto: QR no válido** — ámbar. Cubre dos casos que el despachador debe distinguir: código que no pertenece a ESMUN, y persona cuyo rol no aplica a esta sesión.
9. **Sin conexión** — banner permanente + la pantalla de escaneo operando normalmente. Debe leerse como "funcionando en modo local", nunca como error.
10. **Cola pendiente** — cuántos canjes esperan subir, desde cuándo, y qué pasa cuando vuelva la señal. Sin botones peligrosos.
11. **Fin de turno** — resumen: cuántos entregó, en cuánto tiempo, cuántos rechazos. Confirmación para cerrar sesión, porque cerrarla por error en medio del despacho es un desastre.

## 6. Pantallas a diseñar — App del administrador

Móvil primero (el admin camina por el evento con el teléfono). Doce artboards móviles.

12. **Ingreso**
13. **Panel en vivo** — la pantalla más importante del admin. Sesión activa, total entregado sobre total esperado, avance por foro, ritmo por minuto, y el flujo de entregas en tiempo real: nombre, foro, país, hora exacta, quién se lo entregó. Se actualiza sola sin recargar. Piensa el diseño de la información, no solo la maqueta: qué se ve primero desde metro y medio de distancia.
14. **Sesiones de entrega** — las 6 sesiones con su estado (borrador, abierta, cerrada). Solo una puede estar abierta a la vez.
15. **Abrir sesión** — confirmación con consecuencias explícitas: qué sesión, qué roles pueden canjear, cuántas personas esperadas.
16. **Cerrar sesión** — confirmación destacando lo irreversible y cuántas personas no pasaron.
17. **Reporte de cierre** — se genera solo al cerrar. Total entregado, lista de quiénes no pasaron agrupada por foro, desglose por despachador, duración, ritmo pico. Exportable a CSV y PDF. Este documento es el acta del evento: diséñalo como algo que se imprime y se archiva, no como una pantalla más.
18. **Participantes** — 350 registros. Búsqueda, filtros por foro y por rol, estado de credencial generada. Densidad alta pero escaneable.
19. **Ficha de participante** — datos, su QR, historial de canjes en las 6 sesiones, botón de descarga de gafete.
20. **Alta / edición de participante** — formulario con lógica condicional: al elegir "Mesa" pide foro y cargo; al elegir "Delegado" pide foro y país. El país depende del foro elegido y avisa si el cupo ya está lleno (recuerda: se permiten hasta 2 delegados por país y foro).
21. **Importar CSV** — subida, mapeo de columnas, vista previa con errores señalados fila por fila, y confirmación. Es la pantalla que decide si el admin carga 350 personas en 10 minutos o en una noche.
22. **Credenciales** — generar los QR, descargar uno, descargar un ZIP por foro, y generar el pliego PDF para imprenta.
23. **Anular entrega** — modal con motivo obligatorio escrito y advertencia de que queda registrado con su nombre.

## 7. Vistas de escritorio del admin

Tres artboards a **1440 × 900** de las pantallas que en la vida real se usan sentado: **Panel en vivo**, **Participantes** e **Importar CSV**. Mismo sistema, aprovechando el ancho — no la versión móvil estirada.

---

## 8. Componentes a especificar

Cada uno con todas sus variantes, tamaños y estados (reposo, presionado, foco por teclado, deshabilitado, cargando):

Botón (primario, secundario, destructivo, fantasma) · Campo de texto con etiqueta, ayuda y error · Selector desplegable · Selector de rol (control segmentado) · Buscador · Chip de filtro · Etiqueta de estado (borrador/abierta/cerrada, entregado/pendiente) · Fila de participante · Fila del flujo en vivo · Tarjeta de métrica con valor grande y comparación · Barra de progreso por foro · Contador grande · Marco de puntería de cámara · Panel de veredicto (3 variantes) · Banner de conexión · Modal de confirmación · Modal destructivo · Hoja inferior · Aviso emergente · Estado vacío · Esqueleto de carga · Barra de navegación inferior del admin.

---

## 9. Movimiento y retroalimentación

- Duración, curva y disparador de cada transición. **Nada por encima de 200 ms en el flujo del scanner.**
- Comportamiento completo con `prefers-reduced-motion: reduce`.
- **Sonido y vibración por estado**, especificados con precisión: qué tono, qué duración, qué patrón de vibración. En una fila ruidosa el despachador opera de oído, no de vista. Los tres estados tienen que ser distinguibles con el teléfono en el bolsillo.

---

## 10. El gafete impreso

Además de las pantallas, diseña la credencial física y su pliego de impresión:

- **Gafete: 74 × 105 mm** (A7 vertical), troquel para cordón a 8 mm del borde superior.
- **QR: 42 × 42 mm**, corrección de errores nivel Q, con zona de silencio respetada.
- **Nombre** debajo del QR, 14–18 pt según largo, máximo dos líneas.
- **Foro y país** en segunda línea, 10 pt.
- **Banda de rol** de 6 mm en el borde superior, con color propio por rol (mesa, delegado, staff, prensa, invitado): tiene que reconocerse a diez metros sin leer nada.
- **Pliego: A4 con 8 gafetes** (retícula 2 × 4), 3 mm de sangrado, marcas de corte. 350 personas = 44 hojas.
- Diseña también el caso feo: **"María Fernanda Villalobos-Echeverría"** en el Consejo de Seguridad representando a **"República Democrática del Congo"**. Si el gafete aguanta ese, aguanta todos.

---

## 11. El entregable: `handoff-esmun.md`

Genera un archivo Markdown descargable llamado exactamente `handoff-esmun.md`. Lo va a leer un desarrollador que implementa en **Next.js (App Router) + React + Tailwind CSS + Supabase**, y que **no tiene acceso al lienzo**: todo lo que no esté escrito ahí, se pierde.

Estructura obligatoria:

1. **Tokens** — todos los colores como custom properties CSS con hex exactos, en tema claro y oscuro, más el bloque equivalente para el tema de Tailwind. Nombra por función (`--surface-raised`), nunca por apariencia (`--gris-claro`).
2. **Tipografía** — familias con su enlace de Google Fonts y pila de respaldo, la escala completa con tamaño/peso/interlínea/tracking, y qué rol usa cada nivel.
3. **Espaciado, radios, bordes, sombras y elevación** — valores exactos.
4. **Especificación pantalla por pantalla** — para cada uno de los 26 artboards: nombre, ruta sugerida en Next.js, árbol de layout con **dimensiones exactas en px de cada región**, componentes usados, todos los estados, y **todos los textos literales en español listos para copiar**.
5. **Biblioteca de componentes** — cada componente con variantes, medidas, estados y las props que necesitaría en React.
6. **Iconografía** — lista completa de íconos usados, set recomendado, tamaños y grosor.
7. **Movimiento** — tabla de transición, duración, curva, disparador. Y la versión reducida.
8. **Retroalimentación no visual** — sonidos y patrones de vibración por estado.
9. **Accesibilidad** — ratios de contraste verificados de cada par color/fondo, orden de foco de cada pantalla, etiquetas para lector de pantalla, y la verificación de daltonismo de los tres estados del veredicto.
10. **Impresión** — especificación completa del gafete y del pliego, en milímetros.
11. **Mapa componente → dato** — qué campo alimenta cada elemento visible, usando este esquema:
    - `participants`: `full_name`, `role` (mesa | delegado | staff | prensa | invitado), `forum_id`, `delegation_id`, `position`, `dietary_notes`, `qr_token`, `is_active`
    - `forums`: `name`, `short_name`
    - `delegations`: `country`, `seats`
    - `dispatch_sessions`: `name`, `kind`, `state` (draft | open | closed), `opened_at`, `closed_at`, `eligible_roles`
    - `redemptions`: `participant_id`, `session_id`, `dispatched_by`, `device_label`, `redeemed_at`, `voided_at`, `void_reason`
    - `profiles`: `display_name`, `role` (admin | dispatcher)
    - La función `redeem_qr(token)` devuelve: `status` (granted | duplicate | unknown_token | not_eligible | session_closed), `name`, `detail`, `diet`, `redeemed_at`, `by`
12. **DECISIONES PENDIENTES** — lista numerada de todo lo que tuviste que asumir y que yo debería confirmar. Sé exhaustivo aquí: una suposición escrita se corrige en un minuto, una suposición silenciosa se descubre en producción.

Escribe el archivo para que se pueda implementar sin volver a mirar el diseño. Si tienes que elegir entre que sea bonito de leer o que sea preciso, elige preciso.
