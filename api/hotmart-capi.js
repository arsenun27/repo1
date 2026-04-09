const crypto = require('crypto');

const PIXEL_ID = '2167039767401065';
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const TEST_EVENT_CODE = process.env.TEST_EVENT_CODE;

function hashSHA256(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function normalizePhone(phone) {
  if (!phone) return undefined;
  return phone.replace(/[^\d]/g, '');
}

module.exports = async function handler(req, res) {
  try {
    const body = req.body || {};
    console.log('Hotmart payload:', JSON.stringify(body));

    // Hotmart v2.0 estructura real
    const data = body.data || body;
    const buyers = data.buyers || data.buyer || {};
    const purchase = data.purchase || {};

    // Datos del comprador
    const firstName = buyers.first_name || buyers.name || '';
    const lastName  = buyers.last_name || '';
    const email     = buyers.email || '';
    const phoneCode = buyers.checkout_phone_code || '';
    const phoneNum  = buyers.checkout_phone || buyers.phone || '';
    const phone     = phoneCode + phoneNum;

    // Datos de la compra
    const transactionId = purchase.transaction || body.hottok || Date.now().toString();
    const status        = purchase.status || data.status || 'COMPLETE';
    const price         = parseFloat((purchase.price && purchase.price.value) || data.producer_price || '9.99');
    const currency      = (purchase.price && purchase.price.currency_value) || data.currency || 'USD';
    const src           = (data.purchase && data.purchase.src) || body.src || '';

    console.log('Extracted:', { email, phone, firstName, lastName, price, currency, status, transactionId });

    // Solo procesar compras completadas
    if (status && !['COMPLETE', 'COMPLETED', 'approved', 'APPROVED'].includes(status)) {
      return res.status(200).json({ message: 'Skipped', status });
    }

    // Construir user_data hasheado
    const userData = {
      client_user_agent: req.headers['user-agent'] || 'Mozilla/5.0',
      external_id: hashSHA256(transactionId),
    };

    if (email)     userData.em = hashSHA256(email);
    if (phone)     userData.ph = hashSHA256(normalizePhone(phone));
    if (firstName) userData.fn = hashSHA256(firstName);
    if (lastName)  userData.ln = hashSHA256(lastName);
    if (src)       userData.fbc = `fb.1.${Date.now()}.${src}`;

    const eventPayload = {
      data: [{
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_source_url: 'https://pay.hotmart.com',
        action_source: 'website',
        user_data: userData,
        custom_data: {
          value: price,
          currency: currency,
          content_name: 'Metodo La Fuente',
          content_type: 'product',
          content_ids: ['metodo-la-fuente'],
          num_items: 1
        }
      }]
    };

    if (TEST_EVENT_CODE) {
      eventPayload.test_event_code = TEST_EVENT_CODE;
    }

    console.log('Sending to Meta:', JSON.stringify(eventPayload));

    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventPayload)
      }
    );

    const metaResult = await metaRes.json();
    console.log('Meta response:', JSON.stringify(metaResult));

    return res.status(200).json({
      success: true,
      events_received: metaResult.events_received,
      meta_raw: metaResult
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
