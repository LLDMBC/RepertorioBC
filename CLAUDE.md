\# CLAUDE.md - Contexto de Desarrollo para RepertorioBC
Resumen del Proyecto:
Aplicación web progresiva (PWA) de arquitectura multi-página (MPA) para la gestión y visualización de partituras de coros.

Stack Tecnológico: HTML5, Vanilla JavaScript (ESModules), CSS Variables (:root), Vite (Bundler), Supabase (Backend/Auth/DB). Ningún framework frontend (Cero React/Vue/Svelte).

Estructura de la Aplicación (MPA):
El proyecto se divide en 3 puntos de entrada principales aislados:

Visor Público (index.html + src/main.js): El repertorio público donde los miembros consumen los PDFs. Utiliza pdfEngine.js y offlineManager.js (PWA/Service Worker). No debe ser alterado durante refactorizaciones del backend.

Autenticación (auth.html + src/auth/authApp.js): Maneja login, registro y la lógica inicial de redirección basada en roles de usuario de Supabase.

Panel Administrativo (gestor.html + src/gestor/gestorApp.js): El núcleo administrativo, protegido por autenticación y roles.

Arquitectura del Gestor (src/gestor/):
El Gestor está modularizado para separar responsabilidades. gestorApp.js actúa como el orquestador central (Guardia de rutas y estado de sesión) y delega la interfaz a tres submódulos aislados:

partituras/partiturasPanel.js: CRUD completo de partituras (tabla cantos).

miembros/miembrosPanel.js: Gestión de solicitudes y miembros activos de un coro específico (tabla perfiles). Exclusivo para el rol director o superior.

admin/superPanel.js: Panel de control global. Gestión de sedes (tabla coros) y control maestro de roles de usuario. Exclusivo para el rol superadmin.

Modelo de Datos Principal (Supabase):

coros: id (text/slug), nombre (text).

perfiles: id (uuid, FK auth.users), nombre, email, rol ('miembro', 'director', 'superadmin'), coro_id (FK coros.id), estado ('pendiente', 'activo', 'rechazado').

cantos: id (uuid), coro_id (FK coros.id), nombre, archivo (url), temas (array de texto), fecha_agregado (date).

Reglas Estrictas de Refactorización:

Cero Hardcoding: Los temas, roles y coros deben extraerse siempre de la base de datos de Supabase. No usar listas estáticas en el HTML o JS.

Separación de Responsabilidades: La lógica de obtención de datos (Supabase) debe estar claramente separada de la lógica de renderizado del DOM (HTML strings).

Nomenclatura Fija: La columna de tiempo en partituras es fecha_agregado (no created_at). La columna de usuario es id (no user_id).

UI/UX: Mantener el uso estricto de las variables CSS globales de @main.css. Priorizar diseño Mobile-First y uso de Modales HTML/CSS puros para formularios, evitando window.prompt o alertas nativas intrusivas.