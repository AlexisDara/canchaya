const test = require("node:test");
const assert = require("node:assert/strict");
const { crearRepositorioMemoria } = require("../src/repositories/memoria");
const { crearServicioCanchas } = require("../src/services/canchas");

const admin = { id: 1, rol: "admin" };
const jugador = { id: 2, rol: "jugador" };

function armar() {
  const ahora = new Date("2026-11-10T15:00:00-03:00");
  const repo = crearRepositorioMemoria();
  return { repo, canchas: crearServicioCanchas({ repo, ahora: () => ahora }) };
}

test("RN-12: un admin crea canchas y un jugador no puede", async () => {
  const { canchas } = armar();
  const c = await canchas.crear(admin, { nombre: " Cancha 1 " });
  assert.equal(c.nombre, "Cancha 1");
  assert.equal(c.activa, true);
  await assert.rejects(canchas.crear(jugador, { nombre: "Cancha 2" }), (e) => e.estado === 403 && e.regla === "RN-12");
  await assert.rejects(canchas.crear(admin, { nombre: "X" }), (e) => e.estado === 400);
});

test("RN-12: una cancha desactivada no aparece para los jugadores pero sí para el admin", async () => {
  const { canchas } = armar();
  const a = await canchas.crear(admin, { nombre: "Cancha A" });
  await canchas.crear(admin, { nombre: "Cancha B" });
  await canchas.cambiarEstado(admin, a.id, { activa: false });
  assert.deepEqual((await canchas.listar(jugador)).map((c) => c.nombre), ["Cancha B"]);
  assert.equal((await canchas.listar(admin)).length, 2);
});

test("RN-12: solo el admin cambia el estado y el valor debe ser booleano", async () => {
  const { canchas } = armar();
  const c = await canchas.crear(admin, { nombre: "Cancha A" });
  await assert.rejects(canchas.cambiarEstado(jugador, c.id, { activa: false }), (e) => e.estado === 403);
  await assert.rejects(canchas.cambiarEstado(admin, c.id, { activa: "no" }), (e) => e.estado === 400);
  await assert.rejects(canchas.cambiarEstado(admin, 999, { activa: false }), (e) => e.estado === 404);
});

test("RN-13: la disponibilidad marca los turnos como libre, ocupado o pasado", async () => {
  const { canchas, repo } = armar();
  const c = await canchas.crear(admin, { nombre: "Cancha 1" });
  await repo.crearReserva({ usuarioId: 2, canchaId: c.id, fecha: "2026-11-10", hora: 18 });
  const d = await canchas.disponibilidad(c.id, "2026-11-10"); // ahora son las 15:00
  const estado = (h) => d.turnos.find((t) => t.hora === h).estado;
  assert.equal(d.turnos.length, 14); // 9 a 22
  assert.equal(estado(9), "pasado");
  assert.equal(estado(15), "pasado"); // el turno de las 15 ya empezó
  assert.equal(estado(16), "libre");
  assert.equal(estado(18), "ocupado");
});

test("RN-13: valida la fecha y que la cancha exista", async () => {
  const { canchas } = armar();
  const c = await canchas.crear(admin, { nombre: "Cancha 1" });
  await assert.rejects(canchas.disponibilidad(c.id, "2026-02-30"), (e) => e.estado === 400);
  await assert.rejects(canchas.disponibilidad(999, "2026-11-10"), (e) => e.estado === 404);
});
