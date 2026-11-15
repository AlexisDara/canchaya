// Utilidades de fecha y hora. El club está en Buenos Aires: UTC-3 todo el año (sin horario de verano).
const OFFSET_HORAS = 3;
const HORA_PRIMER_TURNO = 9;
const HORA_ULTIMO_TURNO = 22;
const MS_POR_HORA = 60 * 60 * 1000;
const MS_POR_DIA = 24 * MS_POR_HORA;

// Devuelve { anio, mes, dia } si "fecha" es AAAA-MM-DD y un día real del calendario; si no, null.
function parsearFecha(fecha) {
  if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  if (f.getUTCFullYear() !== anio || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== dia) return null;
  return { anio, mes, dia };
}

// RN-03: hora entera entre 9 y 22.
function esHoraDeTurnoValida(hora) {
  return Number.isInteger(hora) && hora >= HORA_PRIMER_TURNO && hora <= HORA_ULTIMO_TURNO;
}

// Instante exacto (Date) en que empieza el turno de esa fecha y hora, en hora de Buenos Aires.
function inicioDelTurno(fecha, hora) {
  const p = parsearFecha(fecha);
  return new Date(Date.UTC(p.anio, p.mes - 1, p.dia, hora + OFFSET_HORAS));
}

// Fecha de "hoy" en Buenos Aires (AAAA-MM-DD) para un instante dado.
function fechaLocal(ahora) {
  return new Date(ahora.getTime() - OFFSET_HORAS * MS_POR_HORA).toISOString().slice(0, 10);
}

// Cuántos días calendario faltan desde hoy (en Buenos Aires) hasta "fecha". Hoy = 0.
function diasDesdeHoy(fecha, ahora) {
  const f = parsearFecha(fecha);
  const h = parsearFecha(fechaLocal(ahora));
  return Math.round((Date.UTC(f.anio, f.mes - 1, f.dia) - Date.UTC(h.anio, h.mes - 1, h.dia)) / MS_POR_DIA);
}

module.exports = {
  HORA_PRIMER_TURNO,
  HORA_ULTIMO_TURNO,
  MS_POR_HORA,
  parsearFecha,
  esHoraDeTurnoValida,
  inicioDelTurno,
  fechaLocal,
  diasDesdeHoy,
};
