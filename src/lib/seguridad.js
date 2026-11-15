// Contraseñas (scrypt) y tokens firmados (HMAC-SHA256), solo con módulos de Node.
const crypto = require("node:crypto");

function hashPassword(password) {
  const sal = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, sal, 64);
  return `${sal.toString("hex")}:${hash.toString("hex")}`;
}

function verificarPassword(password, guardado) {
  const [salHex, hashHex] = String(guardado).split(":");
  if (!salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const calculado = crypto.scryptSync(password, Buffer.from(salHex, "hex"), esperado.length);
  return crypto.timingSafeEqual(calculado, esperado);
}

function firmar(b64, secreto) {
  return crypto.createHmac("sha256", secreto).update(b64).digest("base64url");
}

function crearToken(datos, secreto, ahoraMs, duracionMs) {
  const b64 = Buffer.from(JSON.stringify({ ...datos, exp: ahoraMs + duracionMs })).toString("base64url");
  return `${b64}.${firmar(b64, secreto)}`;
}

// Devuelve los datos del token si la firma es válida y no venció; si no, null.
function leerToken(token, secreto, ahoraMs) {
  if (typeof token !== "string") return null;
  const partes = token.split(".");
  if (partes.length !== 2) return null;
  const [b64, firma] = partes;
  const esperada = Buffer.from(firmar(b64, secreto));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) return null;
  try {
    const datos = JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));
    return datos.exp > ahoraMs ? datos : null;
  } catch {
    return null;
  }
}

module.exports = { hashPassword, verificarPassword, crearToken, leerToken };
