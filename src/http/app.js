// Capa HTTP: recibe peticiones, delega en los servicios y arma respuestas. No contiene reglas de negocio.
const http = require("node:http");
const { ErrorApp, validacion, noAutenticado, noEncontrado } = require("../lib/errores");
const { crearServicioAuth } = require("../services/auth");
const { crearServicioCanchas } = require("../services/canchas");
const { crearServicioReservas } = require("../services/reservas");

const LIMITE_CUERPO_BYTES = 100 * 1024;

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    let excedido = false;
    const partes = [];
    req.on("data", (parte) => {
      total += parte.length;
      if (total > LIMITE_CUERPO_BYTES) excedido = true;
      else partes.push(parte);
    });
    req.on("end", () => {
      if (excedido) return reject(new ErrorApp(413, "CUERPO_GRANDE", "El cuerpo de la petición supera los 100 KB"));
      if (partes.length === 0) return resolve({});
      try {
        const cuerpo = JSON.parse(Buffer.concat(partes).toString("utf8"));
        resolve(cuerpo && typeof cuerpo === "object" ? cuerpo : {});
      } catch {
        reject(validacion("El cuerpo no es un JSON válido"));
      }
    });
    req.on("error", reject);
  });
}

function idDeRuta(texto) {
  const id = Number(texto);
  if (!Number.isInteger(id) || id <= 0) throw validacion("El id de la URL no es válido");
  return id;
}

function crearApp({ repo, secreto, ahora = () => new Date(), corsOrigin = "*" }) {
  const auth = crearServicioAuth({ repo, secreto, ahora });
  const canchas = crearServicioCanchas({ repo, ahora });
  const reservas = crearServicioReservas({ repo, ahora });

  // Cada ruta: método, patrón, si exige sesión y el manejador.
  const rutas = [
    { m: "GET", p: /^\/api\/health$/, publica: true, h: async () => [200, { estado: "ok" }] },
    { m: "POST", p: /^\/api\/auth\/registro$/, publica: true, h: async (c) => [201, await auth.registrar(c.cuerpo)] },
    { m: "POST", p: /^\/api\/auth\/login$/, publica: true, h: async (c) => [200, await auth.login(c.cuerpo)] },
    { m: "GET", p: /^\/api\/me$/, h: async (c) => [200, c.actor] },
    { m: "GET", p: /^\/api\/canchas$/, h: async (c) => [200, await canchas.listar(c.actor)] },
    { m: "POST", p: /^\/api\/canchas$/, h: async (c) => [201, await canchas.crear(c.actor, c.cuerpo)] },
    {
      m: "PATCH",
      p: /^\/api\/canchas\/([^/]+)$/,
      h: async (c) => [200, await canchas.cambiarEstado(c.actor, idDeRuta(c.params[0]), c.cuerpo)],
    },
    {
      m: "GET",
      p: /^\/api\/canchas\/([^/]+)\/disponibilidad$/,
      h: async (c) => [200, await canchas.disponibilidad(idDeRuta(c.params[0]), c.consulta.get("fecha"))],
    },
    { m: "POST", p: /^\/api\/reservas$/, h: async (c) => [201, await reservas.reservar(c.actor, c.cuerpo)] },
    { m: "GET", p: /^\/api\/reservas\/mias$/, h: async (c) => [200, await reservas.misReservas(c.actor)] },
    { m: "GET", p: /^\/api\/reservas$/, h: async (c) => [200, await reservas.todas(c.actor)] },
    {
      m: "POST",
      p: /^\/api\/reservas\/([^/]+)\/cancelar$/,
      h: async (c) => [200, await reservas.cancelar(c.actor, idDeRuta(c.params[0]))],
    },
  ];

  function responder(res, estado, cuerpo) {
    const texto = estado === 204 ? "" : JSON.stringify(cuerpo);
    res.writeHead(estado, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(texto);
  }

  async function manejar(req, res) {
    try {
      if (req.method === "OPTIONS") return responder(res, 204);
      const url = new URL(req.url, "http://localhost");
      const rutaEncontrada = rutas.map((r) => ({ r, m: r.p.exec(url.pathname) })).find((x) => x.m && x.r.m === req.method);
      if (!rutaEncontrada) {
        if (rutas.some((r) => r.p.test(url.pathname))) throw new ErrorApp(405, "METODO_NO_PERMITIDO", "Método no permitido");
        throw noEncontrado("La ruta no existe");
      }
      const { r, m } = rutaEncontrada;
      let actor = null;
      if (!r.publica) {
        const cabecera = req.headers.authorization || "";
        if (!cabecera.startsWith("Bearer ")) throw noAutenticado();
        actor = await auth.autenticar(cabecera.slice(7));
      }
      const cuerpo = req.method === "POST" || req.method === "PATCH" ? await leerCuerpo(req) : {};
      const [estado, datos] = await r.h({ actor, cuerpo, params: m.slice(1), consulta: url.searchParams });
      responder(res, estado, datos);
    } catch (e) {
      if (e instanceof ErrorApp) {
        return responder(res, e.estado, { error: { codigo: e.codigo, mensaje: e.message, regla: e.regla } });
      }
      console.error("Error inesperado:", e);
      responder(res, 500, { error: { codigo: "ERROR_INTERNO", mensaje: "Ocurrió un error inesperado", regla: null } });
    }
  }

  return { manejar, auth, crearServidor: () => http.createServer(manejar) };
}

module.exports = { crearApp, LIMITE_CUERPO_BYTES };
