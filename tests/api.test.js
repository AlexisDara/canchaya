// Pruebas de punta a punta: servidor HTTP real con repositorio en memoria y hora fija.
const test = require("node:test");
const assert = require("node:assert/strict");
const { crearApp } = require("../src/http/app");
const { crearRepositorioMemoria } = require("../src/repositories/memoria");

const AHORA = new Date("2026-11-10T15:00:00-03:00");

async function levantar() {
  const repo = crearRepositorioMemoria();
  const app = crearApp({ repo, secreto: "secreto-de-prueba", ahora: () => AHORA });
  await app.auth.asegurarAdmin({ nombre: "Admin", email: "admin@club.com", password: "admin-clave-123" });
  await repo.crearCancha({ nombre: "Cancha 1" });
  const servidor = app.crearServidor();
  await new Promise((ok) => servidor.listen(0, ok));
  const base = `http://127.0.0.1:${servidor.address().port}`;

  async function pedir(metodo, ruta, { token, cuerpo, crudo } = {}) {
    const res = await fetch(base + ruta, {
      method: metodo,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: crudo ?? (cuerpo ? JSON.stringify(cuerpo) : undefined),
    });
    const texto = await res.text();
    return { estado: res.status, datos: texto ? JSON.parse(texto) : null };
  }
  async function sesion(nombre, email, password = "clave-segura-1") {
    await pedir("POST", "/api/auth/registro", { cuerpo: { nombre, email, password } });
    return (await pedir("POST", "/api/auth/login", { cuerpo: { email, password } })).datos.token;
  }
  const loginAdmin = async () =>
    (await pedir("POST", "/api/auth/login", { cuerpo: { email: "admin@club.com", password: "admin-clave-123" } })).datos.token;
  return { pedir, sesion, loginAdmin, cerrar: () => servidor.close() };
}

test("RN-02: las rutas protegidas devuelven 401 sin token o con token inválido; health es pública", async (t) => {
  const s = await levantar();
  t.after(s.cerrar);
  assert.equal((await s.pedir("GET", "/api/health")).estado, 200);
  assert.equal((await s.pedir("GET", "/api/canchas")).estado, 401);
  assert.equal((await s.pedir("GET", "/api/reservas/mias", { token: "falso" })).estado, 401);
});

test("flujo completo: registro, login, ver canchas, reservar, ver mis reservas y cancelar", async (t) => {
  const s = await levantar();
  t.after(s.cerrar);
  const token = await s.sesion("Ana", "ana@mail.com");
  const canchas = (await s.pedir("GET", "/api/canchas", { token })).datos;
  assert.equal(canchas.length, 1);

  const disp = (await s.pedir("GET", `/api/canchas/${canchas[0].id}/disponibilidad?fecha=2026-11-12`, { token })).datos;
  assert.equal(disp.turnos.find((x) => x.hora === 18).estado, "libre");

  const r = await s.pedir("POST", "/api/reservas", { token, cuerpo: { canchaId: canchas[0].id, fecha: "2026-11-12", hora: 18 } });
  assert.equal(r.estado, 201);

  const disp2 = (await s.pedir("GET", `/api/canchas/${canchas[0].id}/disponibilidad?fecha=2026-11-12`, { token })).datos;
  assert.equal(disp2.turnos.find((x) => x.hora === 18).estado, "ocupado");

  const mias = (await s.pedir("GET", "/api/reservas/mias", { token })).datos;
  assert.equal(mias.length, 1);
  assert.equal(mias[0].puedeCancelar, true);

  const c = await s.pedir("POST", `/api/reservas/${r.datos.id}/cancelar`, { token });
  assert.equal(c.estado, 200);
  assert.equal(c.datos.estado, "cancelada");
});

test("RN-04: el segundo jugador recibe 409 con el número de regla", async (t) => {
  const s = await levantar();
  t.after(s.cerrar);
  const a = await s.sesion("Ana", "ana@mail.com");
  const b = await s.sesion("Beto", "beto@mail.com");
  const cuerpo = { canchaId: 1, fecha: "2026-11-12", hora: 18 };
  assert.equal((await s.pedir("POST", "/api/reservas", { token: a, cuerpo })).estado, 201);
  const r = await s.pedir("POST", "/api/reservas", { token: b, cuerpo });
  assert.equal(r.estado, 409);
  assert.equal(r.datos.error.regla, "RN-04");
});

test("RN-04: dos pedidos simultáneos al mismo turno: uno solo gana", async (t) => {
  const s = await levantar();
  t.after(s.cerrar);
  const a = await s.sesion("Ana", "ana@mail.com");
  const b = await s.sesion("Beto", "beto@mail.com");
  const cuerpo = { canchaId: 1, fecha: "2026-11-13", hora: 20 };
  const resultados = await Promise.all([
    s.pedir("POST", "/api/reservas", { token: a, cuerpo }),
    s.pedir("POST", "/api/reservas", { token: b, cuerpo }),
  ]);
  assert.deepEqual(resultados.map((r) => r.estado).sort(), [201, 409]);
});

test("RN-10: otro jugador recibe 403 al cancelar una reserva ajena", async (t) => {
  const s = await levantar();
  t.after(s.cerrar);
  const a = await s.sesion("Ana", "ana@mail.com");
  const b = await s.sesion("Beto", "beto@mail.com");
  const r = await s.pedir("POST", "/api/reservas", { token: a, cuerpo: { canchaId: 1, fecha: "2026-11-12", hora: 18 } });
  const intento = await s.pedir("POST", `/api/reservas/${r.datos.id}/cancelar`, { token: b });
  assert.equal(intento.estado, 403);
  assert.equal(intento.datos.error.regla, "RN-10");
});

test("RN-12 y RN-14: las rutas de administración devuelven 403 a un jugador y funcionan para el admin", async (t) => {
  const s = await levantar();
  t.after(s.cerrar);
  const jugador = await s.sesion("Ana", "ana@mail.com");
  const admin = await s.loginAdmin();
  assert.equal((await s.pedir("POST", "/api/canchas", { token: jugador, cuerpo: { nombre: "Cancha X" } })).estado, 403);
  assert.equal((await s.pedir("GET", "/api/reservas", { token: jugador })).estado, 403);
  const nueva = await s.pedir("POST", "/api/canchas", { token: admin, cuerpo: { nombre: "Cancha 2" } });
  assert.equal(nueva.estado, 201);
  assert.equal((await s.pedir("PATCH", `/api/canchas/${nueva.datos.id}`, { token: admin, cuerpo: { activa: false } })).datos.activa, false);
  assert.equal((await s.pedir("GET", "/api/reservas", { token: admin })).estado, 200);
});

test("validaciones HTTP: JSON inválido, id inválido, ruta inexistente y método no permitido", async (t) => {
  const s = await levantar();
  t.after(s.cerrar);
  const token = await s.sesion("Ana", "ana@mail.com");
  assert.equal((await s.pedir("POST", "/api/reservas", { token, crudo: "{no es json" })).estado, 400);
  assert.equal((await s.pedir("GET", "/api/canchas/abc/disponibilidad?fecha=2026-11-12", { token })).estado, 400);
  assert.equal((await s.pedir("GET", "/api/canchas/1/disponibilidad", { token })).estado, 400); // falta la fecha
  assert.equal((await s.pedir("GET", "/api/no-existe", { token })).estado, 404);
  assert.equal((await s.pedir("DELETE", "/api/canchas", { token })).estado, 405);
});

test("el cuerpo de más de 100 KB se rechaza con 413", async (t) => {
  const s = await levantar();
  t.after(s.cerrar);
  const grande = JSON.stringify({ nombre: "x".repeat(200 * 1024), email: "a@b.com", password: "clave-segura-1" });
  const r = await s.pedir("POST", "/api/auth/registro", { crudo: grande });
  assert.equal(r.estado, 413);
});

test("las respuestas no exponen el hash de la contraseña", async (t) => {
  const s = await levantar();
  t.after(s.cerrar);
  const reg = await s.pedir("POST", "/api/auth/registro", { cuerpo: { nombre: "Ana", email: "ana@mail.com", password: "clave-segura-1" } });
  assert.equal(reg.estado, 201);
  assert.equal(JSON.stringify(reg.datos).includes("passwordHash"), false);
  const token = (await s.pedir("POST", "/api/auth/login", { cuerpo: { email: "ana@mail.com", password: "clave-segura-1" } })).datos.token;
  assert.equal(JSON.stringify((await s.pedir("GET", "/api/me", { token })).datos).includes("passwordHash"), false);
});
