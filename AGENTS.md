# AGENTS.md — Reglas para agentes de IA en este repositorio

Este archivo vale para cualquier agente (Claude Code, Cursor, Copilot, etc.) que modifique el proyecto.

## Antes de tocar código
1. Leé `docs/SPEC.md`. Las reglas de negocio (RN-xx) son la fuente de verdad.
2. Leé `docs/PLAN.md` y trabajá **una tarea por vez**, en orden.
3. Si una regla no está en la spec, no la inventes: proponé agregarla a la spec primero.

## Arquitectura (no cambiar sin pedir permiso)
- `src/http/`: recibe peticiones y arma respuestas. No contiene reglas de negocio.
- `src/services/`: reglas de negocio y validaciones. Es el único lugar donde viven las RN-xx.
- `src/repositories/`: acceso a datos. `memoria.js` (desarrollo y tests) y `postgres.js` (producción) deben tener la misma interfaz.
- `src/lib/`: utilidades puras (tiempo, contraseñas, tokens, errores).
- `frontend/`: HTML, CSS y JavaScript sin build. No debe duplicar reglas de negocio: el backend siempre decide.

## Reglas de código
- Node 22, sin frameworks. La única dependencia externa permitida es `pg`. No agregues otras sin justificarlo en el PR.
- Las consultas SQL siempre con parámetros (`$1`, `$2`). Nunca concatenar datos del usuario en el SQL.
- Los errores de negocio se lanzan con las funciones de `src/lib/errores.js` e incluyen el número de regla.
- Los servicios reciben la hora actual por parámetro (`ahora`). Nunca llamar a `Date.now()` dentro de las reglas, para poder testear.
- Las fechas y horas se interpretan en hora de Buenos Aires con `src/lib/tiempo.js`. No usar métodos UTC sueltos para decidir qué día es.

## Secretos
- Nunca escribas contraseñas, tokens, `DATABASE_URL` ni claves en el código ni en archivos versionados.
- Los valores reales van en `.env` (ignorado por git) o en las variables de entorno del proveedor. `.env.example` solo lleva nombres y valores de ejemplo vacíos.

## Tests y commits
- `npm test` debe pasar completo antes de cada commit.
- Cada regla nueva o modificada lleva al menos un test que cite su número (por ejemplo `RN-07`).
- Un commit por tarea del plan, con el formato `Txx: descripción corta`.
- Al terminar una tarea, marcala como hecha (`[x]`) en `docs/PLAN.md` en el mismo commit.

## Qué no hacer
- No cambiar reglas de la spec para que un test pase.
- No desactivar ni borrar tests que fallan.
- No marcar como hecha una tarea que no se verificó.
