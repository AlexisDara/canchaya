// Errores de la aplicación. Cada uno lleva el estado HTTP, un código y, si corresponde, la regla de la spec.
class ErrorApp extends Error {
  constructor(estado, codigo, mensaje, regla = null) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
    this.regla = regla;
  }
}

const validacion = (mensaje, regla = null) => new ErrorApp(400, "VALIDACION", mensaje, regla);
const noAutenticado = (mensaje = "Necesitás iniciar sesión", regla = "RN-02") =>
  new ErrorApp(401, "NO_AUTENTICADO", mensaje, regla);
const prohibido = (mensaje, regla = null) => new ErrorApp(403, "PROHIBIDO", mensaje, regla);
const noEncontrado = (mensaje) => new ErrorApp(404, "NO_ENCONTRADO", mensaje);
const conflicto = (mensaje, regla = null) => new ErrorApp(409, "CONFLICTO", mensaje, regla);
const reglaNegocio = (mensaje, regla) => new ErrorApp(422, "REGLA_DE_NEGOCIO", mensaje, regla);

module.exports = { ErrorApp, validacion, noAutenticado, prohibido, noEncontrado, conflicto, reglaNegocio };
