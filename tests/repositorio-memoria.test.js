const test = require("node:test");
const assert = require("node:assert/strict");
const { crearRepositorioMemoria } = require("../src/repositories/memoria");

test("RN-04: el repositorio no deja crear dos reservas activas en el mismo turno", async () => {
  const repo = crearRepositorioMemoria();
  await repo.crearReserva({ usuarioId: 1, canchaId: 1, fecha: "2026-11-12", hora: 18 });
  await assert.rejects(
    repo.crearReserva({ usuarioId: 2, canchaId: 1, fecha: "2026-11-12", hora: 18 }),
    (e) => e.estado === 409 && e.regla === "RN-04"
  );
});

test("RN-11: una reserva cancelada libera el turno", async () => {
  const repo = crearRepositorioMemoria();
  const r = await repo.crearReserva({ usuarioId: 1, canchaId: 1, fecha: "2026-11-12", hora: 18 });
  await repo.cancelarReserva(r.id);
  const otra = await repo.crearReserva({ usuarioId: 2, canchaId: 1, fecha: "2026-11-12", hora: 18 });
  assert.equal(otra.estado, "activa");
});

test("los datos devueltos son copias: modificarlos no altera el repositorio", async () => {
  const repo = crearRepositorioMemoria();
  const c = await repo.crearCancha({ nombre: "Cancha 1" });
  c.nombre = "Hackeada";
  assert.equal((await repo.buscarCanchaPorId(c.id)).nombre, "Cancha 1");
});
