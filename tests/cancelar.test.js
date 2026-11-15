const test = require("node:test");
const assert = require("node:assert/strict");
const { crearRepositorioMemoria } = require("../src/repositories/memoria");
const { crearServicioReservas } = require("../src/services/reservas");

const AHORA = new Date("2026-11-10T15:00:00-03:00");
const ana = { id: 1, rol: "jugador" };
const beto = { id: 2, rol: "jugador" };
const admin = { id: 9, rol: "admin" };

async function armar() {
  const repo = crearRepositorioMemoria();
  const c1 = await repo.crearCancha({ nombre: "Cancha 1" });
  const reservas = crearServicioReservas({ repo, ahora: () => AHORA });
  return { repo, reservas, c1 };
}
const regla = (n, estado) => (e) => e.regla === n && e.estado === estado;

test("RN-09: se puede cancelar con 2 horas o más de anticipación", async () => {
  const { reservas, repo, c1 } = await armar();
  const r = await repo.crearReserva({ usuarioId: ana.id, canchaId: c1.id, fecha: "2026-11-10", hora: 17 }); // faltan exactamente 2 h
  const cancelada = await reservas.cancelar(ana, r.id);
  assert.equal(cancelada.estado, "cancelada");
});

test("RN-09: con menos de 2 horas ya no se puede cancelar", async () => {
  const { reservas, repo, c1 } = await armar();
  const r = await repo.crearReserva({ usuarioId: ana.id, canchaId: c1.id, fecha: "2026-11-10", hora: 16 }); // falta 1 h
  await assert.rejects(reservas.cancelar(ana, r.id), regla("RN-09", 422));
  const yaEmpezada = await repo.crearReserva({ usuarioId: ana.id, canchaId: c1.id, fecha: "2026-11-10", hora: 15 });
  await assert.rejects(reservas.cancelar(ana, yaEmpezada.id), regla("RN-09", 422));
});

test("RN-10: otro jugador no puede cancelar; el admin sí", async () => {
  const { reservas, repo, c1 } = await armar();
  const r = await repo.crearReserva({ usuarioId: ana.id, canchaId: c1.id, fecha: "2026-11-12", hora: 18 });
  await assert.rejects(reservas.cancelar(beto, r.id), regla("RN-10", 403));
  assert.equal((await reservas.cancelar(admin, r.id)).estado, "cancelada");
});

test("RN-11: cancelar libera el turno para otro jugador", async () => {
  const { reservas, repo, c1 } = await armar();
  const r = await reservas.reservar(ana, { canchaId: c1.id, fecha: "2026-11-12", hora: 18 });
  await reservas.cancelar(ana, r.id);
  const nueva = await reservas.reservar(beto, { canchaId: c1.id, fecha: "2026-11-12", hora: 18 });
  assert.equal(nueva.estado, "activa");
  assert.equal((await repo.buscarReservaPorId(r.id)).estado, "cancelada");
});

test("RN-11: no se puede cancelar dos veces; una reserva inexistente da 404", async () => {
  const { reservas, c1 } = await armar();
  const r = await reservas.reservar(ana, { canchaId: c1.id, fecha: "2026-11-12", hora: 18 });
  await reservas.cancelar(ana, r.id);
  await assert.rejects(reservas.cancelar(ana, r.id), regla("RN-11", 409));
  await assert.rejects(reservas.cancelar(ana, 999), (e) => e.estado === 404);
});

test("RN-14: el jugador ve solo sus reservas; el admin ve todas; el jugador no puede pedir todas", async () => {
  const { reservas, c1 } = await armar();
  await reservas.reservar(ana, { canchaId: c1.id, fecha: "2026-11-12", hora: 18 });
  await reservas.reservar(beto, { canchaId: c1.id, fecha: "2026-11-12", hora: 19 });
  const mias = await reservas.misReservas(ana);
  assert.equal(mias.length, 1);
  assert.equal(mias[0].usuarioId, ana.id);
  assert.equal(mias[0].canchaNombre, "Cancha 1");
  assert.equal(mias[0].puedeCancelar, true);
  assert.equal((await reservas.todas(admin)).length, 2);
  await assert.rejects(reservas.todas(ana), regla("RN-14", 403));
});

test("RN-14: las reservas se devuelven ordenadas por fecha y hora", async () => {
  const { reservas, c1 } = await armar();
  await reservas.reservar(ana, { canchaId: c1.id, fecha: "2026-11-13", hora: 10 });
  await reservas.reservar(ana, { canchaId: c1.id, fecha: "2026-11-12", hora: 20 });
  const horas = (await reservas.misReservas(ana)).map((r) => `${r.fecha} ${r.hora}`);
  assert.deepEqual(horas, ["2026-11-12 20", "2026-11-13 10"]);
});
