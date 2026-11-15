# Informe de pruebas — CanchaYa

## 1. Resumen

| Tipo de prueba | Estado |
|---|---|
| Tests automáticos (reglas, API de punta a punta, repositorios) | **51 de 51 pasan** (ejecutados con `npm test`) |
| Pruebas manuales sobre el sistema desplegado en internet | **Pendientes** (sección 4; se completan al terminar T16) |
| Frontend en un navegador real | **Pendiente** (sección 4) |
| SQL contra una base PostgreSQL real (Neon) | **Pendiente** (sección 4) |

Qué se probó automáticamente: todas las reglas de negocio (RN-01 a RN-14), las rutas HTTP con un servidor real y el manejo de errores. Qué **no** cubren los tests automáticos: que el SQL de `db/schema.sql` y de `src/repositories/postgres.js` sea válido en PostgreSQL, y que el frontend funcione en un navegador. Por eso esas pruebas se hacen a mano sobre el despliegue.

## 2. Cómo se ejecutaron

- Comando: `npm test` (Node 22, ejecutor de tests incluido en Node; no requiere instalar nada).
- Los tests usan un repositorio en memoria y una hora fija (martes 10/11/2026, 15:00 en Buenos Aires), de modo que los resultados no dependen del día en que se corran.
- Las pruebas de API levantan un servidor HTTP real en un puerto libre y le hacen peticiones con `fetch`.

## 3. Resultado de la ejecución automática

```
✔ RN-02: las rutas protegidas devuelven 401 sin token o con token inválido; health es pública
✔ flujo completo: registro, login, ver canchas, reservar, ver mis reservas y cancelar
✔ RN-04: el segundo jugador recibe 409 con el número de regla
✔ RN-04: dos pedidos simultáneos al mismo turno: uno solo gana
✔ RN-10: otro jugador recibe 403 al cancelar una reserva ajena
✔ RN-12 y RN-14: las rutas de administración devuelven 403 a un jugador y funcionan para el admin
✔ validaciones HTTP: JSON inválido, id inválido, ruta inexistente y método no permitido
✔ el cuerpo de más de 100 KB se rechaza con 413
✔ las respuestas no exponen el hash de la contraseña
✔ RN-01: registra un usuario, normaliza el email y no expone la contraseña
✔ RN-01: rechaza nombre corto, email inválido y contraseña corta
✔ RN-01: el email es único sin distinguir mayúsculas
✔ RN-02: login correcto devuelve un token que autentica al usuario
✔ RN-02: login incorrecto da el mismo mensaje con email inexistente o contraseña errónea
✔ RN-02: el token vence a las 8 horas
✔ RN-02: un token manipulado o inventado se rechaza
✔ RN-09: se puede cancelar con 2 horas o más de anticipación
✔ RN-09: con menos de 2 horas ya no se puede cancelar
✔ RN-10: otro jugador no puede cancelar; el admin sí
✔ RN-11: cancelar libera el turno para otro jugador
✔ RN-11: no se puede cancelar dos veces; una reserva inexistente da 404
✔ RN-14: el jugador ve solo sus reservas; el admin ve todas; el jugador no puede pedir todas
✔ RN-14: las reservas se devuelven ordenadas por fecha y hora
✔ RN-12: un admin crea canchas y un jugador no puede
✔ RN-12: una cancha desactivada no aparece para los jugadores pero sí para el admin
✔ RN-12: solo el admin cambia el estado y el valor debe ser booleano
✔ RN-13: la disponibilidad marca los turnos como libre, ocupado o pasado
✔ RN-13: valida la fecha y que la cancha exista
✔ RN-04: el repositorio no deja crear dos reservas activas en el mismo turno
✔ RN-11: una reserva cancelada libera el turno
✔ los datos devueltos son copias: modificarlos no altera el repositorio
✔ RN-04: la violación del índice único (23505) se traduce a conflicto 409
✔ otros errores de la base no se disfrazan de conflicto
✔ los datos del usuario viajan como parámetros y nunca dentro del texto SQL
✔ creadaEn se devuelve como texto ISO
✔ reserva válida: queda activa y a nombre del jugador
✔ RN-03: rechaza horas fuera del rango o no enteras
✔ validación: fecha inválida o cancha inexistente
✔ RN-04: el mismo turno en la misma cancha no se puede reservar dos veces
✔ RN-04: el mismo horario en otra cancha sí se puede reservar
✔ RN-05: no se reserva un turno que ya empezó ni uno pasado
✔ RN-06: hasta 14 días de anticipación sí; 15 días no
✔ RN-07: máximo 3 reservas activas futuras por jugador
✔ RN-07: las reservas canceladas o ya jugadas no cuentan para el límite
✔ RN-08: un jugador no puede reservar el mismo horario en dos canchas
✔ RN-12: no se puede reservar en una cancha desactivada
✔ RN-03: acepta horas enteras de 9 a 22 y rechaza el resto
✔ parsearFecha acepta días reales y rechaza formatos o fechas inexistentes
✔ inicioDelTurno convierte la hora de Buenos Aires (UTC-3) a un instante exacto
✔ fechaLocal: a las 22:00 de Buenos Aires sigue siendo el mismo día (no salta al siguiente por UTC)
✔ RN-06: diasDesdeHoy cuenta días calendario en hora de Buenos Aires
ℹ tests 51
ℹ suites 0
ℹ pass 51
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

### Cobertura de reglas de negocio

Cada regla de `docs/SPEC.md` tiene al menos un test que la cita por su número:

| Regla | Qué verifica | Archivos de test |
|---|---|---|
| RN-01 | Registro: validaciones, email único sin distinguir mayúsculas, contraseña no expuesta | `auth.test.js`, `api.test.js` |
| RN-02 | Login, vencimiento del token a las 8 h, tokens manipulados, 401 sin sesión | `auth.test.js`, `api.test.js` |
| RN-03 | Horas válidas de 9 a 22 | `reservar.test.js`, `tiempo.test.js` |
| RN-04 | Sin turnos duplicados, incluso con dos pedidos simultáneos | `reservar.test.js`, `repositorio-memoria.test.js`, `repositorio-postgres.test.js`, `api.test.js` |
| RN-05 | No reservar turnos que ya empezaron | `reservar.test.js` |
| RN-06 | Límite de 14 días (el 14 sí, el 15 no) | `reservar.test.js`, `tiempo.test.js` |
| RN-07 | Máximo de 3 reservas activas futuras; las canceladas y pasadas no cuentan | `reservar.test.js` |
| RN-08 | Sin dos reservas del mismo jugador en el mismo horario | `reservar.test.js` |
| RN-09 | Cancelación hasta 2 h antes (límite exacto incluido) | `cancelar.test.js` |
| RN-10 | Solo el dueño o un admin cancela | `cancelar.test.js`, `api.test.js` |
| RN-11 | Cancelar libera el turno; no se cancela dos veces | `cancelar.test.js`, `repositorio-memoria.test.js` |
| RN-12 | Gestión de canchas solo para admin; canchas desactivadas | `canchas.test.js`, `reservar.test.js`, `api.test.js` |
| RN-13 | Disponibilidad libre / ocupado / pasado | `canchas.test.js` |
| RN-14 | Cada jugador ve solo sus reservas; el admin ve todas | `cancelar.test.js`, `api.test.js` |

### Casos de borde que se probaron a propósito

- A las 22:00 de Buenos Aires ya es el día siguiente en UTC; el sistema sigue contando el día de Buenos Aires (`tiempo.test.js`).
- Dos jugadores reservan el mismo turno en el mismo instante: uno recibe 201 y el otro 409 (`api.test.js`).
- Un cuerpo de más de 100 KB se rechaza con 413 (`api.test.js`).
- Un texto malicioso en lugar de un email no llega al SQL: viaja como parámetro (`repositorio-postgres.test.js`).

## 4. Pruebas manuales sobre el sistema desplegado

**Estado: pendiente.** Completar cuando estén publicados la base (Neon), el backend (Render) y el frontend (Netlify). Anotar en cada fila "OK" o "Falla" y, si falla, qué pasó.

Datos del despliegue: URL del frontend: `__________` · URL del backend: `__________` · Fecha de la prueba: `__________`

| # | Caso | Resultado esperado | Resultado |
|---|---|---|---|
| M-01 | Abrir `/api/health` del backend | Responde `{"estado":"ok"}` | |
| M-02 | Registrarse desde el frontend con un email nuevo | Entra a la pantalla de reservas | |
| M-03 | Registrarse con la contraseña "1234" | Mensaje de error (RN-01) | |
| M-04 | Cerrar sesión e ingresar con una contraseña incorrecta | Mensaje "Email o contraseña incorrectos" | |
| M-05 | Elegir cancha y fecha de mañana | Se ven los 14 turnos | |
| M-06 | Reservar el turno de las 18:00 | Mensaje de confirmación; el turno pasa a "Ocupado" | |
| M-07 | Con otro usuario, intentar reservar ese mismo turno | El turno aparece ocupado; si se fuerza, error RN-04 | |
| M-08 | Reservar otros 2 turnos y luego un cuarto | Error RN-07 | |
| M-09 | Cancelar una reserva de mañana desde "Mis reservas" | Queda "Cancelada" y el turno vuelve a estar libre | |
| M-10 | Reservar un turno que empieza en menos de 2 h e intentar cancelarlo | No aparece el botón Cancelar (RN-09) | |
| M-11 | Ingresar como administrador: crear una cancha y desactivarla | La cancha desactivada no la ve un jugador (RN-12) | |
| M-12 | Como jugador, abrir la consola del navegador y pedir `/api/reservas` | Responde 403 (RN-14) | |
| M-13 | Abrir el frontend desde el celular | La pantalla se adapta y se puede reservar | |
| M-14 | Recargar la página con la sesión iniciada | Sigue dentro de la app | |
| M-15 | Reiniciar el backend en Render y volver a entrar | Las reservas anteriores siguen (están en la base) | |

## 5. Problemas encontrados

Ninguno hasta ahora en las pruebas automáticas. Las pruebas manuales (sección 4) pueden agregar hallazgos; anotarlos acá.
