const test = require("node:test");
const assert = require("node:assert/strict");
const t = require("../src/lib/tiempo");

test("RN-03: acepta horas enteras de 9 a 22 y rechaza el resto", () => {
  for (const h of [9, 15, 22]) assert.equal(t.esHoraDeTurnoValida(h), true);
  for (const h of [8, 23, 0, 9.5, "10", null, undefined, NaN]) assert.equal(t.esHoraDeTurnoValida(h), false);
});

test("parsearFecha acepta días reales y rechaza formatos o fechas inexistentes", () => {
  assert.deepEqual(t.parsearFecha("2026-11-10"), { anio: 2026, mes: 11, dia: 10 });
  for (const f of ["2026-02-30", "2026-13-01", "10/11/2026", "2026-1-5", "", null, 20261110]) {
    assert.equal(t.parsearFecha(f), null, String(f));
  }
});

test("inicioDelTurno convierte la hora de Buenos Aires (UTC-3) a un instante exacto", () => {
  assert.equal(t.inicioDelTurno("2026-11-10", 18).toISOString(), "2026-11-10T21:00:00.000Z");
  assert.equal(t.inicioDelTurno("2026-11-10", 22).toISOString(), "2026-11-11T01:00:00.000Z");
});

test("fechaLocal: a las 22:00 de Buenos Aires sigue siendo el mismo día (no salta al siguiente por UTC)", () => {
  const ahora = new Date("2026-11-10T22:00:00-03:00"); // 01:00 UTC del día 11
  assert.equal(t.fechaLocal(ahora), "2026-11-10");
});

test("RN-06: diasDesdeHoy cuenta días calendario en hora de Buenos Aires", () => {
  const ahora = new Date("2026-11-10T22:30:00-03:00");
  assert.equal(t.diasDesdeHoy("2026-11-10", ahora), 0);
  assert.equal(t.diasDesdeHoy("2026-11-11", ahora), 1);
  assert.equal(t.diasDesdeHoy("2026-11-24", ahora), 14);
  assert.equal(t.diasDesdeHoy("2026-11-25", ahora), 15);
  assert.equal(t.diasDesdeHoy("2026-11-09", ahora), -1);
});
