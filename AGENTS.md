# AGENTS.md

Reglas para cualquier agente de IA (Cursor, Claude Code, Copilot, etc.) que trabaje en este repositorio.

## Project

CanchaYa: aplicación web para reservar canchas de pádel. Backend en Node.js 22 sin frameworks, base PostgreSQL y frontend en HTML, CSS y JavaScript sin build.
Las reglas de negocio están numeradas (RN-01 a RN-14) en `docs/SPEC.md`, que es la fuente de verdad. El plan de tareas está en `docs/PLAN.md`.

## Commands

- `npm install` — instala las dependencias (solo `pg`).
- `npm run dev` — inicia el backend en desarrollo (lee `.env`; sin `DATABASE_URL` usa una base en memoria).
- `npm start` — inicia el backend (producción).
- `npm test` — corre todos los tests automáticos. Debe pasar completo antes de cada commit.

## Architecture (no cambiar sin consultar)

- `src/http/` — recibe peticiones y arma respuestas. No contiene reglas de negocio.
- `src/services/` — reglas de negocio y validaciones. Es el único lugar donde viven las RN-xx.
- `src/repositories/` — acceso a datos: `memoria.js` (desarrollo y tests) y `postgres.js` (producción). Deben tener la misma interfaz.
- `src/lib/` — utilidades puras: errores, tiempo, contraseñas y tokens.
- `frontend/` — HTML, CSS y JavaScript sin build. No duplica reglas de negocio: el backend siempre decide.

## Code Style

- Nombres claros y descriptivos, en español como el resto del proyecto.
- Funciones pequeñas con una única responsabilidad. Evitar código repetido (DRY) y no anticipar lo que no se pidió (YAGNI).
- Las consultas SQL siempre con parámetros (`$1`, `$2`). Nunca concatenar datos del usuario en el SQL.
- Los errores de negocio se lanzan con las funciones de `src/lib/errores.js` e incluyen el número de regla.
- Los servicios reciben la hora actual por parámetro (`ahora`). No llamar a `Date.now()` dentro de las reglas, para poder testearlas.
- Las fechas y horas se interpretan en hora de Buenos Aires con `src/lib/tiempo.js`. No usar métodos UTC sueltos para decidir qué día es.
- En el frontend, los datos del usuario se insertan como texto (nunca como HTML).

## Agent Behavior

El agente puede:
- Leer `docs/SPEC.md` y `docs/PLAN.md` antes de empezar, y trabajar una tarea por vez, en orden.
- Crear y modificar código dentro de la arquitectura descripta, y escribir tests.
- Corregir errores y explicar los cambios realizados.
- Ejecutar `npm test` para comprobar que todo funciona.
- Invocar al subagente `revisor` (`.cursor/agents/revisor.md`, solo lectura) antes de subir cambios que toquen endpoints, acceso a datos o configuración.

Cada regla nueva o modificada lleva al menos un test que cite su número (por ejemplo `RN-07`). Primero se actualiza la spec, después el test y por último el código.

## What the Agent Must NOT Do Without Permission

- Inventar reglas que no estén en la spec: si falta una, proponer agregarla a la spec primero.
- Cambiar una regla de la spec para que un test pase, o desactivar o borrar tests que fallan.
- Instalar dependencias nuevas (la única permitida es `pg`).
- Cambiar la estructura de carpetas ni la arquitectura en capas.
- Eliminar archivos o funcionalidades existentes.
- Modificar configuraciones importantes (`render.yaml`, `netlify.toml`, `db/schema.sql`, workflows).
- Realizar cambios grandes que no hayan sido solicitados.
- Marcar como hecha una tarea del plan que no se verificó.

## Secrets

- Nunca escribir contraseñas, tokens, `DATABASE_URL` ni claves en el código ni en archivos versionados.
- Los valores reales van en `.env` (ignorado por git) o en las variables de entorno del proveedor. `.env.example` solo lleva nombres con valores vacíos.

## Commits

- Un commit por tarea del plan, con el formato `Txx: descripción corta`.
- Al terminar una tarea, marcarla como hecha (`[x]`) en `docs/PLAN.md` en el mismo commit.
