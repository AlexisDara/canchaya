// Reglas RN-12 (gestión de canchas) y RN-13 (disponibilidad).
const { validacion, prohibido, noEncontrado } = require("../lib/errores");
const { parsearFecha, inicioDelTurno, HORA_PRIMER_TURNO, HORA_ULTIMO_TURNO } = require("../lib/tiempo");

function crearServicioCanchas({ repo, ahora }) {
  function exigirAdmin(actor) {
    if (!actor || actor.rol !== "admin") throw prohibido("Solo un administrador puede hacer esto", "RN-12");
  }

  // RN-12: los jugadores solo ven las canchas activas; el admin ve todas.
  async function listar(actor) {
    const todas = await repo.listarCanchas();
    return actor.rol === "admin" ? todas : todas.filter((c) => c.activa);
  }

  async function crear(actor, { nombre } = {}) {
    exigirAdmin(actor);
    const nom = typeof nombre === "string" ? nombre.trim() : "";
    if (nom.length < 2 || nom.length > 40) throw validacion("El nombre de la cancha debe tener entre 2 y 40 caracteres", "RN-12");
    return repo.crearCancha({ nombre: nom });
  }

  async function cambiarEstado(actor, id, { activa } = {}) {
    exigirAdmin(actor);
    if (typeof activa !== "boolean") throw validacion('El campo "activa" debe ser true o false', "RN-12");
    const cancha = await repo.actualizarCancha(id, { activa });
    if (!cancha) throw noEncontrado("La cancha no existe");
    return cancha;
  }

  // RN-13: cada turno del día queda "libre", "ocupado" o "pasado".
  async function disponibilidad(canchaId, fecha) {
    if (!parsearFecha(fecha)) throw validacion("La fecha debe tener formato AAAA-MM-DD y ser un día real", "RN-13");
    const cancha = await repo.buscarCanchaPorId(canchaId);
    if (!cancha) throw noEncontrado("La cancha no existe");
    const ocupadas = new Set((await repo.listarReservasActivasPorCanchaYFecha(canchaId, fecha)).map((r) => r.hora));
    const turnos = [];
    for (let hora = HORA_PRIMER_TURNO; hora <= HORA_ULTIMO_TURNO; hora++) {
      let estado = "libre";
      if (inicioDelTurno(fecha, hora) <= ahora()) estado = "pasado";
      else if (ocupadas.has(hora)) estado = "ocupado";
      turnos.push({ hora, estado });
    }
    return { canchaId, fecha, activa: cancha.activa, turnos };
  }

  return { listar, crear, cambiarEstado, disponibilidad };
}

module.exports = { crearServicioCanchas };
