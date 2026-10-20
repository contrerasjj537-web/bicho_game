// Prueba la API con una "Firestore" falsa en memoria (no necesita internet).
import assert from 'node:assert/strict';
import { crearManejador, CONFIG_INICIAL } from '../netlify/functions/lib/handler.mjs';

function dbFalsa() {
  const cols = {};
  const col = (n) => (cols[n] ??= new Map());
  return {
    collection: (n) => ({
      _n: n,
      doc: (id) => ({
        get: async () => ({ exists: col(n).has(id), id, data: () => structuredClone(col(n).get(id)) }),
        set: async (d, o) => col(n).set(id, o?.merge ? { ...(col(n).get(id) || {}), ...d } : structuredClone(d)),
      }),
      orderBy: (campo, dir) => ({ limit: (k) => ({ get: async () => {
        const f = [...col(n)].map(([id, v]) => ({ id, data: () => structuredClone(v) }));
        f.sort((a, b) => (a.data()[campo] < b.data()[campo] ? -1 : 1) * (dir === 'desc' ? -1 : 1));
        return { docs: f.slice(0, k) };
      } }) }),
    }),
    recursiveDelete: async (c) => col(c._n).clear(),
  };
}

const manejar = crearManejador(dbFalsa(), { secreto: 'secreto-de-prueba' });
const llamar = async (o) => manejar(JSON.stringify(o));
const ok = (r) => { assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };

// 1. Config inicial (sin nada guardado) = datos de fábrica
let r = ok(await llamar({ action: 'config' }));
assert.equal(r.cfg.niveles.length, 5); assert.equal(r.cfg.preguntas.length, 15);

// 2. Login: PIN malo, PIN de fábrica
assert.equal((await llamar({ action: 'login', pin: 'x' })).status, 403);
r = ok(await llamar({ action: 'login', pin: '1234' }));
assert.equal(r.pinPorDefecto, true); const token = r.token;

// 3. Rutas de maestro exigen token
for (const a of ['stats', 'borrar_stats', 'guardar_config', 'cambiar_pin'])
  assert.equal((await llamar({ action: a })).status, 401, a);
assert.equal((await llamar({ action: 'stats', token: token.slice(0, -2) + 'aa' })).status, 401);

// 4. Cambiar PIN
assert.equal((await llamar({ action: 'cambiar_pin', token, pin: '12' })).status, 400);
ok(await llamar({ action: 'cambiar_pin', token, pin: 'nuevoPIN' }));
assert.equal((await llamar({ action: 'login', pin: '1234' })).status, 403);
r = ok(await llamar({ action: 'login', pin: 'nuevoPIN' })); assert.equal(r.pinPorDefecto, false);

// 5. Guardar config y leerla
const cfg = structuredClone(CONFIG_INICIAL); cfg.puntosIniciales = 50;
cfg.preguntas.push({ id: 1, nivel: 1, planta: 'X', emoji: '🌿', texto: 'Duplicada', ops: [['a', ''], ['b', ''], ['c', '']], ok: 2 });
ok(await llamar({ action: 'guardar_config', token, cfg }));
r = ok(await llamar({ action: 'config' }));
assert.equal(r.cfg.puntosIniciales, 50); assert.equal(r.cfg.preguntas.length, 16);
assert.equal(new Set(r.cfg.preguntas.map(q => q.id)).size, 16, 'ids únicos');

// 6. Guardar partidas (dos veces la misma: actualiza, no duplica; inicio no cambia)
const sesion = { uid: 'abc123XYZ', alumno: '  Ana  ', inicio: '2026-10-19T10:00:00Z', estado: 'jugando', nivelMax: 1, puntos: 30,
  resp: [{ n: 1, q: 1, t: 'Pregunta', ok: true, f: '2026-10-19T10:01:00Z' }] };
ok(await llamar({ action: 'partida_guardar', sesion }));
ok(await llamar({ action: 'partida_guardar', sesion: { ...sesion, inicio: '2030-01-01T00:00:00Z', estado: 'completó', puntos: 70, fin: '2026-10-19T10:05:00Z' } }));
ok(await llamar({ action: 'partida_guardar', sesion: { ...sesion, uid: 'otra9999', alumno: 'Luis', inicio: '2026-10-19T11:00:00Z' } }));
assert.equal((await llamar({ action: 'partida_guardar', sesion: { ...sesion, uid: '!!' } })).status, 400);
assert.equal((await llamar({ action: 'partida_guardar', sesion: { ...sesion, alumno: '   ' } })).status, 400);
r = ok(await llamar({ action: 'stats', token }));
assert.equal(r.sesiones.length, 2);
assert.equal(r.sesiones[0].alumno, 'Ana'); assert.equal(r.sesiones[0].estado, 'completó'); assert.equal(r.sesiones[0].puntos, 70);
assert.equal(r.sesiones[0].inicio, '2026-10-19T10:00:00.000Z'); assert.equal(r.sesiones[0].resp[0].ok, true);

// 7. Borrar estadísticas
ok(await llamar({ action: 'borrar_stats', token }));
assert.equal(ok(await llamar({ action: 'stats', token })).sesiones.length, 0);

// 8. Entradas raras
assert.equal((await llamar({ action: 'nada' })).status, 400);
assert.equal((await llamar({ action: 'constructor' })).status, 400);
assert.equal((await manejar('esto no es json')).status, 400);
console.log('✅ Todas las pruebas pasaron');
