# 🎾 CanchaYa

Aplicación web para reservar canchas de pádel. Los jugadores se registran, ven la disponibilidad por cancha y día, reservan turnos de una hora y los cancelan. Un administrador gestiona las canchas y ve todas las reservas.

Proyecto final de Generación T. Tiene reglas de negocio reales (anti-duplicados, límites por jugador, plazos de cancelación, permisos por rol), no es solo un sitio web.

**Link público:** _pendiente de publicar_ (ver `docs/DEPLOY.md`)

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/RELEVAMIENTO.md`](docs/RELEVAMIENTO.md) | Relevamiento completo: problema, alcance, requerimientos, casos de uso, modelo de datos y riesgos |
| [`docs/MANUAL_DE_USUARIO.md`](docs/MANUAL_DE_USUARIO.md) | Manual para jugadores |
| [`docs/MANUAL_DEL_ADMINISTRADOR.md`](docs/MANUAL_DEL_ADMINISTRADOR.md) | Manual para el personal del club |
| [`docs/MANUAL_TECNICO.md`](docs/MANUAL_TECNICO.md) | Instalación, API, mantenimiento y resolución de problemas |
| [`docs/Documentacion_completa_CanchaYa.pdf`](docs/Documentacion_completa_CanchaYa.pdf) | Relevamiento y los tres manuales en un solo PDF, con capturas |
| [`docs/SPEC.md`](docs/SPEC.md) | Especificación con las reglas de negocio numeradas (RN-01 a RN-14) |
| [`docs/PLAN.md`](docs/PLAN.md) | Plan de tareas (una por commit) y checklist de entrega |
| [`docs/INFORME_DE_PRUEBAS.md`](docs/INFORME_DE_PRUEBAS.md) | Resultados de los tests y pruebas manuales |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Cómo publicar en Neon, Render y Netlify |
| [`AGENTS.md`](AGENTS.md) | Reglas para agentes de IA que trabajen en el repositorio |

## Arquitectura

```
frontend/ (HTML + CSS + JS, Netlify)
      │  HTTP / JSON
      ▼
src/http/          → rutas, CORS, límite de cuerpo (sin reglas de negocio)
src/services/      → reglas de negocio RN-01 a RN-14
src/repositories/  → memoria.js (desarrollo y tests) · postgres.js (producción, Neon)
src/lib/           → errores, tiempo (hora de Buenos Aires), contraseñas y tokens
```

- **Backend:** Node.js 22 sin framework. Única dependencia: `pg`.
- **Base de datos:** PostgreSQL. La regla anti-duplicados (RN-04) se garantiza también con un índice único parcial.
- **Seguridad:** contraseñas con scrypt, tokens firmados con HMAC que vencen a las 8 horas, consultas SQL con parámetros, límite de 100 KB por petición, secretos solo en variables de entorno.

## Cómo correrlo en local

Requisitos: Node 22 o superior.

```bash
npm install
cp .env.example .env     # completá TOKEN_SECRET (y opcionalmente el admin)
npm run dev              # backend en http://localhost:3000 (sin DATABASE_URL usa memoria)
```

Para el frontend, abrí `frontend/index.html` con un servidor estático (por ejemplo `npx serve frontend`) y dejá `frontend/config.js` apuntando a `http://localhost:3000`.

Si definís `DATABASE_URL` con una base PostgreSQL, el backend crea las tablas solo al iniciar.

## Tests

```bash
npm test
```

Ejecuta los tests automáticos (reglas de negocio, API de punta a punta y repositorios). No necesita base de datos.

También hay una prueba opcional en navegador real (`e2e/navegador.js`, ver `docs/MANUAL_TECNICO.md`).

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado del servicio (pública) |
| POST | `/api/auth/registro` | Crear cuenta (pública) |
| POST | `/api/auth/login` | Iniciar sesión (pública) |
| GET | `/api/me` | Usuario de la sesión |
| GET | `/api/canchas` | Listar canchas (jugador: solo activas) |
| POST | `/api/canchas` | Crear cancha (admin) |
| PATCH | `/api/canchas/:id` | Activar o desactivar (admin) |
| GET | `/api/canchas/:id/disponibilidad?fecha=AAAA-MM-DD` | Turnos libres, ocupados y pasados |
| POST | `/api/reservas` | Crear reserva |
| GET | `/api/reservas/mias` | Mis reservas |
| GET | `/api/reservas` | Todas las reservas (admin) |
| POST | `/api/reservas/:id/cancelar` | Cancelar una reserva |

Los errores responden `{ "error": { "codigo", "mensaje", "regla" } }`, donde `regla` es el número de la spec (por ejemplo `RN-07`).
