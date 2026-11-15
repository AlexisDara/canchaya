# SPEC — CanchaYa

CanchaYa es una aplicación web para reservar canchas de pádel de un club. Los jugadores se registran, ven la disponibilidad por cancha y fecha, reservan turnos de una hora y los cancelan. Un administrador gestiona las canchas y ve todas las reservas.

Zona horaria del club: Buenos Aires (UTC-3, sin horario de verano). Todas las fechas y horas se interpretan en esa zona.

## Roles

- **jugador:** se registra solo. Reserva y cancela sus propios turnos.
- **admin:** crea y activa/desactiva canchas, ve todas las reservas y puede cancelar cualquier reserva.

## Reglas de negocio

Cada regla tiene un número fijo. Los tests y los mensajes de error del backend citan ese número.

### Usuarios y acceso

- **RN-01** Para registrarse hacen falta nombre (2 a 60 caracteres), email válido y contraseña de al menos 8 caracteres. El email es único sin distinguir mayúsculas. La contraseña nunca se guarda en texto plano.
- **RN-02** Para iniciar sesión se usa email y contraseña. Un login correcto devuelve un token que vence a las 8 horas. Toda ruta, salvo registro, login y estado del servicio, exige un token válido; sin él, la respuesta es 401. Un login incorrecto no dice cuál de los dos datos falló.

### Turnos

- **RN-03** Los turnos duran 60 minutos y empiezan en hora en punto, entre las 09:00 y las 22:00 (el último turno es de 22:00 a 23:00).
- **RN-04** Una cancha no puede tener dos reservas activas en la misma fecha y hora. El segundo intento se rechaza con conflicto (409).
- **RN-05** No se puede reservar un turno que ya empezó o ya pasó.
- **RN-06** Solo se puede reservar con hasta 14 días de anticipación (contando el día de hoy como día 0).
- **RN-07** Un jugador puede tener como máximo 3 reservas activas futuras al mismo tiempo.
- **RN-08** Un jugador no puede tener dos reservas activas en la misma fecha y hora, aunque sean en canchas distintas.

### Cancelación

- **RN-09** Una reserva solo se puede cancelar hasta 2 horas antes de que empiece. Pasado ese límite, la cancelación se rechaza.
- **RN-10** Solo el dueño de la reserva o un admin puede cancelarla. Cualquier otro usuario recibe 403.
- **RN-11** Cancelar libera el turno: la reserva pasa a estado "cancelada", el horario vuelve a aparecer libre y deja de contar para los límites de RN-07 y RN-08. Una reserva ya cancelada no se puede cancelar de nuevo.

### Canchas y consultas

- **RN-12** Solo un admin puede crear canchas y activarlas o desactivarlas. Una cancha desactivada no admite reservas nuevas, y los jugadores no la ven en el listado. Las reservas que ya tenía se mantienen.
- **RN-13** La disponibilidad de una cancha en una fecha lista cada turno del día como "libre", "ocupado" o "pasado".
- **RN-14** Un jugador solo ve sus propias reservas. Un admin puede ver todas.

## Validaciones de entrada

- La fecha tiene formato `AAAA-MM-DD` y debe ser un día real del calendario.
- La hora es un entero.
- El cuerpo de cualquier petición no puede superar los 100 KB (413).
- Los errores del backend responden con la forma `{ "error": { "codigo", "mensaje", "regla" } }`.

## Fuera de alcance (versión 1)

Pagos o señas, recordatorios por email, recuperación de contraseña, reservas de más de un turno seguido y varios clubes.
