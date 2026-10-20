// Punto de entrada: Netlify publica esta función en  https://TU-SITIO.netlify.app/api
import { Firestore } from '@google-cloud/firestore';
import { crearManejador } from './lib/handler.mjs';

let manejar;

// Acepta la clave pegada de varias formas: con comillas, con coma, con \n literales o con saltos de línea reales
function limpiarClave(bruta) {
  const t = String(bruta).replace(/\\n/g, '\n');
  const m = t.match(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/);
  if (!m) throw new Error('FIREBASE_PRIVATE_KEY no tiene formato de clave (debe empezar con -----BEGIN PRIVATE KEY-----)');
  return m[0].split('\n').map(l => l.trim()).filter(Boolean).join('\n') + '\n';
}

function iniciar() {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, SECRETO } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY || !SECRETO) {
    throw new Error('Faltan variables de entorno en Netlify (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, SECRETO)');
  }
  const db = new Firestore({
    projectId: FIREBASE_PROJECT_ID.trim(),
    credentials: { client_email: FIREBASE_CLIENT_EMAIL.trim(), private_key: limpiarClave(FIREBASE_PRIVATE_KEY) },
  });
  return crearManejador(db, { secreto: SECRETO });
}

const cabeceras = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

export default async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ ok: false, error: 'Usa POST' }), { status: 405, headers: cabeceras });
  try { manejar ??= iniciar(); }
  catch (e) { console.error(e.message); return new Response(JSON.stringify({ ok: false, error: `Servidor sin configurar (${e.message})` }), { status: 500, headers: cabeceras }); }
  const { status, body } = await manejar(await req.text());
  return new Response(JSON.stringify(body), { status, headers: cabeceras });
};

export const config = { path: '/api' };
