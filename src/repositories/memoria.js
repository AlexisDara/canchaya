// Repositorio en memoria: se usa en desarrollo local y en los tests.
// Tiene la misma interfaz que postgres.js. Todo es asíncrono para que ambos sean intercambiables.
const { conflicto } = require("../lib/errores");

function crearRepositorioMemoria() {
  const usuarios = [];
  const canchas = [];
  const reservas = [];
  let sigUsuario = 1;
  let sigCancha = 1;
  let sigReserva = 1;
  const copia = (obj) => (obj ? { ...obj } : null);

  return {
    async iniciar() {},

    // Usuarios
    async crearUsuario({ nombre, email, passwordHash, rol }) {
      const u = { id: sigUsuario++, nombre, email, passwordHash, rol, creadoEn: new Date().toISOString() };
      usuarios.push(u);
      return copia(u);
    },
    async buscarUsuarioPorEmail(email) {
      return copia(usuarios.find((u) => u.email === email));
    },
    async buscarUsuarioPorId(id) {
      return copia(usuarios.find((u) => u.id === id));
    },

    // Canchas
    async crearCancha({ nombre }) {
      const c = { id: sigCancha++, nombre, activa: true };
      canchas.push(c);
      return copia(c);
    },
    async listarCanchas() {
      return canchas.map(copia);
    },
    async buscarCanchaPorId(id) {
      return copia(canchas.find((c) => c.id === id));
    },
    async actualizarCancha(id, { activa }) {
      const c = canchas.find((x) => x.id === id);
      if (!c) return null;
      c.activa = activa;
      return copia(c);
    },

    // Reservas
    async crearReserva({ usuarioId, canchaId, fecha, hora }) {
      const ocupado = reservas.some(
        (r) => r.canchaId === canchaId && r.fecha === fecha && r.hora === hora && r.estado === "activa"
      );
      if (ocupado) throw conflicto("Ese turno ya está reservado en esa cancha", "RN-04");
      const r = { id: sigReserva++, usuarioId, canchaId, fecha, hora, estado: "activa", creadaEn: new Date().toISOString() };
      reservas.push(r);
      return copia(r);
    },
    async buscarReservaPorId(id) {
      return copia(reservas.find((r) => r.id === id));
    },
    async listarReservasActivasPorCanchaYFecha(canchaId, fecha) {
      return reservas.filter((r) => r.canchaId === canchaId && r.fecha === fecha && r.estado === "activa").map(copia);
    },
    async listarReservasDeUsuario(usuarioId) {
      return reservas.filter((r) => r.usuarioId === usuarioId).map(copia);
    },
    async listarTodasLasReservas() {
      return reservas.map(copia);
    },
    async cancelarReserva(id) {
      const r = reservas.find((x) => x.id === id);
      if (!r) return null;
      r.estado = "cancelada";
      return copia(r);
    },
  };
}

module.exports = { crearRepositorioMemoria };
