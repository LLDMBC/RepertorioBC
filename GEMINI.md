# REPERTORIO BC - MASTER CONTEXT

## Proposito del Proyecto
Sistema de gestion de partituras PWA para coros, desarrollado para Huri Tolentino (UABC Tijuana). 
Permite la visualizacion de PDFs con capacidades offline, gestion de multiples sedes (Florido, Otay, etc.) y un catalogo Maestro (Estatal).

## Arquitectura Tecnica
- **Frontend:** Vanilla JS, CSS Variables, Vite.
- **Backend:** Supabase (PostgreSQL + Auth + Storage).
- **Tablas Clave:**
  - `cantos`: Registro maestro de partituras (ID, nombre, archivo, temas).
  - `coros`: Lista de sedes/iglesias.
  - `perfiles`: Usuarios con roles (`miembro`, `director`, `superadmin`).
  - `cantos_coros`: Tabla intermedia de relacion Muchos-a-Muchos (vincula cantos con sedes).

## Funcionalidades Implementadas (Log de Fases)
1. **Realtime:** Suscripciones activas en `main.js` que refrescan el repertorio cuando se agregan/quitan cantos.
2. **Roles:** Acceso condicional al Gestor solo para Directores y Superadmins.
3. **Persistencia:** El sistema recuerda la ultima sede administrada mediante `localStorage`.
4. **Auth Dinamico:** Registro de usuarios basado en las sedes reales de la base de datos (Cero hardcoding).
5. **Ajustes:** Panel modal con info de usuario, limpieza de cache y cierre de sesion.
6. **Promocion Masiva:** Herramienta para que el Superadmin suba cantos locales al Estatal sin duplicar archivos.
7. **Despromover:** Boton para quitar cantos del Estatal sin eliminarlos de la base de datos.
8. **Historial Visual (Fase 8):** Implementacion de una lista de los ultimos 15 cantos agregados a nivel global para auditoria del Superadmin. Se refino la seguridad ocultando el boton "ELIMINAR" global mientras se audita el catalogo "estatal", dejando unicamente la opcion de "QUITAR DEL ESTATAL".
9. **Borrado de Sedes y UI Fix (Fase 9):** Implementacion de boton para eliminar permanentemente sedes secundarias desde el panel de control. El boton se reubico en la cabecera global (`herramientas-superadmin`) por motivos esteticos y de funcionalidad. Se removieron borrados silenciosos y se agrego el manejo detallado de excepciones de base de datos; cuando existe una violacion de clave foranea, el sistema avisa explicitamente al administrador que hay cantos o miembros vinculados que previenen la eliminacion de la sede.
10. **Screen Wakelock y Modos de Navegacion (Fase 10):** Se integro la API nativa de 'Screen Wake Lock' en `main.js` para prevenir que la pantalla del dispositivo se apague mientras una partitura esta abierta en el visor, liberando el bloqueo al cerrar. Tambien se anadio al panel de 'Ajustes' la opcion "Cambio de Pagina (Tap)" ("Modo Paginas") guardada en `localStorage`. Cuando se activa, se inyectan clases CSS (`scroll-snap-type: x mandatory`, `display: flex`) en el visor de PDF para lograr un desplazamiento forzado horizontal entre paginas. Se establecieron 'Zonas de Interaccion' para separar la navegacion de los controles de interfaz: los toques en los bordes laterales (30%) cambian la pagina sin mostrar la barra superior, mientras que un toque en la zona central (40%) es el unico que despliega la barra. Ademas, al abrir una partitura en este modo, la barra superior se oculta automaticamente tras 2 segundos para ofrecer una vista limpia.
11. **Rescate de UI del Gestor:** Se rediseñaron las listas de partituras en `partiturasPanel.js` para lograr una UI verdaderamente compacta. Se implemento una nueva jerarquia visual con una estructura flexible (`display: flex`) separando la informacion del canto a la izquierda y las acciones agrupadas a la derecha (`gap: 15px`). El nombre del canto destaca (15px negrita), mientras que las etiquetas de categoria se muestran debajo en un tono gris sutil (12px). Las acciones secundarias ('Editar', 'Eliminar' y 'Quitar') fueron sustituidas por iconos vectoriales minimalistas en formato SVG que carecen de bordes y fondos por defecto, apareciendo solo al interactuar (hover). El boton de 'Promover' mantuvo un diseno pequeno con fondo dorado y texto blanco. Ademas, cada fila presenta ahora un separador inferior tenue que reacciona con un color de resalte unificado al pasar el raton en cualquier punto de su area.
12. **Optimizacion de Espacio Horizontal del Gestor:** Se mejoro el layout de `.item-fila` asegurando el uso del 100% del ancho del panel. Se agruparon el titulo y la categoria dentro de `.info-texto` (columna izquierda) y las herramientas dentro de `.acciones-derecha` (fila derecha). Se depuro exhaustivamente cualquier rastro de bordes o fondos heredados en los botones de accion SVG, mostrando fondos circulares translucidos unicamente durante la interaccion (:hover).
13. **Rescate Estetico del Gestor (Refinamiento Definitivo):** Se reestructuro el CSS de la clase `.item-fila` y dependencias en `gestor.css` forzando el comportamiento de bloques flexibles puros con !important para limpiar interferencias de estilos de navegadores. Se aplico un diseno limpio estilo tabla con la etiqueta `.info-texto` para el titulo y subtitulo a la izquierda, evitando colapsos con `overflow: hidden`, y `.acciones-derecha` para los controles a la derecha. Los botones SVG como Editar y Eliminar fueron normalizados para eliminar fondos grises, anadiendo estados 'hover' que proyectan sutiles bordes interactivos. El componente UI se alinea ahora a los estandares de interfaces modernas como Spotify o Notion.
14. **Rediseño de Tabla de Administracion de Usuarios:** Se implemento un diseno tipo Dashboard para la gestion de miembros en `miembrosPanel.js`. Las filas de la tabla ahora son independientes con espaciado vertical (`border-spacing`), poseen bordes redondeados y efectos de elevacion al interactuar. Se introdujeron badges de estado vibrantes (verde para 'ACTIVO', ambar para 'PENDIENTE') y botones de accion sutiles (`btn-revocar`) para mejorar la claridad operativa y la jerarquia visual del panel.
15. **Comunicacion Realtime y Sistema de Avisos (Fase 13):** Implementacion de un sistema de notificaciones en vivo basado en Supabase Realtime. Los directores pueden enviar "Recordatorios" globales y avisos de "Canto en Vivo" desde el gestor. Se garantizo que el filtrado sea estricto por `coro_id` (tratado como TEXT para maxima compatibilidad). En el frontend, se anadio un banner superior dinamico para ejecuciones en vivo y un historial de las ultimas 5 notificaciones dentro del panel de ajustes. Ademas, se rediseño el modal de gestion de partituras bajo una estetica minimalista y profesional.
16. **Refinamiento de UX, Gestos y Purga Visual (Fase 14):** Se profesionalizo la interfaz mediante la eliminacion total de emojis decorativos, sustituyendolos por iconos vectoriales minimalistas (SVG). Se implemento un sistema global de Toasts asincronos para sustituir los dialogos bloqueantes (`alert`). El banner de "Cantando Ahora" fue refinado con mayusculas tecnicas, un boton de cierre y soporte para el gesto tactile 'Swipe Up' para descartarlo. Ademas, se anadio inteligencia al gestor para detectar piezas duplicadas en el modal de otras sedes, evitando registros redundantes.
17. **Reparacion de Scope y Unificacion de Avisos Persistentes (Fase 14.5):** Se corrigio un error de referencia global de la funcion `mostrarToast` en el modulo del gestor. Se implemento un sistema de banners persistentes para "Recordatorios" con soporte para gestos tactiles 'Swipe Up'. Se eliminaron por completo los dialogos nativos `alert` y `confirm` en toda la administracion, sustituyendolos por un sistema de "Confirmacion Visual Instantanea" que requiere una doble validacion tactica. Tambien se completo una purga tecnica de emojis decorativos, utilizando exclusivamente iconos vectoriales minimalistas y mayusculas tecnicas para un acabado profesional.

## Guia de Estilos (Modo Oscuro/Claro)
Se utilizan variables CSS globales:
- `--color-superficie`: Fondo principal.
- `--color-texto-principal`: Color de fuente.
- `--color-acento`: Dorado (#D4AF37) para resaltar.
- `--color-borde`: Separadores.

## Proximos Pasos (Pendientes)
- Notificaciones en tiempo real para directores cuando alguien se registra.
- Flujo de recuperacion de contrasena (ya estructurado en `authApp.js`).