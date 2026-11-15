-- Esquema de CanchaYa (PostgreSQL). Es idempotente: se puede ejecutar más de una vez.

CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        VARCHAR(60)  NOT NULL,
  email         VARCHAR(120) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  rol           VARCHAR(10)  NOT NULL DEFAULT 'jugador' CHECK (rol IN ('jugador', 'admin')),
  creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS canchas (
  id     SERIAL PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL,
  activa BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS reservas (
  id         SERIAL PRIMARY KEY,
  usuario_id INTEGER     NOT NULL REFERENCES usuarios (id),
  cancha_id  INTEGER     NOT NULL REFERENCES canchas (id),
  fecha      DATE        NOT NULL,
  hora       SMALLINT    NOT NULL CHECK (hora BETWEEN 9 AND 22),
  estado     VARCHAR(10) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'cancelada')),
  creada_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RN-04: una cancha no puede tener dos reservas activas en el mismo turno.
-- Se garantiza en la base de datos para que dos pedidos simultáneos no puedan duplicar el turno.
CREATE UNIQUE INDEX IF NOT EXISTS reservas_turno_activo_unico
  ON reservas (cancha_id, fecha, hora)
  WHERE estado = 'activa';

CREATE INDEX IF NOT EXISTS reservas_usuario_idx ON reservas (usuario_id);
