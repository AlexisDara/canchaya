// Reglas RN-03 a RN-08 (crear reservas), RN-09 a RN-11 (cancelar) y RN-14 (listados).
const { validacion, prohibido, noEncontrado, conflicto, reglaNegocio } = require("../lib/errores");
const { parsearFecha, esHoraDeTurnoValida, inicioDelTurno, diasDesdeHoy, MS_POR_HORA } = require("../lib/tiempo");

const MAX_RESERVAS_ACTIVAS_FUTURAS = 3; // RN-07
const MAX_DIAS_ANTICIPACION = 14; // RN-06
const HORAS_MINIMAS_PARA_CANCELAR = 2; // RN-09

function crearServicioReservas({ repo, ahora }) {
  const esFuturaYActiva = (r) => r.estado === "activa" && inicioDelTurno(r.fecha, r.hora) > ahora();

  async function reservar(actor, { canchaId, fecha, hora } = {}) {
    if (!Number.isInteger(canchaId)) throw validacion("canchaId debe ser un número entero");
    if (!parsearFecha(fecha)) throw validacion("La fecha debe tener formato AAAA-MM-DD y ser un día real");
    if (!esHoraDeTurnoValida(hora)) throw validacion("La hora debe ser un entero entre 9 y 22", "RN-03");

    const cancha = await repo.buscarCanchaPorId(canchaId);
    if (!cancha) throw noEncontrado("La cancha no existe");
    if (!cancha.activa) throw reglaNegocio("La cancha no está disponible para reservas", "RN-12");

    if (inicioDelTurno(fecha, hora) <= ahora()) throw reglaNegocio("No se puede reservar un turno que ya empezó o pasó", "RN-05");
    if (diasDesdeHoy(fecha, ahora()) > MAX_DIAS_ANTICIPACION) {
      throw reglaNegocio(`Solo se puede reservar con hasta ${MAX_DIAS_ANTICIPACION} días de anticipación`, "RN-06");
    }

    const delUsuario = await repo.listarReservasDeUsuario(actor.id);
    const activasFuturas = delUsuario.filter(esFuturaYActiva);
    if (activasFuturas.length >= MAX_RESERVAS_ACTIVAS_FUTURAS) {
      throw reglaNegocio(`Ya tenés ${MAX_RESERVAS_ACTIVAS_FUTURAS} reservas activas`, "RN-07");
    }
    if (activasFuturas.some((r) => r.fecha === fecha && r.hora === hora)) {
      throw conflicto("Ya tenés otra reserva en ese mismo horario", "RN-08");
    }

    const ocupadas = await repo.listarReservasActivasPorCanchaYFecha(canchaId, fecha);
    if (ocupadas.some((r) => r.hora === hora)) throw conflicto("Ese turno ya está reservado en esa cancha", "RN-04");

    // El repositorio vuelve a verificar RN-04 (índice único en Postgres) por si dos pedidos llegan a la vez.
    return repo.crearReserva({ usuarioId: actor.id, canchaId, fecha, hora });
  }

  // Agrega datos útiles para mostrar: nombre de la cancha, instante de inicio y si todavía se puede cancelar.
  async function enriquecer(lista) {
    const nombres = new Map((await repo.listarCanchas()).map((c) => [c.id, c.nombre]));
    return lista
      .map((r) => {
        const inicio = inicioDelTurno(r.fecha, r.hora);
        const puedeCancelar = r.estado === "activa" && inicio.getTime() - ahora().getTime() >= HORAS_MINIMAS_PARA_CANCELAR * MS_POR_HORA;
        return { ...r, canchaNombre: nombres.get(r.canchaId) ?? "", inicio: inicio.toISOString(), puedeCancelar };
      })
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
  }

  async function cancelar(actor, id) {
    const reserva = await repo.buscarReservaPorId(id);
    if (!reserva) throw noEncontrado("La reserva no existe");
    if (actor.rol !== "admin" && reserva.usuarioId !== actor.id) {
      throw prohibido("Solo podés cancelar tus propias reservas", "RN-10");
    }
    if (reserva.estado === "cancelada") throw conflicto("La reserva ya estaba cancelada", "RN-11");
    const faltaMs = inicioDelTurno(reserva.fecha, reserva.hora).getTime() - ahora().getTime();
    if (faltaMs < HORAS_MINIMAS_PARA_CANCELAR * MS_POR_HORA) {
      throw reglaNegocio(`Solo se puede cancelar hasta ${HORAS_MINIMAS_PARA_CANCELAR} horas antes del turno`, "RN-09");
    }
    const cancelada = await repo.cancelarReserva(id);
    return (await enriquecer([cancelada]))[0];
  }

  // RN-14: el jugador ve solo las suyas.
  async function misReservas(actor) {
    return enriquecer(await repo.listarReservasDeUsuario(actor.id));
  }

  // RN-14: solo el admin ve todas.
  async function todas(actor) {
    if (actor.rol !== "admin") throw prohibido("Solo un administrador puede ver todas las reservas", "RN-14");
    return enriquecer(await repo.listarTodasLasReservas());
  }

  return { reservar, cancelar, misReservas, todas };
}

module.exports = { crearServicioReservas, MAX_RESERVAS_ACTIVAS_FUTURAS, MAX_DIAS_ANTICIPACION };
