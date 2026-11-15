// Punto de entrada: lee la configuración del entorno, elige el repositorio y levanta el servidor.
const { crearApp } = require("./http/app");
const { crearRepositorioMemoria } = require("./repositories/memoria");

async function main() {
  const puerto = Number(process.env.PORT) || 3000;
  const produccion = process.env.NODE_ENV === "production";
  const secreto = process.env.TOKEN_SECRET;
  if (!secreto) {
    if (produccion) throw new Error("Falta la variable de entorno TOKEN_SECRET");
    console.warn("Aviso: TOKEN_SECRET no está definido. Usando un secreto de desarrollo (no usar en producción).");
  }

  let repo;
  if (process.env.DATABASE_URL) {
    repo = require("./repositories/postgres").crearRepositorioPostgres(process.env.DATABASE_URL);
  } else {
    if (produccion) throw new Error("Falta la variable de entorno DATABASE_URL");
    console.warn("Aviso: DATABASE_URL no está definido. Usando base de datos en memoria (se borra al reiniciar).");
    repo = crearRepositorioMemoria();
  }
  await repo.iniciar();

  const app = crearApp({
    repo,
    secreto: secreto || "secreto-solo-para-desarrollo",
    corsOrigin: process.env.CORS_ORIGIN || "*",
  });

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const creado = await app.auth.asegurarAdmin({
      nombre: process.env.ADMIN_NAME || "Administrador",
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
    if (creado) console.log(`Administrador creado: ${creado.email}`);
  }

  // Si no hay canchas, se cargan tres de ejemplo.
  if ((await repo.listarCanchas()).length === 0) {
    for (const nombre of ["Cancha 1", "Cancha 2", "Cancha 3"]) await repo.crearCancha({ nombre });
  }

  app.crearServidor().listen(puerto, () => console.log(`CanchaYa escuchando en el puerto ${puerto}`));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
