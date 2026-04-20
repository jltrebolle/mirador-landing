export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        email: email,
        listIds: [3],
        updateEnabled: true,
      }),
    });

    if (response.ok || response.status === 204) {
      return res.status(200).json({ success: true });
    } else {
      const data = await response.json();
      // Contacto ya existe — lo tratamos como éxito
      if (data.code === 'duplicate_parameter') {
        return res.status(200).json({ success: true });
      }
      return res.status(500).json({ error: 'Error al suscribir' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Error de servidor' });
  }
}
