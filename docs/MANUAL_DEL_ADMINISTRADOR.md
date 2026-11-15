# Manual del administrador — CanchaYa

Este manual es para el personal del club que administra las canchas y controla las reservas.

## 1. Qué puede hacer un administrador

| Acción | Dónde |
|---|---|
| Reservar y cancelar como cualquier jugador | Solapas **Reservar** y **Mis reservas** |
| Crear canchas | **Administración** → Canchas |
| Activar o desactivar canchas | **Administración** → Canchas |
| Ver todas las reservas del club | **Administración** → Todas las reservas |
| Cancelar la reserva de cualquier jugador | **Administración** → Todas las reservas |

El administrador **no** puede crear reservas a nombre de otro jugador ni modificar datos de los usuarios.

## 2. Cómo se obtiene la cuenta de administrador

La cuenta de administrador no se crea desde la pantalla de registro (ahí solo se crean jugadores). Se crea automáticamente cuando el sistema arranca, con las variables de entorno `ADMIN_NAME`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` configuradas en el servidor (ver `MANUAL_TECNICO.md`). Con ese email y contraseña se ingresa normalmente desde la pestaña **Ingresar**.

Recomendaciones:
- Usá una contraseña larga, que no uses en otros sitios.
- No compartas la cuenta de administrador por mensajes. Si más de una persona administra el club, definan quién tiene acceso.
- Por ahora la aplicación no tiene pantalla para cambiar la contraseña: hacerlo requiere acceso técnico al servidor.

## 3. Administrar canchas

Entrá a **Administración**. La tarjeta **Canchas** muestra todas las canchas con su estado (**Activa** o **Desactivada**).

### 3.1 Crear una cancha
1. En **Nombre de la nueva cancha**, escribí el nombre (de 2 a 40 caracteres, por ejemplo "Cancha 4").
2. Tocá **Crear cancha**. La cancha se crea activa y aparece en la lista y en la pantalla de reservas.

### 3.2 Desactivar una cancha
Usala cuando una cancha esté en mantenimiento o fuera de servicio.
1. En la cancha, tocá **Desactivar**.
2. Efectos: los jugadores dejan de verla y no pueden hacer reservas nuevas en ella. **Las reservas que ya tenía se mantienen**; hay que revisarlas y, si corresponde, cancelarlas (ver sección 4).

### 3.3 Reactivar una cancha
Tocá **Activar**. Vuelve a aparecer para todos los jugadores.

El sistema carga tres canchas de ejemplo ("Cancha 1", "Cancha 2" y "Cancha 3") la primera vez que arranca con una base de datos vacía. No se pueden borrar ni renombrar: se pueden desactivar.

## 4. Ver y cancelar reservas

En **Administración**, la tarjeta **Todas las reservas** lista las reservas de todos los jugadores, ordenadas por fecha y hora. Cada una muestra la cancha, la fecha, el horario, su estado y el número de usuario (por ejemplo "Usuario n.º 4").

Para cancelar una reserva, tocá **Cancelar** y confirmá. El turno queda libre inmediatamente.

Condiciones:
- Igual que para los jugadores, solo se puede cancelar hasta 2 horas antes del turno. Si falta menos, el botón no aparece.
- Una reserva ya cancelada no se puede volver a cancelar ni reactivar. El jugador tiene que reservar otra vez.

## 5. Situaciones frecuentes

| Situación | Qué revisar |
|---|---|
| "Un jugador dice que no puede reservar" | El mensaje de error que ve indica el motivo. Las causas más comunes: ya tiene 3 reservas activas (RN-07), el horario ya está ocupado (RN-04) o la cancha está desactivada (RN-12). |
| "Un jugador quiere cancelar y ya no puede" | Faltan menos de 2 horas (RN-09). El administrador tampoco puede cancelar en ese caso. |
| "Hay que cerrar una cancha un día" | Desactivala, revisá en **Todas las reservas** las que tenía y cancelalas con aviso a los jugadores. |
| "Quiero saber quién reservó un turno" | En **Todas las reservas** se ve el número de usuario. El nombre y el email de cada usuario no se muestran en la pantalla de la versión 1. |
| "Un jugador olvidó su contraseña" | No hay recuperación automática. Debe resolverse con acceso técnico a la base de datos. |

## 6. Buenas prácticas

- Revisá **Todas las reservas** una vez por día para anticipar el uso de las canchas.
- Antes de desactivar una cancha, revisá si tiene reservas futuras.
- Después de cualquier cambio importante, probá entrando con una cuenta de jugador para comprobar que se ve como esperás.
