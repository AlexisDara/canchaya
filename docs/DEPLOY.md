# Guía de despliegue

Orden: base de datos (Neon) → backend (Render) → frontend (Netlify) → ajustar CORS.

## 1. Base de datos en Neon (T13)

1. Crear una cuenta en neon.tech y un proyecto nuevo.
2. Copiar la cadena de conexión (`postgresql://usuario:clave@host/neondb?sslmode=require`). Usá la conexión **directa** (en el panel de Neon, con la opción "Pooled connection" desactivada). Es un secreto: no se sube al repositorio.
3. No hace falta cargar el esquema a mano: el backend ejecuta `db/schema.sql` al iniciar (es idempotente).

## 2. Backend en Render (T14)

**Opción rápida:** el repositorio incluye `render.yaml`. En Render: New → Blueprint → elegir el repositorio. Render crea el servicio con la configuración de abajo, genera `TOKEN_SECRET` solo y te pide `DATABASE_URL`, `CORS_ORIGIN`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`. (Este archivo no pudo probarse contra Render; si algo no coincide, usá la configuración manual.)

**Configuración manual:**

1. En Render: New → Web Service → conectar este repositorio de GitHub.
2. Configuración:
   - Runtime: Node. Build Command: `npm install`. Start Command: `npm start`.
   - Plan gratuito. Nota: el plan gratuito "duerme" tras un rato sin uso y la primera petición puede tardar unos 30 a 60 segundos.
3. Variables de entorno (pestaña Environment):

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `22` |
| `DATABASE_URL` | la cadena de Neon |
| `TOKEN_SECRET` | una cadena larga y aleatoria (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `ADMIN_NAME` | nombre del administrador |
| `ADMIN_EMAIL` | email del administrador |
| `ADMIN_PASSWORD` | contraseña del administrador (mínimo 8 caracteres) |
| `CORS_ORIGIN` | `*` por ahora; después, la URL de Netlify |

4. Verificar: abrir `https://TU-BACKEND.onrender.com/api/health` y comprobar que responde `{"estado":"ok"}`.

## 3. Frontend en Netlify (T15)

1. Editar `frontend/config.js` y poner la URL del backend de Render (sin barra final):
   `window.CANCHAYA_API_URL = "https://TU-BACKEND.onrender.com";`
2. Hacer commit y push.
3. En Netlify: Add new site → Import an existing project → elegir el repositorio. El archivo `netlify.toml` ya indica que se publica la carpeta `frontend` (no hay build).
4. Abrir la URL que da Netlify y comprobar que carga la pantalla de acceso.

## 4. Ajustar CORS

En Render, cambiar `CORS_ORIGIN` por la URL exacta de Netlify (por ejemplo `https://canchaya.netlify.app`, sin barra final) y esperar a que se redeploye.

## 5. Probar

Seguir la tabla de pruebas manuales de `docs/INFORME_DE_PRUEBAS.md` y completarla. Después, marcar T13 a T16 como hechas en `docs/PLAN.md` y poner el link público en el README.
