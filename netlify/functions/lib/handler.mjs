// Lógica de la API del Bichito (equivalente a api.php, pero con Firestore).
// Recibe un objeto "db" compatible con Firestore para poder probarlo sin internet.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/* ---------- datos iniciales (los mismos de database.sql) ---------- */
const NIVELES = [['La pradera', 'pradera'], ['El bosque', 'bosque'], ['El atardecer', 'atardecer'], ['La noche', 'noche'], ['La montaña nevada', 'nieve']]
  .map(([nombre, fondo]) => ({ nombre, fondo, img: '', numPreguntas: 3, suma: 10, resta: 5 }));
const P = (nivel, planta, emoji, texto, ops, ok) => ({ nivel, planta, emoji, texto, ops, ok });
const PREGUNTAS = [
  P(1, 'Manzanilla', '🌼', '¡Encontraste manzanilla! ¿Cuántas flores hay? 🌼🌼🌼', [['2', '2️⃣'], ['3', '3️⃣'], ['4', '4️⃣']], 1),
  P(1, 'Sábila', '🌵', 'La sábila es verde. ¿Cuál de estas cosas también es verde?', [['La rana', '🐸'], ['El sol', '☀️'], ['La fresa', '🍓']], 0),
  P(1, 'Menta', '🌿', 'Las plantas necesitan algo para crecer. ¿Qué es?', [['Zapato', '👟'], ['Agua', '💧'], ['Carro', '🚗']], 1),
  P(2, 'Lavanda', '🪻', 'La lavanda huele muy rico. ¿Con qué parte del cuerpo olemos?', [['La nariz', '👃'], ['El pie', '🦶'], ['La mano', '✋']], 0),
  P(2, 'Albahaca', '🌱', 'La albahaca es una planta pequeña. ¿Cuál de estos es más grande?', [['Un árbol', '🌳'], ['Una hormiga', '🐜'], ['Una semilla', '🌰']], 0),
  P(2, 'Caléndula', '🏵️', 'La caléndula es de color naranja. ¿Cuál es naranja?', [['La naranja', '🍊'], ['La uva', '🍇'], ['La hoja', '🍃']], 0),
  P(3, 'Romero', '🌿', 'El romero crece con el sol. ¿Qué vemos en el cielo de día?', [['La luna', '🌙'], ['El sol', '☀️'], ['Una estrella', '⭐']], 1),
  P(3, 'Yerbabuena', '🍃', 'Cuenta las hojas. ¿Cuántas hojas hay? 🍃🍃', [['1', '1️⃣'], ['2', '2️⃣'], ['5', '5️⃣']], 1),
  P(3, 'Eucalipto', '🌳', 'El eucalipto es un árbol alto. ¿Quién vive en los árboles?', [['Un pez', '🐟'], ['Un pájaro', '🐦'], ['Una vaca', '🐄']], 1),
  P(4, 'Toronjil', '🌿', 'Es de noche. ¿Qué vemos en el cielo de noche?', [['La luna', '🌙'], ['El sol', '☀️'], ['Un carro', '🚗']], 0),
  P(4, 'Valeriana', '🌸', 'La valeriana ayuda a dormir. ¿Qué hacemos de noche?', [['Dormir', '😴'], ['Correr', '🏃'], ['Comer helado', '🍦']], 0),
  P(4, 'Orégano', '🌿', 'Cuenta las estrellas. ¿Cuántas estrellas hay? ⭐⭐⭐⭐', [['3', '3️⃣'], ['4', '4️⃣'], ['5', '5️⃣']], 1),
  P(5, 'Jengibre', '🌱', 'La nieve es muy fría. ¿Qué nos ponemos cuando hace frío?', [['Un abrigo', '🧥'], ['Sandalias', '🩴'], ['Gafas de sol', '🕶️']], 0),
  P(5, 'Tomillo', '🌿', 'El tomillo es verde. ¿De qué color es la nieve?', [['Blanca', '⚪'], ['Roja', '🔴'], ['Negra', '⚫']], 0),
  P(5, 'Ruda', '🌿', '¡Última planta! ¿Cuántos deditos tiene una mano?', [['3', '3️⃣'], ['5', '5️⃣'], ['8', '8️⃣']], 1),
].map((q, i) => ({ id: i + 1, ...q }));
export const CONFIG_INICIAL = { puntosIniciales: 30, niveles: NIVELES, preguntas: PREGUNTAS };

/* ---------- utilidades ---------- */
class Fallo extends Error { constructor(msg, codigo = 400) { super(msg); this.codigo = codigo; } }
const ent = (v, min, max, def = 0) => (v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v))) ? Math.max(min, Math.min(max, Math.trunc(Number(v)))) : def;
const txt = (v, n) => Array.from(String(v ?? '').trim()).slice(0, n).join('');
const iso = (v) => { const t = v ? Date.parse(String(v)) : NaN; return Number.isNaN(t) ? null : new Date(t).toISOString(); };

/* ---------- sesión del maestro: token firmado, dura 8 horas ---------- */
const firmar = (e, secreto) => createHmac('sha256', secreto).update(String(e)).digest('hex');
export function tokenNuevo(secreto) { const e = Math.floor(Date.now() / 1000) + 8 * 3600; return `${e}.${firmar(e, secreto)}`; }
export function tokenOk(t, secreto) {
  if (typeof t !== 'string' || !t.includes('.')) return false;
  const [e, h] = t.split(/\.(.+)/);
  if (!/^\d+$/.test(e) || Number(e) <= Date.now() / 1000) return false;
  const esperado = Buffer.from(firmar(e, secreto)), recibido = Buffer.from(h || '');
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}

/* ---------- PIN con hash (scrypt, viene incluido en Node) ---------- */
export function hashPin(pin) { const sal = randomBytes(16).toString('hex'); return `${sal}:${scryptSync(pin, sal, 32).toString('hex')}`; }
export function pinOk(pin, guardado) {
  const [sal, h] = String(guardado).split(':'); if (!sal || !h) return false;
  const a = Buffer.from(h, 'hex'), b = scryptSync(pin, sal, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ---------- el manejador ---------- */
export function crearManejador(db, { secreto }) {
  const docConfig = db.collection('bichito').doc('config');
  const docAdmin = db.collection('bichito').doc('admin');
  const partidas = db.collection('partidas');
  const admin = (inp) => { if (!tokenOk(inp.token, secreto)) throw new Fallo('Sesión vencida. Entra de nuevo con el PIN.', 401); };

  const acciones = {
    /* Público: el juego lee niveles y preguntas */
    async config() {
      const d = await docConfig.get();
      return { cfg: d.exists ? d.data() : CONFIG_INICIAL };
    },

    /* Público: el juego guarda la partida de un niño */
    async partida_guardar(inp) {
      const s = inp.sesion;
      if (!s || typeof s !== 'object') throw new Fallo('Datos no válidos');
      const uid = String(s.uid ?? '');
      if (!/^[A-Za-z0-9]{6,40}$/.test(uid)) throw new Fallo('Identificador no válido');
      const alumno = txt(s.alumno, 40);
      if (!alumno) throw new Fallo('Falta el nombre');
      const estado = ['jugando', 'perdió', 'completó'].includes(s.estado) ? s.estado : 'jugando';
      const ahora = new Date().toISOString();
      const resp = (Array.isArray(s.resp) ? s.resp : []).slice(0, 500).filter(r => r && typeof r === 'object')
        .map(r => ({ n: ent(r.n, 1, 99, 1), q: ent(r.q, 0, 2147483647), t: txt(r.t, 120), ok: !!r.ok, f: iso(r.f) || ahora }));
      const ref = partidas.doc(uid);
      const previa = await ref.get();
      await ref.set({
        alumno, estado, resp,
        inicio: previa.exists ? previa.data().inicio : (iso(s.inicio) || ahora),
        fin: iso(s.fin), nivelMax: ent(s.nivelMax, 1, 99, 1), puntos: ent(s.puntos, 0, 100000),
      });
      return {};
    },

    /* Maestro */
    async login(inp) {
      const d = await docAdmin.get();
      const h = d.exists ? d.data().pin_hash : null;
      const pin = String(inp.pin ?? '');
      const ok = h ? pinOk(pin, h) : pin === '1234';   // sin PIN guardado: vale 1234
      if (!ok) { await new Promise(r => setTimeout(r, 1000)); throw new Fallo('PIN incorrecto', 403); }
      return { token: tokenNuevo(secreto), pinPorDefecto: !h };
    },

    async cambiar_pin(inp) {
      admin(inp);
      const pin = String(inp.pin ?? '');
      const n = Array.from(pin).length;
      if (n < 4 || n > 30) throw new Fallo('El PIN debe tener entre 4 y 30 caracteres');
      await docAdmin.set({ pin_hash: hashPin(pin) }, { merge: true });
      return {};
    },

    async guardar_config(inp) {
      admin(inp);
      const c = inp.cfg;
      if (!c || !Array.isArray(c.niveles) || !c.niveles.length || !Array.isArray(c.preguntas)) throw new Fallo('Datos no válidos');
      const niveles = c.niveles.slice(0, 20).map((l, i) => ({
        nombre: txt(l?.nombre ?? `Nivel ${i + 1}`, 60),
        fondo: txt(l?.fondo ?? 'pradera', 30).replace(/[^a-z0-9_]/gi, '') || 'pradera',
        img: txt(l?.img, 200), numPreguntas: ent(l?.numPreguntas, 1, 10, 3),
        suma: ent(l?.suma, 0, 100), resta: ent(l?.resta, 0, 100),
      }));
      const usados = new Set(); const preguntas = [];
      for (const q of c.preguntas.slice(0, 1000)) {
        if (!q || typeof q !== 'object' || !txt(q.texto, 300)) continue;
        let id = ent(q.id, 0, 2147483000, 0);
        if (!id || usados.has(id)) id = Math.max(0, ...usados) + 1;
        usados.add(id);
        const o = Array.isArray(q.ops) ? q.ops : [];
        preguntas.push({
          id, nivel: ent(q.nivel, 0, 20, 0), planta: txt(q.planta ?? 'Planta', 60), emoji: txt(q.emoji ?? '🌿', 16), texto: txt(q.texto, 300),
          ops: [0, 1, 2].map(k => [txt(o[k]?.[0], 80), txt(o[k]?.[1], 16)]), ok: ent(q.ok, 0, 2, 0),
        });
      }
      await docConfig.set({ puntosIniciales: ent(c.puntosIniciales, 1, 999, 30), niveles, preguntas });
      return {};
    },

    async stats(inp) {
      admin(inp);
      const snap = await partidas.orderBy('inicio', 'desc').limit(3000).get();
      const sesiones = snap.docs.map(d => { const p = d.data(); return {
        id: d.id, alumno: p.alumno, inicio: p.inicio, fin: p.fin, nivelMax: p.nivelMax, puntos: p.puntos, estado: p.estado, resp: p.resp || [] }; });
      return { sesiones: sesiones.reverse() };   // de la más antigua a la más reciente
    },

    async borrar_stats(inp) {
      admin(inp);
      await db.recursiveDelete(partidas);
      return {};
    },
  };

  /** Recibe el texto JSON de la petición y devuelve { status, body } */
  return async function manejar(textoPeticion) {
    let inp; try { inp = JSON.parse(textoPeticion || '{}'); } catch { inp = {}; }
    if (!inp || typeof inp !== 'object' || Array.isArray(inp)) inp = {};
    const accion = String(inp.action ?? '');
    try {
      if (!Object.hasOwn(acciones, accion)) throw new Fallo('Acción desconocida');
      return { status: 200, body: { ...(await acciones[accion](inp)), ok: true } };
    } catch (e) {
      if (e instanceof Fallo) return { status: e.codigo, body: { ok: false, error: e.message } };
      console.error('bichito api:', e);
      return { status: 500, body: { ok: false, error: 'Error del servidor' } };
    }
  };
}
