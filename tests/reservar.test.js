const test = require("node:test");
const assert = require("node:assert/strict");
const { crearRepositorioMemoria } = require("../src/repositories/memoria");
const { crearServicioReservas } = require("../src/services/reservas");

// "Ahora" fijo: martes 10/11/2026, 15:00 en Buenos Aires.
const AHORA = new Date("2026-11-10T15:00:00-03:00");
const ana = { id: 1, rol: "jugador" };
const beto = { id: 2, rol: "jugador" };

async function armar() {
  const repo = crearRepositorioMemoria();
  const c1 = await repo.crearCancha({ nombre: "Cancha 1" });
  const c2 = await repo.crearCancha({ nombre: "Cancha 2" });
  const reservas = crearServicioReservas({ repo, ahora: () => AHORA });
  return { repo, reservas, c1, c2 };
}
const regla = (n, estado) => (e) => e.regla === n && (estado ? e.estado === estado : true);

test("reserva válida: queda activa y a nombre del jugador", async () => {
  const { reservas, c1 } = await armar();
  const r = await reservas.reservar(ana, { canchaId: c1.id, fecha: "2026-11-12", hora: 18 });
  assert.equal(r.estado, "activa");
  assert.equal(r.usuarioId, ana.id);
});

test("RN-03: rechaza horas fuera del rango o no enteras", async () => {
  const { reservas, c1 } = await armar();
  for (const hora of [8, 23, 18.5, "18", null, undefined]) {
    await assert.rejects(reservas.reservar(ana, { canchaId: c1.id, fecha: "2026-11-12", hora }), regla("RN-03", 400), String(hora));
  }
});

test("validación: fecha inválida o cancha inexistente", async () => {
  const { reservas, c1 } = await armar();
  await assert.rejects(reservas.reservar(ana, { canchaId: c1.id, fecha: "2026-02-30", hora: 18 }), (e) => e.estado === 400);
  await assert.rejects(reservas.reservar(ana, { canchaId: "1", fecha: "2026-11-12", hora: 18 }), (e) => e.estado === 400);
  await assert.rejects(reservas.reservar(ana, { canchaId: 999, fecha: "2026-11-12", hora: 18 }), (e) => e.estado === 404);
});

test("RN-04: el mismo turno en la misma cancha no se puede reservar dos veces", async () => {
  const { reservas, c1 } = await armar();
  await reservas.reservar(ana, { canchaId: c1.id, fecha: "2026-11-12", hora: 18 });
  await assert.rejects(reservas.reservar(beto, { canchaId: c1.id, fecha: "2026-11-12", hora: 18 }), regla("RN-04", 409));
});

test("RN-04: el mismo horario en otra cancha sí se puede reservar", async () => {
  const { reservas, c1, c2 } = await armar();
  await reservas.reservar(ana, { canchaId: c1.id, fecha: "2026-11-12", hora: 18 });
  const r = await reservas.reservar(beto, { canchaId: c2.id, fecha: "2026-11-12", hora: 18 });
  assert.equal(r.estado, "activa");
});

test("RN-05: no se reserva un turno que ya empezó ni uno pasado", async () => {
  const { reservas, c1 } = await armar();
  await assert.rejects(reservas.reservar(ana, { canchaId: c1.id, fecha: "2026-11-10", hora: 15 }), regla("RN-05", 422));
  await assert.rejects(reservas.reservar(ana, { canchaId: c1.id, fecha: "2026-11-09", hora: 20 }), regla("RN-05", 422));
  const ok = await reservas.reservar(ana, { canchaId: c1.id, fecha: "2026-11-10", hora: 16 });
  assert.equal(ok.hora, 16);
});

test("RN-06: hasta 14 días de anticipación sí; 15 días no", async () => {
  const { reservas, c1 } = await armar();
  const ok = await reservas.reservar(ana, { canchaId: c1.id, fecha: "2026-11-24", hora: 10 });
  assert.equal(ok.fecha, "2026-11-24");
  await assert.rejects(reservas.reservar(ana, { canchaId: c1.id, fecha: "2026-11-25", hora: 10 }), regla("RN-06", 422));
});

test("RN-07: máximo 3 reservas activas futuras por jugador", async () => {
  const { reservas, c1 } = await armar();
  for (const hora of [10, 11, 12]) await reservas.reservar(ana, { canchaId: c1.id, fecha: "2026-11-12", hora });
  await assert.rejects(reservas.reservar(ana, { canchaId: c1.id, fecha: "2026-11-12", hora: 13 }), regla("RN-07", 422));
  // otro jugador no se ve afectado
  assert.ok(await reservas.reservar(beto, { canchaId: c1.id, fecha: "2026-11-12", hora: 13 }));
});

test("RN-07: las reservas canceladas o ya jugadas no cuentan para el límite", async () => {
  const { reservas, repo, c1 } = await armar();
  const vieja = await repo.crearReserva({ usuarioId: ana.id, canchaId: c1.id, fecha: "2026-11-05", hora: 10 }); // pasada
  const cancelada = await repo.crearReserva({ usuarioId: ana.id, canchaId: c1.id, fecha: "2026-11-12", hora: 10 });
  await repo.cancelarReserva(cancelada.id);
  await repo.crearReserva({ usuarioId: ana.id, canchaId: c1.id, fecha: "2026-11-12", hora: 11 });
  await repo.crearReserva({ usuarioId: ana.id, canchaId: c1.id, fecha: "2026-11-12", hora: 12 });
  assert.ok(vieja);
  assert.ok(await reservas.reservar(ana, { canchaId: c1.id, fecha: "2026-11-12", hora: 13 })); // es la tercera activa futura
});

test("RN-08: un jugador no puede reservar el mismo horario en dos canchas", async () => {
  const { reservas, c1, c2 } = await armar();
  await reservas.reservar(ana, { canchaId: c1.id, fecha: "2026-11-12", hora: 18 });
  await assert.rejects(reservas.reservar(ana, { canchaId: c2.id, fecha: "2026-11-12", hora: 18 }), regla("RN-08", 409));
});

test("RN-12: no se puede reservar en una cancha desactivada", async () => {
  const { reservas, repo, c1 } = await armar();
  await repo.actualizarCancha(c1.id, { activa: false });
  await assert.rejects(reservas.reservar(ana, { canchaId: c1.id, fecha: "2026-11-12", hora: 18 }), regla("RN-12", 422));
});
