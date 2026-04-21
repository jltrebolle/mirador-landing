export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  try {
    // Añadir contacto a la lista
    const contactRes = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        email,
        listIds: [3],
        updateEnabled: true,
      }),
    });

    if (!contactRes.ok && contactRes.status !== 204) {
      const data = await contactRes.json();
      if (data.code !== 'duplicate_parameter') {
        return res.status(500).json({ error: 'Error al suscribir' });
      }
    }

    // Enviar email de bienvenida
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: 'Mirador Financiero', email: 'hola@miradorfinanciero.com' },
        to: [{ email }],
        subject: 'Ya estás en la lista — Mirador Financiero',
        htmlContent: `<p>Hola,</p><p>Gracias por apuntarte a la lista de espera de <strong>Mirador Financiero</strong>.</p><p>Te avisaremos en cuanto esté listo. Serás de los primeros en entrar.</p><p>— José Luis<br>Mirador Financiero</p>`,
      }),
    });

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
}    return res.status(500).json({ error: 'Error de servidor' });
  }
}
