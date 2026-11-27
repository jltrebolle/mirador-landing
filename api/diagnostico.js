// Alta en el diagnóstico financiero: crea el contacto en Brevo y envía el resultado.
//
// Protecciones antispam:
//  - Lista y plantilla se resuelven en el servidor a partir del perfil (el cliente ya no
//    puede elegir qué plantilla se envía ni a qué lista se apunta a nadie).
//  - Validación de email y nombre.
//  - Campo trampa (honeypot) y tiempo mínimo de rellenado.
//  - Comprobación de origen.
//  - Límite de envíos por IP (mejor esfuerzo: la memoria es por instancia).
//  - Cloudflare Turnstile, activo solo si existe la variable TURNSTILE_SECRET_KEY.

const PERFILES = {
  perfil1: { listId: 12, templateId: 41 }, // Diagnostico-Cero
  perfil2: { listId: 13, templateId: 42 }, // Diagnostico-SinMetodo
  perfil3: { listId: 14, templateId: 43 }, // Diagnostico-Optimizar
  perfil4: { listId: 15, templateId: 44 }, // Diagnostico-Solido
  perfil5: { listId: 16, templateId: 45 }, // Diagnostico-Autonomo
};

const ORIGENES_PERMITIDOS = /^https:\/\/(www\.)?miradorfinanciero\.(com|es)$|^https:\/\/[a-z0-9-]+\.vercel\.app$|^http:\/\/localhost(:\d+)?$/;
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9.-]{1,253}\.[a-z]{2,24}$/i;
const TIEMPO_MINIMO_MS = 8000;
const LIMITE = 3;
const VENTANA_MS = 10 * 60 * 1000;
const intentos = new Map();

function ipDe(req) {
  const xff = req.headers['x-forwarded-for'];
  return (Array.isArray(xff) ? xff[0] : (xff || '')).split(',')[0].trim() || req.socket?.remoteAddress || 'desconocida';
}

function superaLimite(ip) {
  const ahora = Date.now();
  const lista = (intentos.get(ip) || []).filter(t => ahora - t < VENTANA_MS);
  lista.push(ahora);
  intentos.set(ip, lista);
  if (intentos.size > 5000) intentos.clear();
  return lista.length > LIMITE;
}

async function turnstileValido(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // Turnstile aún no configurado
  if (!token) return false;
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  });
  const data = await r.json().catch(() => ({}));
  return data.success === true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const origin = req.headers.origin || '';
  if (origin && !ORIGENES_PERMITIDOS.test(origin)) {
    return res.status(403).json({ error: 'Origen no permitido' });
  }

  const body = req.body || {};
  const ip = ipDe(req);

  // Honeypot o envío demasiado rápido: respondemos OK sin hacer nada, para no dar pistas al bot.
  if (body.website || (typeof body.t === 'number' && body.t < TIEMPO_MINIMO_MS)) {
    return res.status(200).json({ ok: true });
  }

  if (superaLimite(ip)) {
    return res.status(429).json({ error: 'Demasiados intentos. Prueba más tarde.' });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const nombre = String(body.nombre || '').trim().slice(0, 60);

  // Perfil; se admite listId solo para páginas antiguas en caché, y siempre contra la lista blanca.
  let perfil = PERFILES[body.perfil];
  if (!perfil && body.listId) {
    perfil = Object.values(PERFILES).find(p => p.listId === Number(body.listId));
  }

  if (!EMAIL_RE.test(email) || !nombre || /https?:|www\.|[<>]/i.test(nombre) || !perfil) {
    return res.status(400).json({ error: 'Datos no válidos' });
  }

  if (!(await turnstileValido(body.turnstileToken, ip))) {
    return res.status(403).json({ error: 'Verificación fallida' });
  }

  const headers = {
    'Content-Type': 'application/json',
    'api-key': process.env.BREVO_API_KEY2,
  };

  try {
    // 1. Crear/actualizar contacto
    const contactRes = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        attributes: { FIRSTNAME: nombre },
        listIds: [perfil.listId],
        updateEnabled: true,
      }),
    });

    if (!contactRes.ok && contactRes.status !== 204) {
      const err = await contactRes.json().catch(() => ({}));
      if (!(contactRes.status === 400 && err.code === 'duplicate_parameter')) {
        throw new Error('Error contacto: ' + contactRes.status);
      }
    }

    // 2. Enviar el resultado
    const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        to: [{ email, name: nombre }],
        templateId: perfil.templateId,
        params: { FIRSTNAME: nombre },
      }),
    });

    if (!emailRes.ok) throw new Error('Error email: ' + emailRes.status);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
}
