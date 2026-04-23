// api/subscribe.js
// Función serverless para capturar suscriptores y enviarlos a Brevo
// Método: POST a /api/subscribe con { email }
// Respuesta: { success: true/false, message: string }

const https = require('https');

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://miradorfinanciero.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email } = req.body;

  // Validar email
  if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return res.status(400).json({ success: false, message: 'Email inválido' });
  }

  // Credenciales de Brevo (usar variables de entorno en Vercel)
  const brevoApiKey = process.env.BREVO_API_KEY2;
  const listId = 3; // Lista de espera Mirador

  if (!brevoApiKey) {
    console.error('BREVO_API_KEY no configurada');
    return res.status(500).json({ success: false, message: 'Error de configuración del servidor' });
  }

  const payload = JSON.stringify({
    email: email,
    listIds: [listId],
    updateEnabled: true, // Si ya existe, actualizar en lugar de error
  });

  const options = {
    hostname: 'api.brevo.com',
    port: 443,
    path: '/v3/contacts',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'api-key': brevoApiKey,
    },
  };

  return new Promise((resolve) => {
    const request = https.request(options, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          res.status(200).json({
            success: true,
            message: 'Suscripción confirmada. Te escribiremos pronto.',
          });
        } else {
          console.error('Brevo error:', response.statusCode, data);
          res.status(response.statusCode).json({
            success: false,
            message: 'Error al procesar la suscripción. Intenta más tarde.',
          });
        }
        resolve();
      });
    });

    request.on('error', (error) => {
      console.error('Request error:', error);
      res.status(500).json({
        success: false,
        message: 'Error de conexión. Intenta más tarde.',
      });
      resolve();
    });

    request.write(payload);
    request.end();
  });
};
