// Reglas RN-01 y RN-02: registro, login y verificación de token.
const { hashPassword, verificarPassword, crearToken, leerToken } = require("../lib/seguridad");
const { validacion, noAutenticado, conflicto } = require("../lib/errores");

const DURACION_TOKEN_MS = 8 * 60 * 60 * 1000; // RN-02: 8 horas
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publico = (u) => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol });

function crearServicioAuth({ repo, secreto, ahora }) {
  function validarDatos({ nombre, email, password }) {
    const nom = typeof nombre === "string" ? nombre.trim() : "";
    const mail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (nom.length < 2 || nom.length > 60) throw validacion("El nombre debe tener entre 2 y 60 caracteres", "RN-01");
    if (!REGEX_EMAIL.test(mail) || mail.length > 120) throw validacion("El email no es válido", "RN-01");
    if (typeof password !== "string" || password.length < 8 || password.length > 100) {
      throw validacion("La contraseña debe tener entre 8 y 100 caracteres", "RN-01");
    }
    return { nombre: nom, email: mail, password };
  }

  async function registrar(datos, rol = "jugador") {
    const { nombre, email, password } = validarDatos(datos);
    if (await repo.buscarUsuarioPorEmail(email)) throw conflicto("Ya existe un usuario con ese email", "RN-01");
    const usuario = await repo.crearUsuario({ nombre, email, passwordHash: hashPassword(password), rol });
    return publico(usuario);
  }

  async function login({ email, password } = {}) {
    const mail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const usuario = mail ? await repo.buscarUsuarioPorEmail(mail) : null;
    const ok = usuario && typeof password === "string" && verificarPassword(password, usuario.passwordHash);
    if (!ok) throw noAutenticado("Email o contraseña incorrectos", "RN-02");
    const token = crearToken({ sub: usuario.id, rol: usuario.rol }, secreto, ahora().getTime(), DURACION_TOKEN_MS);
    return { token, usuario: publico(usuario) };
  }

  async function autenticar(token) {
    const datos = leerToken(token, secreto, ahora().getTime());
    if (!datos) throw noAutenticado("Sesión inválida o vencida", "RN-02");
    const usuario = await repo.buscarUsuarioPorId(datos.sub);
    if (!usuario) throw noAutenticado("Sesión inválida o vencida", "RN-02");
    return publico(usuario);
  }

  // Para cargar el administrador inicial desde variables de entorno.
  async function asegurarAdmin({ nombre, email, password }) {
    const mail = String(email).trim().toLowerCase();
    if (await repo.buscarUsuarioPorEmail(mail)) return null;
    return registrar({ nombre, email, password }, "admin");
  }

  return { registrar, login, autenticar, asegurarAdmin };
}

module.exports = { crearServicioAuth, DURACION_TOKEN_MS };
