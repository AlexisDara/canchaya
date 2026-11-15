# PLAN — CanchaYa

Cada tarea se resuelve en un commit propio y se marca como hecha cuando está verificada.

## Tareas

- [x] **T01** Estructura base del repositorio (`.gitignore`, `.env.example`, `package.json`).
- [x] **T02** Spec con reglas numeradas, `AGENTS.md` y este plan.
- [x] **T03** Errores y utilidades de tiempo (RN-03, RN-05, RN-06) con tests.
- [x] **T04** Repositorio en memoria.
- [ ] **T05** Autenticación: registro y login (RN-01, RN-02) con tests.
- [ ] **T06** Canchas y disponibilidad (RN-12, RN-13) con tests.
- [ ] **T07** Crear reservas (RN-03 a RN-08) con tests.
- [ ] **T08** Cancelar y listar reservas (RN-09, RN-10, RN-11, RN-14) con tests.
- [ ] **T09** API HTTP: rutas, CORS, límite de cuerpo y tests de punta a punta.
- [ ] **T10** Repositorio PostgreSQL y esquema SQL.
- [ ] **T11** Frontend completo (login, registro, reservar, mis reservas, administración).
- [ ] **T12** Informe de pruebas, README y guía de despliegue.
- [ ] **T13** Crear la base de datos en Neon y cargar el esquema.
- [ ] **T14** Publicar el backend en Render.
- [ ] **T15** Publicar el frontend en Netlify.
- [ ] **T16** Probar el sistema desplegado y completar la sección manual del informe de pruebas.

## Orden y dependencias

T03 → T04 → T05 → T06 → T07 → T08 → T09 (todo se prueba en memoria, sin base de datos real).
T10 y T11 pueden hacerse después de T09. T13 a T16 son de despliegue y dependen de T09 a T12.

## Criterios de "terminado" (checklist de entrega)

- [ ] Spec con cada regla numerada
- [ ] `AGENTS.md` con reglas para agentes
- [ ] Todas las tareas marcadas como hechas
- [ ] Todos los tests pasando
- [ ] Un commit por tarea
- [ ] Sin secretos en el repositorio (`.env` afuera)
- [ ] README
- [ ] Link público funcionando
