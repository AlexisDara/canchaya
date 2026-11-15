// Repositorio PostgreSQL (producción). Misma interfaz que memoria.js.
// Todas las consultas usan parámetros ($1, $2...): nunca se concatenan datos del usuario en el SQL.
const fs = require("node:fs");
const path = require("node:path");
const { conflicto } = require("../lib/errores");

const COLUMNAS_USUARIO = "id, nombre, email, password_hash AS \"passwordHash\", rol, creado_en AS \"creadoEn\"";
const COLUMNAS_RESERVA =
  "id, usuario_id AS \"usuarioId\", cancha_id AS \"canchaId\", to_char(fecha, 'YYYY-MM-DD') AS fecha, hora, estado, creada_en AS \"creadaEn\"";

// "opciones.pool" permite inyectar un pool de prueba; en producción se crea uno con la cadena de conexión.
function crearRepositorioPostgres(cadenaConexion, opciones = {}) {
  let pool = opciones.pool;
  if (!pool) {
    const { Pool } = require("pg");
    pool = new Pool({
      connectionString: cadenaConexion,
      ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
      max: 5, // el plan gratuito de Neon admite pocas conexiones
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  // Neon corta las conexiones inactivas. Sin este manejador, ese aviso tiraría abajo todo el proceso.
  if (typeof pool.on === "function") {
    pool.on("error", (e) => console.error("Conexión inactiva de la base cerrada:", e.message));
  }
  const unica = async (texto, valores) => (await pool.query(texto, valores)).rows[0] ?? null;
  const todas = async (texto, valores) => (await pool.query(texto, valores)).rows;
  const aISO = (r) => (r && r.creadaEn instanceof Date ? { ...r, creadaEn: r.creadaEn.toISOString() } : r);

  return {
    async iniciar() {
      const sql = fs.readFileSync(path.join(__dirname, "..", "..", "db", "schema.sql"), "utf8");
      await pool.query(sql);
    },

    // Usuarios
    async crearUsuario({ nombre, email, passwordHash, rol }) {
      try {
        return await unica(
          `INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNAS_USUARIO}`,
          [nombre, email, passwordHash, rol]
        );
      } catch (e) {
        // Dos registros simultáneos con el mismo email: gana uno y el otro recibe un conflicto (RN-01).
        if (e.code === "23505") throw conflicto("Ya existe un usuario con ese email", "RN-01");
        throw e;
      }
    },
    buscarUsuarioPorEmail: (email) => unica(`SELECT ${COLUMNAS_USUARIO} FROM usuarios WHERE email = $1`, [email]),
    buscarUsuarioPorId: (id) => unica(`SELECT ${COLUMNAS_USUARIO} FROM usuarios WHERE id = $1`, [id]),

    // Canchas
    crearCancha: ({ nombre }) => unica("INSERT INTO canchas (nombre) VALUES ($1) RETURNING id, nombre, activa", [nombre]),
    listarCanchas: () => todas("SELECT id, nombre, activa FROM canchas ORDER BY id"),
    buscarCanchaPorId: (id) => unica("SELECT id, nombre, activa FROM canchas WHERE id = $1", [id]),
    actualizarCancha: (id, { activa }) =>
      unica("UPDATE canchas SET activa = $2 WHERE id = $1 RETURNING id, nombre, activa", [id, activa]),

    // Reservas
    async crearReserva({ usuarioId, canchaId, fecha, hora }) {
      try {
        return aISO(
          await unica(
            `INSERT INTO reservas (usuario_id, cancha_id, fecha, hora) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNAS_RESERVA}`,
            [usuarioId, canchaId, fecha, hora]
          )
        );
      } catch (e) {
        // 23505 = violación de índice único: otro pedido tomó el turno primero (RN-04).
        if (e.code === "23505") throw conflicto("Ese turno ya está reservado en esa cancha", "RN-04");
        throw e;
      }
    },
    async buscarReservaPorId(id) {
      return aISO(await unica(`SELECT ${COLUMNAS_RESERVA} FROM reservas WHERE id = $1`, [id]));
    },
    async listarReservasActivasPorCanchaYFecha(canchaId, fecha) {
      return (
        await todas(`SELECT ${COLUMNAS_RESERVA} FROM reservas WHERE cancha_id = $1 AND fecha = $2 AND estado = 'activa'`, [canchaId, fecha])
      ).map(aISO);
    },
    async listarReservasDeUsuario(usuarioId) {
      return (await todas(`SELECT ${COLUMNAS_RESERVA} FROM reservas WHERE usuario_id = $1 ORDER BY fecha, hora`, [usuarioId])).map(aISO);
    },
    async listarTodasLasReservas() {
      return (await todas(`SELECT ${COLUMNAS_RESERVA} FROM reservas ORDER BY fecha, hora`)).map(aISO);
    },
    async cancelarReserva(id) {
      return aISO(await unica(`UPDATE reservas SET estado = 'cancelada' WHERE id = $1 RETURNING ${COLUMNAS_RESERVA}`, [id]));
    },
  };
}

module.exports = { crearRepositorioPostgres };
