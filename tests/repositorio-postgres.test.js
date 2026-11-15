// Pruebas con un "pool" falso: verifican el mapeo de errores y que las consultas usen parámetros.
// NO prueban que el SQL sea válido: eso se verifica contra una base real (ver docs/INFORME_DE_PRUEBAS.md).
const test = require("node:test");
const assert = require("node:assert/strict");
const { crearRepositorioPostgres } = require("../src/repositories/postgres");

function poolFalso(respuesta = () => ({ rows: [] })) {
  const llamadas = [];
  return { llamadas, query: async (texto, valores) => (llamadas.push({ texto, valores }), respuesta(texto, valores)) };
}

test("RN-04: la violación del índice único (23505) se traduce a conflicto 409", async () => {
  const pool = poolFalso(() => {
    throw Object.assign(new Error("duplicate key"), { code: "23505" });
  });
  const repo = crearRepositorioPostgres("x", { pool });
  await assert.rejects(
    repo.crearReserva({ usuarioId: 1, canchaId: 1, fecha: "2026-11-12", hora: 18 }),
    (e) => e.estado === 409 && e.regla === "RN-04"
  );
});

test("otros errores de la base no se disfrazan de conflicto", async () => {
  const pool = poolFalso(() => {
    throw Object.assign(new Error("conexión caída"), { code: "ECONNRESET" });
  });
  const repo = crearRepositorioPostgres("x", { pool });
  await assert.rejects(repo.crearReserva({ usuarioId: 1, canchaId: 1, fecha: "2026-11-12", hora: 18 }), /conexión caída/);
});

test("los datos del usuario viajan como parámetros y nunca dentro del texto SQL", async () => {
  const pool = poolFalso();
  const repo = crearRepositorioPostgres("x", { pool });
  const malicioso = "'; DROP TABLE reservas; --";
  await repo.buscarUsuarioPorEmail(malicioso);
  await repo.crearCancha({ nombre: malicioso });
  await repo.crearReserva({ usuarioId: 1, canchaId: 1, fecha: malicioso, hora: 10 }).catch(() => {});
  assert.ok(pool.llamadas.length >= 3);
  for (const { texto, valores } of pool.llamadas) {
    assert.equal(texto.includes("DROP TABLE"), false);
    assert.match(texto, /\$1/);
    assert.ok(Array.isArray(valores));
  }
});

test("creadaEn se devuelve como texto ISO", async () => {
  const fecha = new Date("2026-11-10T18:00:00Z");
  const pool = poolFalso(() => ({ rows: [{ id: 1, estado: "activa", creadaEn: fecha }] }));
  const repo = crearRepositorioPostgres("x", { pool });
  assert.equal((await repo.buscarReservaPorId(1)).creadaEn, "2026-11-10T18:00:00.000Z");
});
