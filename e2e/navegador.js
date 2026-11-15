// Prueba de punta a punta en un navegador real (Chromium con Playwright).
// NO forma parte de `npm test`: necesita Playwright y un backend corriendo.
//   1) Levantar el backend recién iniciado (la base en memoria debe estar vacía):
//      ADMIN_EMAIL=admin@club.com ADMIN_PASSWORD=admin-clave-123 PORT=3000 node src/index.js
//   2) Ejecutar:             node e2e/navegador.js        (con "playwright" instalado)
// Sirve el frontend en el puerto 4000, ejecuta los casos manuales M-xx y guarda capturas en docs/capturas/.
const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const API = process.env.API_URL || "http://localhost:3000";
const RAIZ = path.join(__dirname, "..");
const CARPETA_CAPTURAS = path.join(RAIZ, "docs", "capturas");
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

function servirFrontend(puerto) {
  const srv = http.createServer((req, res) => {
    const archivo = path.join(RAIZ, "frontend", req.url === "/" ? "index.html" : req.url.split("?")[0]);
    if (!archivo.startsWith(path.join(RAIZ, "frontend")) || !fs.existsSync(archivo)) return (res.writeHead(404), res.end());
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "text/plain" });
    res.end(fs.readFileSync(archivo));
  });
  return new Promise((ok) => srv.listen(puerto, () => ok(srv)));
}

const ahoraAR = () => new Date(Date.now() - 3 * 3600e3);
const fechaAR = (dias = 0) => new Date(ahoraAR().getTime() + dias * 86400e3).toISOString().slice(0, 10);

(async () => {
  const front = await servirFrontend(4000);
  const URL = "http://localhost:4000/";
  const navegador = await chromium.launch();
  const errores = [];
  const resultados = [];
  const sufijo = Date.now().toString(36);

  async function nuevaPagina(ancho = 1000, alto = 800) {
    const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(6000);
    page.on("dialog", (d) => d.accept());
    page.on("pageerror", (e) => errores.push(`pageerror: ${e.message}`));
    // Los "Failed to load resource" son respuestas 4xx esperadas de la API (login incorrecto, RN-07, 403); no son errores de JavaScript.
    page.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && errores.push(`console: ${m.text()}`));
    await page.goto(URL);
    return page;
  }
  const captura = (page, nombre, opciones = {}) => page.screenshot({ path: path.join(CARPETA_CAPTURAS, nombre), ...opciones });
  async function caso(id, fn) {
    try {
      const detalle = await fn();
      resultados.push({ id, ok: true, detalle: detalle || "" });
    } catch (e) {
      resultados.push({ id, ok: false, detalle: String(e.message).split("\n")[0] });
    }
  }
  async function registrar(page, nombre, email, password = "clave-segura-1") {
    await page.getByRole("button", { name: "Registrarme" }).click();
    await page.fill("#nombre", nombre);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await page.getByRole("heading", { name: "Reservar una cancha" }).waitFor();
  }
  async function elegir(page, cancha, fecha) {
    await page.selectOption("#cancha", { label: cancha });
    await page.fill("#fecha", fecha);
    await page.waitForFunction(() => document.querySelectorAll("button.turno").length === 14);
  }
  const turno = (page, hora) => page.locator("button.turno", { hasText: `${String(hora).padStart(2, "0")}:00` });
  const reservar = async (page, hora) => {
    await turno(page, hora).click();
    await page.locator(".mensaje").first().waitFor();
  };

  const manana = fechaAR(1);
  const emailAna = `ana.${sufijo}@mail.com`;
  const emailBeto = `beto.${sufijo}@mail.com`;
  let ana, beto, admin;

  await caso("M-01", async () => {
    const r = await fetch(`${API}/api/health`);
    const d = await r.json();
    if (r.status !== 200 || d.estado !== "ok") throw new Error("health no responde ok");
  });

  await caso("M-02", async () => {
    ana = await nuevaPagina();
    await captura(ana, "01-acceso.png");
    await ana.getByRole("button", { name: "Registrarme" }).click();
    await captura(ana, "02-registro.png");
    await registrar(ana, "Ana Pérez", emailAna);
    await ana.getByText("Ana Pérez (jugador)").waitFor();
  });

  await caso("M-03", async () => {
    const p = await nuevaPagina();
    await p.getByRole("button", { name: "Registrarme" }).click();
    await p.fill("#nombre", "Prueba");
    await p.fill("#email", `corta.${sufijo}@mail.com`);
    await p.fill("#password", "1234");
    await p.getByRole("button", { name: "Crear cuenta" }).click();
    const invalido = await p.$eval("#password", (i) => !i.checkValidity());
    const sigueEnAcceso = await p.getByRole("button", { name: "Crear cuenta" }).isVisible();
    if (!invalido || !sigueEnAcceso) throw new Error("dejó enviar una contraseña de 4 caracteres");
    await p.context().close();
  });

  await caso("M-04", async () => {
    await ana.getByRole("button", { name: "Salir" }).click();
    await ana.fill("#email", emailAna);
    await ana.fill("#password", "clave-equivocada");
    await ana.getByRole("button", { name: "Entrar" }).click();
    await ana.locator(".mensaje.error", { hasText: "Email o contraseña incorrectos" }).waitFor();
    await ana.fill("#password", "clave-segura-1");
    await ana.getByRole("button", { name: "Entrar" }).click();
    await ana.getByRole("heading", { name: "Reservar una cancha" }).waitFor();
  });

  await caso("M-05", async () => {
    await elegir(ana, "Cancha 1", manana);
    const n = await ana.locator("button.turno").count();
    if (n !== 14) throw new Error(`se vieron ${n} turnos`);
  });

  await caso("M-06", async () => {
    await reservar(ana, 18);
    await ana.locator(".mensaje.ok", { hasText: "Reserva confirmada" }).waitFor();
    const clase = await turno(ana, 18).getAttribute("class");
    const deshabilitado = await turno(ana, 18).isDisabled();
    if (!clase.includes("ocupado") || !deshabilitado) throw new Error("el turno no quedó ocupado");
  });

  await caso("M-07", async () => {
    beto = await nuevaPagina();
    await registrar(beto, "Beto Gómez", emailBeto);
    await elegir(beto, "Cancha 1", manana);
    if (!(await turno(beto, 18).isDisabled())) throw new Error("el turno de Ana aparece libre para Beto");
    const clase = await turno(beto, 18).getAttribute("class");
    if (!clase.includes("ocupado")) throw new Error("no figura como ocupado");
  });

  await caso("M-08", async () => {
    await reservar(ana, 19);
    await reservar(ana, 20);
    await reservar(ana, 21);
    await ana.locator(".mensaje.error", { hasText: "RN-07" }).waitFor();
    // Beto ve los turnos ocupados por Ana para la captura
    await elegir(beto, "Cancha 1", manana);
    await captura(beto, "03-reservar.png", { fullPage: true });
  });

  await caso("M-09", async () => {
    await ana.getByRole("button", { name: "Mis reservas" }).click();
    await ana.getByRole("heading", { name: "Mis reservas" }).waitFor();
    await ana.locator(".item").first().waitFor();
    await captura(ana, "05-mis-reservas.png", { fullPage: true });
    await ana.getByRole("button", { name: "Cancelar" }).first().click();
    await ana.locator(".mensaje.ok", { hasText: "Reserva cancelada" }).waitFor();
    await ana.locator(".etiqueta.cancelada").first().waitFor();
    await ana.getByRole("button", { name: "Reservar" }).click();
    await elegir(ana, "Cancha 1", manana);
    const clase = await turno(ana, 18).getAttribute("class");
    if (!clase.includes("libre")) throw new Error("el turno cancelado no quedó libre");
  });

  await caso("M-10", async () => {
    // Depende de la hora: hace falta un turno de hoy que empiece dentro de menos de 2 horas.
    const ahora = ahoraAR();
    const horaActual = ahora.getUTCHours() + ahora.getUTCMinutes() / 60;
    const proxima = Math.ceil(horaActual + 0.01);
    if (proxima < 9 || proxima > 22 || proxima - horaActual >= 2) {
      return "OMITIDA: a esta hora no hay un turno de hoy a menos de 2 h (cubierta por cancelar.test.js, RN-09)";
    }
    // Ana ya tiene 2 reservas activas; cancelamos una para tener lugar.
    await ana.getByRole("button", { name: "Mis reservas" }).click();
    await ana.getByRole("button", { name: "Cancelar" }).first().click();
    await ana.locator(".mensaje.ok").waitFor();
    await ana.getByRole("button", { name: "Reservar" }).click();
    await elegir(ana, "Cancha 2", fechaAR(0));
    await reservar(ana, proxima);
    await ana.locator(".mensaje.ok").waitFor();
    await ana.getByRole("button", { name: "Mis reservas" }).click();
    await ana.getByText("Ya no se puede cancelar (menos de 2 h)").waitFor();
    return `turno de las ${proxima}:00 de hoy: sin botón Cancelar`;
  });

  await caso("M-11", async () => {
    admin = await nuevaPagina();
    await admin.fill("#email", "admin@club.com");
    await admin.fill("#password", "admin-clave-123");
    await admin.getByRole("button", { name: "Entrar" }).click();
    await admin.getByRole("button", { name: "Administración" }).click();
    await admin.getByRole("heading", { name: "Canchas" }).waitFor();
    await admin.fill("#nuevaCancha", "Cancha 4");
    await admin.getByRole("button", { name: "Crear cancha" }).click();
    await admin.locator(".item", { hasText: "Cancha 4" }).waitFor();
    await admin.locator(".item", { hasText: "Cancha 4" }).getByRole("button", { name: "Desactivar" }).click();
    await admin.locator(".item", { hasText: "Cancha 4" }).getByText("Desactivada").waitFor();
    await admin.getByRole("heading", { name: "Todas las reservas" }).waitFor();
    await admin.locator(".item", { hasText: "Usuario n.º" }).first().waitFor();
    await captura(admin, "06-administracion.png", { fullPage: true });
    // El jugador no ve la cancha desactivada
    await ana.reload();
    await ana.getByRole("heading", { name: "Reservar una cancha" }).waitFor();
    const opciones = await ana.locator("#cancha option").allTextContents();
    if (opciones.includes("Cancha 4")) throw new Error("el jugador ve una cancha desactivada");
  });

  await caso("M-12", async () => {
    const estado = await ana.evaluate(async (api) => {
      const t = localStorage.getItem("canchaya_token");
      return (await fetch(`${api}/api/reservas`, { headers: { Authorization: `Bearer ${t}` } })).status;
    }, API);
    if (estado !== 403) throw new Error(`devolvió ${estado} en vez de 403`);
  });

  await caso("M-13", async () => {
    const movil = await nuevaPagina(375, 700);
    await movil.fill("#email", emailBeto);
    await movil.fill("#password", "clave-segura-1");
    await movil.getByRole("button", { name: "Entrar" }).click();
    await movil.getByRole("heading", { name: "Reservar una cancha" }).waitFor();
    await elegir(movil, "Cancha 1", manana);
    const desborda = await movil.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    await captura(movil, "07-movil-reservar.png", { fullPage: true });
    if (desborda) throw new Error("hay scroll horizontal en 375 px");
    await movil.context().close();
  });

  await caso("M-14", async () => {
    await beto.reload();
    await beto.getByRole("heading", { name: "Reservar una cancha" }).waitFor();
    await beto.getByText("Beto Gómez (jugador)").waitFor();
  });

  await caso("M-14b (hoy)", async () => {
    await elegir(beto, "Cancha 1", fechaAR(0));
    await captura(beto, "04-reservar-hoy.png", { fullPage: true });
  });

  resultados.push({ id: "M-15", ok: null, detalle: "NO EJECUTADA: requiere PostgreSQL (con la base en memoria los datos no sobreviven al reinicio)" });
  console.log(JSON.stringify({ resultados, errores }, null, 2));
  await navegador.close();
  front.close();
  process.exit(resultados.some((r) => r.ok === false) || errores.length ? 1 : 0);
})();
