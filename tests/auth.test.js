const test = require("node:test");
const assert = require("node:assert/strict");
const { crearRepositorioMemoria } = require("../src/repositories/memoria");
const { crearServicioAuth, DURACION_TOKEN_MS } = require("../src/services/auth");

function armar(inicio = "2026-11-10T12:00:00-03:00") {
  let ahora = new Date(inicio);
  const repo = crearRepositorioMemoria();
  const auth = crearServicioAuth({ repo, secreto: "secreto-de-prueba", ahora: () => ahora });
  return { repo, auth, avanzar: (ms) => (ahora = new Date(ahora.getTime() + ms)) };
}
const datos = { nombre: "Ana Pérez", email: "Ana@Mail.com", password: "clave-segura-1" };

test("RN-01: registra un usuario, normaliza el email y no expone la contraseña", async () => {
  const { auth, repo } = armar();
  const u = await auth.registrar(datos);
  assert.equal(u.email, "ana@mail.com");
  assert.equal(u.rol, "jugador");
  assert.equal(u.passwordHash, undefined);
  const guardado = await repo.buscarUsuarioPorEmail("ana@mail.com");
  assert.notEqual(guardado.passwordHash, datos.password);
});

test("RN-01: rechaza nombre corto, email inválido y contraseña corta", async () => {
  const { auth } = armar();
  for (const malo of [{ nombre: "A" }, { email: "sin-arroba" }, { password: "1234567" }, { nombre: 5 }, { password: null }]) {
    await assert.rejects(auth.registrar({ ...datos, ...malo }), (e) => e.estado === 400 && e.regla === "RN-01");
  }
});

test("RN-01: el email es único sin distinguir mayúsculas", async () => {
  const { auth } = armar();
  await auth.registrar(datos);
  await assert.rejects(
    auth.registrar({ ...datos, email: "ANA@mail.COM" }),
    (e) => e.estado === 409 && e.regla === "RN-01"
  );
});

test("RN-02: login correcto devuelve un token que autentica al usuario", async () => {
  const { auth } = armar();
  await auth.registrar(datos);
  const { token, usuario } = await auth.login({ email: "ana@mail.com", password: datos.password });
  assert.equal(usuario.nombre, "Ana Pérez");
  assert.equal((await auth.autenticar(token)).email, "ana@mail.com");
});

test("RN-02: login incorrecto da el mismo mensaje con email inexistente o contraseña errónea", async () => {
  const { auth } = armar();
  await auth.registrar(datos);
  const e1 = await auth.login({ email: "ana@mail.com", password: "otra-clave-123" }).catch((e) => e);
  const e2 = await auth.login({ email: "nadie@mail.com", password: "otra-clave-123" }).catch((e) => e);
  assert.equal(e1.estado, 401);
  assert.equal(e1.message, e2.message);
});

test("RN-02: el token vence a las 8 horas", async () => {
  const { auth, avanzar } = armar();
  await auth.registrar(datos);
  const { token } = await auth.login({ email: "ana@mail.com", password: datos.password });
  avanzar(DURACION_TOKEN_MS - 1000);
  assert.ok(await auth.autenticar(token));
  avanzar(2000);
  await assert.rejects(auth.autenticar(token), (e) => e.estado === 401);
});

test("RN-02: un token manipulado o inventado se rechaza", async () => {
  const { auth } = armar();
  await auth.registrar(datos);
  const { token } = await auth.login({ email: "ana@mail.com", password: datos.password });
  const [cuerpo, firma] = token.split(".");
  const falso = Buffer.from(JSON.stringify({ sub: 1, rol: "admin", exp: 9e15 })).toString("base64url");
  for (const t of [`${falso}.${firma}`, `${cuerpo}.firma-falsa`, "basura", "", undefined, `${cuerpo}.`]) {
    await assert.rejects(auth.autenticar(t), (e) => e.estado === 401, String(t));
  }
});
