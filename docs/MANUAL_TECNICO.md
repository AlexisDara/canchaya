# Manual técnico — CanchaYa

Para quien tenga que instalar, publicar, mantener o modificar el sistema.

## 1. Requisitos

| Componente | Requisito |
|---|---|
| Node.js | Versión 22 o superior (el proyecto usa `node --test` con patrones y `--env-file`) |
| npm | El que trae Node |
| Base de datos | PostgreSQL (en producción, Neon). Para desarrollo no hace falta |
| Navegador | Cualquiera actual, para el frontend |
| Git | Para clonar y publicar |

## 2. Estructura del repositorio

```
canchaya/
├── src/
│   ├── index.js            Arranque: lee variables de entorno, elige repositorio, crea admin y canchas iniciales
│   ├── http/app.js         Rutas, CORS, límite de cuerpo, manejo de errores
│   ├── services/           Reglas de negocio: auth.js, canchas.js, reservas.js
│   ├── repositories/       memoria.js (desarrollo y tests) y postgres.js (producción)
│   └── lib/                errores.js, tiempo.js, seguridad.js
├── db/schema.sql           Esquema de la base de datos (idempotente)
├── frontend/               index.html, styles.css, app.js, config.js
├── tests/                  Tests automáticos
├── docs/                   Documentación
├── AGENTS.md               Reglas para agentes de IA
├── netlify.toml            Publica la carpeta frontend en Netlify
└── .env.example            Plantilla de variables de entorno (sin valores secretos)
```

Principio de diseño: las reglas de negocio viven **solo** en `src/services/`. El frontend muestra lo que el backend decide.

## 3. Instalación y ejecución local

```bash
git clone <URL-del-repositorio>
cd canchaya
npm install
cp .env.example .env        # editar y completar TOKEN_SECRET
npm run dev                 # http://localhost:3000
```

- Sin `DATABASE_URL`, el backend usa una base **en memoria**: es cómoda para probar pero se borra al reiniciar.
- Con `DATABASE_URL` apuntando a una base PostgreSQL, crea las tablas solas al arrancar.
- Para el frontend, servir la carpeta `frontend/` con cualquier servidor estático (por ejemplo `npx serve frontend`) y dejar `frontend/config.js` apuntando a `http://localhost:3000`.

Generar un `TOKEN_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 4. Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `PORT` | No | Puerto del servidor (3000 por defecto; Render lo define solo) |
| `NODE_ENV` | En producción | Con `production`, el arranque falla si faltan `TOKEN_SECRET` o `DATABASE_URL` |
| `DATABASE_URL` | En producción | Cadena de conexión de PostgreSQL |
| `TOKEN_SECRET` | En producción | Clave para firmar los tokens. Larga y aleatoria |
| `CORS_ORIGIN` | Recomendada | URL del frontend permitida (por defecto `*`) |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Para crear el admin | Si están `ADMIN_EMAIL` y `ADMIN_PASSWORD`, se crea ese administrador al arrancar si no existe |
| `PGSSL` | No | Con el valor `disable` se desactiva SSL hacia la base (solo para bases locales) |

Los valores reales **nunca** se suben al repositorio: van en `.env` (ignorado por git) o en las variables del proveedor.

## 5. Base de datos

El esquema está en `db/schema.sql` y se aplica automáticamente al iniciar (usa `CREATE ... IF NOT EXISTS`). Ver el diagrama en `RELEVAMIENTO.md`, sección 9.

Tablas: `usuarios`, `canchas` y `reservas`. La restricción más importante es el índice único parcial `reservas_turno_activo_unico` sobre `(cancha_id, fecha, hora)` donde `estado = 'activa'`: impide dos reservas activas en el mismo turno aunque dos pedidos lleguen a la vez (RN-04).

## 6. Referencia de la API

URL base: la del backend (por ejemplo `http://localhost:3000`). Todo es JSON. Excepto `health`, `registro` y `login`, hay que enviar el encabezado `Authorization: Bearer <token>`.

| Método | Ruta | Acceso | Cuerpo | Respuesta |
|---|---|---|---|---|
| GET | `/api/health` | Pública | — | 200 `{"estado":"ok"}` |
| POST | `/api/auth/registro` | Pública | `nombre`, `email`, `password` | 201 usuario |
| POST | `/api/auth/login` | Pública | `email`, `password` | 200 `{token, usuario}` |
| GET | `/api/me` | Sesión | — | 200 usuario |
| GET | `/api/canchas` | Sesión | — | 200 lista (jugador: solo activas) |
| POST | `/api/canchas` | Admin | `nombre` | 201 cancha |
| PATCH | `/api/canchas/:id` | Admin | `activa` (booleano) | 200 cancha |
| GET | `/api/canchas/:id/disponibilidad?fecha=AAAA-MM-DD` | Sesión | — | 200 turnos |
| POST | `/api/reservas` | Sesión | `canchaId`, `fecha`, `hora` | 201 reserva |
| GET | `/api/reservas/mias` | Sesión | — | 200 lista |
| GET | `/api/reservas` | Admin | — | 200 lista |
| POST | `/api/reservas/:id/cancelar` | Sesión | — | 200 reserva cancelada |

### Ejemplos reales

Las siguientes respuestas se obtuvieron ejecutando el backend localmente.

**Registro**
```bash
curl -X POST http://localhost:3000/api/auth/registro \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Ana Pérez","email":"ana@mail.com","password":"clave-segura-1"}'
```
```json
{"id":2,"nombre":"Ana Pérez","email":"ana@mail.com","rol":"jugador"}
```

**Login** (devuelve el token que se usa en las demás peticiones)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ana@mail.com","password":"clave-segura-1"}'
```
```json
{"token":"eyJzdWIiOjIs...","usuario":{"id":2,"nombre":"Ana Pérez","email":"ana@mail.com","rol":"jugador"}}
```

**Listar canchas**
```bash
curl http://localhost:3000/api/canchas -H "Authorization: Bearer $TOKEN"
```
```json
[{"id":1,"nombre":"Cancha 1","activa":true},{"id":2,"nombre":"Cancha 2","activa":true},{"id":3,"nombre":"Cancha 3","activa":true}]
```

**Disponibilidad** (la respuesta completa trae los 14 turnos, de 9 a 22)
```bash
curl "http://localhost:3000/api/canchas/1/disponibilidad?fecha=2026-11-13" -H "Authorization: Bearer $TOKEN"
```
```json
{"canchaId":1,"fecha":"2026-11-13","activa":true,"turnos":[{"hora":9,"estado":"libre"},{"hora":10,"estado":"libre"}, "..."]}
```

**Reservar**
```bash
curl -X POST http://localhost:3000/api/reservas \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"canchaId":1,"fecha":"2026-11-13","hora":18}'
```
```json
{"id":1,"usuarioId":2,"canchaId":1,"fecha":"2026-11-13","hora":18,"estado":"activa","creadaEn":"2026-11-12T20:03:09.681Z"}
```

**Mis reservas** (agrega el nombre de la cancha, el instante de inicio y si todavía se puede cancelar)
```json
[{"id":1,"usuarioId":2,"canchaId":1,"fecha":"2026-11-13","hora":18,"estado":"activa","creadaEn":"2026-11-12T20:03:09.681Z","canchaNombre":"Cancha 1","inicio":"2026-11-13T21:00:00.000Z","puedeCancelar":true}]
```

**Cancelar**
```bash
curl -X POST http://localhost:3000/api/reservas/1/cancelar -H "Authorization: Bearer $TOKEN"
```
Devuelve la reserva con `"estado":"cancelada"` y `"puedeCancelar":false`.

### Formato de errores

```json
{"error":{"codigo":"CONFLICTO","mensaje":"Ya tenés otra reserva en ese mismo horario","regla":"RN-08"}}
```

| Estado | Código | Cuándo |
|---|---|---|
| 400 | `VALIDACION` | Datos inválidos, JSON mal formado, id de URL inválido |
| 401 | `NO_AUTENTICADO` | Falta el token, es inválido o venció; login incorrecto |
| 403 | `PROHIBIDO` | El usuario no tiene permiso (por ejemplo, un jugador en una ruta de admin) |
| 404 | `NO_ENCONTRADO` | La cancha, la reserva o la ruta no existen |
| 405 | `METODO_NO_PERMITIDO` | Método HTTP incorrecto para esa ruta |
| 409 | `CONFLICTO` | Turno ocupado (RN-04), horario repetido (RN-08), email repetido (RN-01), reserva ya cancelada (RN-11) |
| 413 | `CUERPO_GRANDE` | El cuerpo supera los 100 KB |
| 422 | `REGLA_DE_NEGOCIO` | Se viola una regla: turno pasado (RN-05), más de 14 días (RN-06), 3 reservas (RN-07), cancelación tardía (RN-09), cancha desactivada (RN-12) |
| 500 | `ERROR_INTERNO` | Error inesperado; el detalle queda en el log del servidor |

El campo `regla` apunta al número de `docs/SPEC.md`.

## 7. Tests

```bash
npm test
```

53 tests automáticos con el ejecutor de Node, sin dependencias ni base de datos. Los de API levantan un servidor real en un puerto libre. Detalle y cobertura por regla en `INFORME_DE_PRUEBAS.md`.

### Pruebas en navegador (opcionales)

El script `e2e/navegador.js` abre un Chromium real, recorre la aplicación como lo haría un usuario (registro, reservas, cancelaciones, administración, pantalla de celular) y guarda capturas en `docs/capturas/`. No forma parte de `npm test` porque necesita Playwright.

```bash
# Terminal 1: backend recién iniciado (la base en memoria debe estar vacía)
ADMIN_EMAIL=admin@club.com ADMIN_PASSWORD=admin-clave-123 PORT=3000 node src/index.js
# Terminal 2: instalar Playwright una vez y ejecutar
npm install --no-save playwright && npx playwright install chromium
node e2e/navegador.js
```

Lo que las pruebas automáticas **no** cubren: la validez del SQL contra PostgreSQL real y el sistema ya publicado. Esas pruebas se hacen a mano siguiendo la tabla del informe.

## 8. Despliegue

El procedimiento paso a paso (Neon, Render y Netlify) está en [`DEPLOY.md`](DEPLOY.md). Resumen:

1. Crear la base en Neon y copiar la cadena de conexión.
2. Crear un Web Service en Render con `npm install` y `npm start`, y cargar las variables de entorno.
3. Poner la URL del backend en `frontend/config.js`, hacer push y publicar en Netlify.
4. Cambiar `CORS_ORIGIN` por la URL exacta de Netlify.

## 9. Mantenimiento

### 9.1 Cambiar un valor de una regla
Los límites están como constantes al inicio de `src/services/reservas.js` (`MAX_RESERVAS_ACTIVAS_FUTURAS`, `MAX_DIAS_ANTICIPACION`, `HORAS_MINIMAS_PARA_CANCELAR`) y las horas de turno en `src/lib/tiempo.js`. Pasos: 1) actualizar `docs/SPEC.md`; 2) actualizar los tests; 3) cambiar la constante; 4) correr `npm test`. Si se cambian las horas de turno, hay que actualizar también la restricción `CHECK` de `reservas.hora` en `db/schema.sql` (en una base ya creada, requiere una migración manual) y el texto de la ayuda del frontend.

### 9.2 Agregar una regla nueva
Seguir `AGENTS.md`: primero la regla numerada en la spec, luego un test que la cite, después el código en la capa de servicios y un commit con la tarea.

### 9.3 Rotar `TOKEN_SECRET`
Cambiar el valor en las variables de entorno y reiniciar. Todas las sesiones abiertas dejan de ser válidas y cada usuario tiene que volver a ingresar.

### 9.4 Respaldos
La base está en Neon. Hacer exportaciones periódicas (por ejemplo con `pg_dump`) y verificar los respaldos que ofrezca el plan contratado. El plan gratuito tiene opciones de restauración limitadas.

### 9.5 Cambiar la contraseña de un usuario o darle rol de administrador
No hay pantalla para esto. Se hace con acceso a la base:

```bash
node -e "console.log(require('./src/lib/seguridad').hashPassword('NUEVA-CLAVE'))"
```
```sql
UPDATE usuarios SET password_hash = '<hash generado>' WHERE email = 'persona@mail.com';
UPDATE usuarios SET rol = 'admin' WHERE email = 'persona@mail.com';
```

### 9.6 Logs
El servidor escribe en la salida estándar (en Render, pestaña Logs). Los errores inesperados se registran como "Error inesperado:" con el detalle; el usuario solo ve un mensaje genérico.

## 10. Resolución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| El frontend muestra "No se pudo conectar con el servidor" | La URL de `frontend/config.js` es incorrecta, o el backend está dormido (plan gratuito de Render) | Verificar la URL, abrir `/api/health` en el navegador y esperar hasta un minuto |
| Error de CORS en la consola del navegador | `CORS_ORIGIN` no coincide exactamente con la URL del frontend | Poner la URL exacta, con `https://` y sin barra final, y redeploy |
| El backend no inicia: "Falta la variable de entorno ..." | Con `NODE_ENV=production` faltan `TOKEN_SECRET` o `DATABASE_URL` | Cargarlas en el proveedor |
| Error de conexión o SSL a la base | Cadena de conexión incorrecta | Copiarla de nuevo desde Neon (debe incluir `sslmode=require`) |
| Todos los usuarios quedan deslogueados tras un redeploy | Cambió `TOKEN_SECRET` | Es esperable; ingresar de nuevo. Mantener el mismo valor entre despliegues |
| No existe el usuario administrador | Faltan `ADMIN_EMAIL` o `ADMIN_PASSWORD`, o ese email ya estaba registrado como jugador (en ese caso no se crea otro) | Cargar las variables con un email nuevo, o ascender al usuario con el SQL de la sección 9.5 |
| `npm test` falla con errores de sintaxis o de opciones | Versión de Node anterior a la 22 | Actualizar Node |
| La reserva "no aparece" a la hora esperada | Confusión de zona horaria | El sistema usa siempre hora de Buenos Aires (UTC-3). El campo `inicio` de la API está en UTC |

## 11. Seguridad: resumen de controles

| Control | Implementación |
|---|---|
| Contraseñas | scrypt con sal aleatoria de 16 bytes; comparación en tiempo constante |
| Sesiones | Token con firma HMAC-SHA256, vence a las 8 h; se rechazan tokens manipulados |
| Autorización | Se valida en cada operación de la capa de servicios, no en el frontend |
| Inyección SQL | Consultas parametrizadas en todo el repositorio PostgreSQL (hay un test que lo verifica) |
| XSS | El frontend inserta datos como texto, nunca como HTML |
| Abuso | Límite de 100 KB por petición |
| Secretos | Solo en variables de entorno; `.env` está en `.gitignore` |
| Concurrencia | Índice único parcial en la base para RN-04 |

Limitaciones conocidas (sin límite de intentos de login, token en `localStorage`, `CORS_ORIGIN=*` por defecto) están detalladas en `RELEVAMIENTO.md`, sección 12.
