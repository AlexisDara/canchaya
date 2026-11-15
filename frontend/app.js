// Frontend de CanchaYa. No contiene reglas de negocio: el backend decide y acá solo se muestran los mensajes.
(() => {
  const API = (window.CANCHAYA_API_URL || "http://localhost:3000").replace(/\/$/, "");
  const raiz = document.getElementById("app");
  const estado = {
    token: localStorage.getItem("canchaya_token"),
    usuario: null,
    vista: "reservar",
    modoAuth: "login",
    mensaje: null, // { tipo: "ok" | "error", texto, regla }
    canchas: [],
    canchaId: null,
    fecha: null,
    turnos: null,
    misReservas: null,
    todasReservas: null,
  };

  // ---------- utilidades ----------
  function el(etiqueta, props = {}, ...hijos) {
    const nodo = document.createElement(etiqueta);
    for (const [k, v] of Object.entries(props)) {
      if (k.startsWith("on")) nodo.addEventListener(k.slice(2), v);
      else if (k === "class") nodo.className = v;
      else if (v === true) nodo.setAttribute(k, "");
      else if (v !== false && v != null) nodo.setAttribute(k, v);
    }
    for (const h of hijos.flat()) if (h != null) nodo.append(h.nodeType ? h : document.createTextNode(String(h)));
    return nodo; // los textos se insertan con createTextNode: no se interpreta HTML (evita XSS)
  }

  const fechaLocalAR = (sumarDias = 0) =>
    new Date(Date.now() - 3 * 3600 * 1000 + sumarDias * 86400000).toISOString().slice(0, 10);
  const verFecha = (f) => f.split("-").reverse().join("/");
  const verHora = (h) => `${String(h).padStart(2, "0")}:00`;

  async function api(ruta, { metodo = "GET", cuerpo } = {}) {
    let res;
    try {
      res = await fetch(API + ruta, {
        method: metodo,
        headers: { "Content-Type": "application/json", ...(estado.token ? { Authorization: `Bearer ${estado.token}` } : {}) },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
    } catch {
      throw { mensaje: "No se pudo conectar con el servidor. Probá de nuevo en un momento." };
    }
    const datos = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 401 && estado.token) cerrarSesion("Tu sesión venció. Iniciá sesión de nuevo.");
      throw { mensaje: datos?.error?.mensaje || "Ocurrió un error", regla: datos?.error?.regla };
    }
    return datos;
  }

  const avisar = (tipo, texto, regla) => { estado.mensaje = { tipo, texto, regla }; };
  function cajaMensaje() {
    if (!estado.mensaje) return null;
    const { tipo, texto, regla } = estado.mensaje;
    return el("div", { class: `mensaje ${tipo}`, role: "alert" }, texto, regla ? el("small", {}, ` (${regla})`) : null);
  }

  // ---------- sesión ----------
  function cerrarSesion(texto) {
    localStorage.removeItem("canchaya_token");
    Object.assign(estado, { token: null, usuario: null, canchas: [], turnos: null, misReservas: null, todasReservas: null, vista: "reservar" });
    estado.mensaje = texto ? { tipo: "error", texto } : null;
    pintar();
  }

  async function iniciarSesion(email, password) {
    const r = await api("/api/auth/login", { metodo: "POST", cuerpo: { email, password } });
    estado.token = r.token;
    estado.usuario = r.usuario;
    localStorage.setItem("canchaya_token", r.token);
    estado.mensaje = null;
  }

  // ---------- pantalla de acceso ----------
  function pantallaAuth() {
    const esLogin = estado.modoAuth === "login";
    const form = el(
      "form",
      {
        onsubmit: async (ev) => {
          ev.preventDefault();
          const d = Object.fromEntries(new FormData(ev.target));
          try {
            if (!esLogin) await api("/api/auth/registro", { metodo: "POST", cuerpo: d });
            await iniciarSesion(d.email, d.password);
            await cargarInicio();
          } catch (e) {
            avisar("error", e.mensaje, e.regla);
          }
          pintar();
        },
      },
      !esLogin ? [el("label", { for: "nombre" }, "Nombre"), el("input", { id: "nombre", name: "nombre", required: true, minlength: 2, maxlength: 60 })] : null,
      el("label", { for: "email" }, "Email"),
      el("input", { id: "email", name: "email", type: "email", required: true, autocomplete: "email" }),
      el("label", { for: "password" }, "Contraseña (mínimo 8 caracteres)"),
      el("input", { id: "password", name: "password", type: "password", required: true, minlength: 8, autocomplete: esLogin ? "current-password" : "new-password" }),
      el("button", { class: "principal", type: "submit" }, esLogin ? "Entrar" : "Crear cuenta")
    );
    return el(
      "div",
      { class: "auth" },
      el("h1", {}, "🎾 CanchaYa"),
      el("p", {}, "Reservá tu cancha de pádel en pocos pasos."),
      el(
        "div",
        { class: "tarjeta" },
        el(
          "div",
          { class: "pestanas" },
          el("button", { class: esLogin ? "activa" : "", type: "button", onclick: () => { estado.modoAuth = "login"; estado.mensaje = null; pintar(); } }, "Ingresar"),
          el("button", { class: !esLogin ? "activa" : "", type: "button", onclick: () => { estado.modoAuth = "registro"; estado.mensaje = null; pintar(); } }, "Registrarme")
        ),
        cajaMensaje(),
        form
      )
    );
  }

  // ---------- reservar ----------
  async function cargarTurnos() {
    if (!estado.canchaId || !estado.fecha) return;
    estado.turnos = (await api(`/api/canchas/${estado.canchaId}/disponibilidad?fecha=${estado.fecha}`)).turnos;
  }

  async function reservar(hora) {
    const cancha = estado.canchas.find((c) => c.id === estado.canchaId);
    if (!confirm(`¿Reservar ${cancha.nombre} el ${verFecha(estado.fecha)} a las ${verHora(hora)}?`)) return;
    try {
      await api("/api/reservas", { metodo: "POST", cuerpo: { canchaId: estado.canchaId, fecha: estado.fecha, hora } });
      avisar("ok", `Reserva confirmada: ${cancha.nombre}, ${verFecha(estado.fecha)} a las ${verHora(hora)}.`);
      estado.misReservas = null;
    } catch (e) {
      avisar("error", e.mensaje, e.regla);
    }
    await cargarTurnos().catch(() => {});
    pintar();
  }

  function vistaReservar() {
    if (estado.canchas.length === 0) {
      return el("div", { class: "tarjeta" }, el("p", { class: "vacio" }, "Todavía no hay canchas disponibles."));
    }
    const selector = el(
      "select",
      { id: "cancha", onchange: async (ev) => { estado.canchaId = Number(ev.target.value); estado.mensaje = null; await recargarTurnos(); } },
      estado.canchas.filter((c) => c.activa).map((c) => el("option", { value: c.id, selected: c.id === estado.canchaId }, c.nombre))
    );
    const fecha = el("input", {
      id: "fecha", type: "date", value: estado.fecha, min: fechaLocalAR(), max: fechaLocalAR(14),
      onchange: async (ev) => { estado.fecha = ev.target.value; estado.mensaje = null; await recargarTurnos(); },
    });
    const grilla = !estado.turnos
      ? el("p", { class: "vacio" }, "Elegí una cancha y una fecha para ver los horarios.")
      : el(
          "div",
          { class: "turnos" },
          estado.turnos.map((t) =>
            el(
              "button",
              { class: `turno ${t.estado}`, disabled: t.estado !== "libre", onclick: () => reservar(t.hora), title: `${verHora(t.hora)} – ${t.estado}` },
              verHora(t.hora),
              el("small", {}, t.estado === "libre" ? "Libre" : t.estado === "ocupado" ? "Ocupado" : "Pasado")
            )
          )
        );
    return el(
      "div",
      { class: "tarjeta" },
      el("h2", {}, "Reservar una cancha"),
      cajaMensaje(),
      el("div", { class: "fila" }, el("div", {}, el("label", { for: "cancha" }, "Cancha"), selector), el("div", {}, el("label", { for: "fecha" }, "Fecha"), fecha)),
      grilla,
      el("p", { class: "leyenda" }, "Los turnos duran 1 hora, de 09:00 a 23:00. Podés reservar hasta 14 días antes y tener hasta 3 reservas activas.")
    );
  }

  async function recargarTurnos() {
    try { await cargarTurnos(); } catch (e) { avisar("error", e.mensaje, e.regla); }
    pintar();
  }

  // ---------- mis reservas y lista de reservas ----------
  async function cancelar(reserva) {
    if (!confirm(`¿Cancelar la reserva de ${reserva.canchaNombre} del ${verFecha(reserva.fecha)} a las ${verHora(reserva.hora)}?`)) return;
    try {
      await api(`/api/reservas/${reserva.id}/cancelar`, { metodo: "POST" });
      avisar("ok", "Reserva cancelada. El turno quedó libre.");
      estado.misReservas = null;
      estado.todasReservas = null;
      estado.turnos = null;
    } catch (e) {
      avisar("error", e.mensaje, e.regla);
    }
    await cargarVista();
    pintar();
  }

  function listaReservas(lista, { conUsuario = false } = {}) {
    if (!lista.length) return el("p", { class: "vacio" }, "No hay reservas para mostrar.");
    return lista.map((r) =>
      el(
        "div",
        { class: "item" },
        el(
          "div",
          {},
          el("strong", {}, `${r.canchaNombre} · ${verFecha(r.fecha)} · ${verHora(r.hora)}`),
          " ",
          el("span", { class: `etiqueta ${r.estado}` }, r.estado === "activa" ? "Activa" : "Cancelada"),
          conUsuario ? el("div", { class: "leyenda" }, `Usuario n.º ${r.usuarioId}`) : null
        ),
        r.puedeCancelar
          ? el("button", { onclick: () => cancelar(r) }, "Cancelar")
          : r.estado === "activa"
            ? el("span", { class: "leyenda" }, "Ya no se puede cancelar (menos de 2 h)")
            : null
      )
    );
  }

  const vistaMisReservas = () =>
    el("div", { class: "tarjeta" }, el("h2", {}, "Mis reservas"), cajaMensaje(), estado.misReservas ? listaReservas(estado.misReservas) : el("p", { class: "cargando" }, "Cargando…"));

  // ---------- administración ----------
  function vistaAdmin() {
    const form = el(
      "form",
      {
        onsubmit: async (ev) => {
          ev.preventDefault();
          try {
            await api("/api/canchas", { metodo: "POST", cuerpo: { nombre: new FormData(ev.target).get("nombre") } });
            avisar("ok", "Cancha creada.");
            estado.canchas = await api("/api/canchas");
          } catch (e) { avisar("error", e.mensaje, e.regla); }
          pintar();
        },
      },
      el("label", { for: "nuevaCancha" }, "Nombre de la nueva cancha"),
      el("input", { id: "nuevaCancha", name: "nombre", required: true, minlength: 2, maxlength: 40 }),
      el("button", { class: "principal", type: "submit" }, "Crear cancha")
    );
    const canchas = estado.canchas.map((c) =>
      el(
        "div",
        { class: "item" },
        el("div", {}, el("strong", {}, c.nombre), " ", el("span", { class: `etiqueta ${c.activa ? "activa" : "cancelada"}` }, c.activa ? "Activa" : "Desactivada")),
        el("button", {
          onclick: async () => {
            try {
              await api(`/api/canchas/${c.id}`, { metodo: "PATCH", cuerpo: { activa: !c.activa } });
              estado.canchas = await api("/api/canchas");
              if (!estado.canchas.find((x) => x.id === estado.canchaId && x.activa)) estado.canchaId = estado.canchas.find((x) => x.activa)?.id ?? null;
              estado.turnos = null;
              estado.mensaje = null;
            } catch (e) { avisar("error", e.mensaje, e.regla); }
            pintar();
          },
        }, c.activa ? "Desactivar" : "Activar")
      )
    );
    return el(
      "div",
      {},
      el("div", { class: "tarjeta" }, el("h2", {}, "Canchas"), cajaMensaje(), canchas, form),
      el("div", { class: "tarjeta" }, el("h2", {}, "Todas las reservas"), estado.todasReservas ? listaReservas(estado.todasReservas, { conUsuario: true }) : el("p", { class: "cargando" }, "Cargando…"))
    );
  }

  // ---------- estructura general ----------
  function pantallaPrincipal() {
    const esAdmin = estado.usuario.rol === "admin";
    const boton = (id, texto) =>
      el("button", { class: estado.vista === id ? "activa" : "", onclick: async () => { estado.vista = id; estado.mensaje = null; await cargarVista(); pintar(); } }, texto);
    return el(
      "div",
      {},
      el("header", { class: "barra" }, el("span", { class: "marca" }, "🎾 CanchaYa"), el("span", {}, `${estado.usuario.nombre} (${esAdmin ? "admin" : "jugador"}) `, el("button", { onclick: () => cerrarSesion() }, "Salir"))),
      el("nav", {}, boton("reservar", "Reservar"), boton("mias", "Mis reservas"), esAdmin ? boton("admin", "Administración") : null),
      estado.vista === "reservar" ? vistaReservar() : estado.vista === "mias" ? vistaMisReservas() : vistaAdmin()
    );
  }

  async function cargarVista() {
    try {
      if (estado.vista === "mias") estado.misReservas = await api("/api/reservas/mias");
      if (estado.vista === "admin") {
        estado.canchas = await api("/api/canchas");
        estado.todasReservas = await api("/api/reservas");
      }
      if (estado.vista === "reservar") {
        estado.canchas = await api("/api/canchas");
        if (!estado.canchas.some((c) => c.id === estado.canchaId && c.activa)) estado.canchaId = estado.canchas.find((c) => c.activa)?.id ?? null;
        await cargarTurnos();
      }
    } catch (e) {
      avisar("error", e.mensaje, e.regla);
    }
  }

  async function cargarInicio() {
    estado.fecha = estado.fecha || fechaLocalAR();
    estado.vista = "reservar";
    await cargarVista();
  }

  function pintar() {
    raiz.replaceChildren(estado.usuario ? pantallaPrincipal() : pantallaAuth());
  }

  async function arrancar() {
    if (estado.token) {
      try {
        estado.usuario = await api("/api/me");
        await cargarInicio();
      } catch {
        cerrarSesion();
        return;
      }
    }
    pintar();
  }

  arrancar();
})();
