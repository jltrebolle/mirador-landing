export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, nombre, listId, templateId } = req.body;

  if (!email || !nombre || !listId || !templateId) {
    return res.status(400).json({ error: 'Faltan parámetros' });
  }

  const API_KEY = process.env.BREVO_API_KEY2;
  const headers = {
    'Content-Type': 'application/json',
    'api-key': API_KEY
  };

  try {
    // 1. Crear/actualizar contacto
    const contactRes = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        attributes: { FIRSTNAME: nombre },
        listIds: [listId],
        updateEnabled: true
      })
    });

    if (!contactRes.ok && contactRes.status !== 204) {
      const err = await contactRes.json();
      if (!(contactRes.status === 400 && err.code === 'duplicate_parameter')) {
        throw new Error('Error contacto: ' + contactRes.status);
      }
    }

    // 2. Enviar email transaccional
    const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        to: [{ email, name: nombre }],
        templateId,
        params: { FIRSTNAME: nombre }
      })
    });

    if (!emailRes.ok) throw new Error('Error email: ' + emailRes.status);

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}