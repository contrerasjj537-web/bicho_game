// Punto de entrada: Netlify publica esta función en  https://TU-SITIO.netlify.app/api
import { Firestore } from '@google-cloud/firestore';
import { crearManejador } from './lib/handler.mjs';

let manejar;
function iniciar() {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, SECRETO } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY || !SECRETO) {
    throw new Error('Faltan variables de entorno en Netlify (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, SECRETO)');
  }
  const db = new Firestore({
    projectId: FIREBASE_PROJECT_ID,
    credentials: { client_email: FIREBASE_CLIENT_EMAIL, private_key: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') },
  });
  return crearManejador(db, { secreto: SECRETO });
}

const cabeceras = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };

export default async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ ok: false, error: 'Usa POST' }), { status: 405, headers: cabeceras });
  try { manejar ??= iniciar(); }
  catch (e) { console.error(e.message); return new Response(JSON.stringify({ ok: false, error: 'Servidor sin configurar' }), { status: 500, headers: cabeceras }); }
  const { status, body } = await manejar(await req.text());
  return new Response(JSON.stringify(body), { status, headers: cabeceras });
};

export const config = { path: '/api' };
