\# 📘 REPERTORIO BC - Contexto del Proyecto y Hoja de Ruta



\## 1. Contexto Actual del Proyecto

\*\*Descripción:\*\* Aplicación web PWA para la gestión y visualización offline de partituras para coros. Cuenta con un sistema de roles, separación estricta por sedes locales y repertorio estatal o por eventos.

\*\*Stack Tecnológico:\*\*

\* \*\*Frontend:\*\* HTML, CSS, JavaScript (Vanilla, arquitectura modular ES6).

\* \*\*Backend \& BD:\*\* Supabase (PostgreSQL, Auth, Storage).

\* \*\*Herramientas:\*\* Vite (Bundler), Service Workers (Modo Offline / Caché).



\*\*Arquitectura de Datos Principal:\*\*

\* `perfiles`: Usuarios con roles (`miembro`, `director`, `superadmin`), `coro\_id` (sede local), `estado` (activo/pendiente), `conciertos\_asignados` (array).

\* `cantos`: Tabla maestra de partituras (ID, nombre, archivo, temas).

\* `cantos\_coros`: Tabla intermedia (Muchos a Muchos) que vincula un canto específico con un coro (`coro\_id`).

\* \*\*Storage:\*\* Bucket `partituras` alojando los PDFs (nombrados con timestamp para evitar caché agresiva).



\---



\## 2. 🚀 Lista de Tareas Pendientes (TODOs)



\### Seguridad y Autenticación

\- \[ ] \*\*Restablecimiento de Contraseña:\*\* Flujo completo (forgot-password, reset-password) usando Supabase Auth.

\- \[ ] \*\*Protección contra Bots:\*\* Implementar medidas antispam en el registro y login (rate-limiting o validación).

\- \[ ] \*\*Corrección en Registro:\*\* Eliminar "Estatal" como una opción seleccionable en el dropdown de sedes, ya que todo usuario pertenece a una sede local obligatoriamente.



\### Experiencia de Usuario (UI/UX)

\- \[ ] \*\*Panel de Ajustes:\*\* Desarrollar el menú modal de configuración.

\- \[ ] \*\*Acceso Rápido al Gestor:\*\* Botón dinámico en el menú lateral que solo aparezca para Directores y Superadmins, llevándolos directo a la vista de administración.



\### Gestión Avanzada (Superadmins y Directores)

\- \[ ] \*\*Notificaciones de Nuevos Miembros:\*\* Panel o aviso en tiempo real a los directores locales cuando un miembro de su sede se registre y esté "pendiente".

\- \[ ] \*\*Gestor de Partituras Intuitivo:\*\* Mejorar la UI de administración para que sea fácil editar, buscar y organizar cantos.

\- \[ ] \*\*Promoción de Cantos (Sin SQL):\*\* Botón mágico para Superadmins que permita tomar cualquier canto de un repertorio local y "Promoverlo al Estatal" directamente desde la interfaz.

\- \[ ] \*\*Historial de Cantos:\*\* Registro visual de qué cantos se han agregado, quién los subió y cuándo.



\### Sincronización en Tiempo Real (Supabase Realtime)

\- \[ ] \*\*Reactividad Total:\*\* Configurar suscripciones de Supabase para que la UI se actualice automáticamente (sin recargar) cuando:

&#x20; - Un nuevo usuario se registra.

&#x20; - Un director aprueba a un miembro (el miembro entra automáticamente si estaba esperando).

&#x20; - Se agrega o elimina un canto de la base de datos.



\---



\## 3. 🎯 Prompts Precisos para la Siguiente Fase

\*Guarda este archivo. Cuando estés listo para programar, copia y pega estos prompts en el chat uno por uno. Están diseñados para avanzar de forma segura.\*



\### Fase 1: Tiempo Real y Botón del Gestor

> \*\*Prompt:\*\* "Gemini, vamos a implementar Supabase Realtime en `main.js`. Quiero que si se agrega o elimina un canto en la base de datos, la lista en la pantalla principal se actualice sola sin tener que recargar. Además, inyecta un botón en el menú lateral que diga 'Administración' y que SOLO le aparezca a los perfiles que sean `director` o `superadmin`, el cual los lleve a `gestor.html`."



\### Fase 2: Promoción al Estatal e Historial (Gestor)

> \*\*Prompt:\*\* "Gemini, vamos a mejorar `partiturasPanel.js`. Necesito que la tabla de administración sea más intuitiva. Además, agrega una función exclusiva para el `superadmin`: un botón en cada canto que diga 'Promover al Estatal'. Al darle clic, debe insertar la relación en la tabla `cantos\_coros` con el id 'estatal' sin que yo use SQL manual. También prepara la lógica para mostrar un 'Historial de Cantos Agregados'."



\### Fase 3: Tiempo real en Usuarios y Notificaciones

> \*\*Prompt:\*\* "Gemini, vamos a conectar el Gestor de Usuarios con Supabase Realtime. Quiero que cuando un miembro nuevo se registre, le aparezca instantáneamente al Director en su pantalla. Y si el Director le da a 'Aprobar', que la pantalla del miembro pendiente detecte el cambio en tiempo real y lo deje entrar al repertorio automáticamente."



\### Fase 4: Seguridad, Registro y Contraseña

> \*\*Prompt:\*\* "Gemini, vamos a arreglar `auth.html` y `auth.js`. Primero, elimina 'Estatal' de las opciones de sede en el registro. Segundo, implementa protección contra bots básica. Tercero, añade el flujo y los modales para 'Olvidé mi contraseña' (reset password) usando la API de Supabase Auth."



\### Fase 5: Panel de Ajustes

> \*\*Prompt:\*\* "Gemini, desarrollemos la funcionalidad del botón 'Ajustes de la App' en `main.js`. Quiero que abra un modal sobre la interfaz donde el usuario pueda cambiar opciones, leer el 'Acerca de' y ver su información."



