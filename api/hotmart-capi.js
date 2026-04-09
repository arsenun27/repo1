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
    // Lee tanto GET (query params) como POST (body)
    const query = req.query || {};
    const body = req.body || {};
    const data = { ...query, ...body };

    console.log('Data received:', JSON.stringify(data));

    const email    = data.buyer_email || data.email || '';
    const phone    = data.buyer_phone || data.phone || '';
    const name     = data.buyer_name  || data.name  || '';
    const price    = parseFloat(data.producer_price || data.price || '9.99');
    const currency = data.currency || 'USD';
    const src      = data.src || '';
    const status   = data.status || data.purchase_status || 'COMPLETE';
    const transactionId = data.transaction || data.hottok || Date.now().toString();

    if (status && !['COMPLETE','approved','APPROVED'].includes(status)) {
      return res.status(200).json({ message: 'Skipped', status });
    }

    const userData = {
      client_user_agent: req.headers['user-agent'] || 'Mozilla/5.0',
      external_id: hashSHA256(transactionId || email || Date.now().toString()),
    };

    if (email) userData.em = hashSHA256(email);
    if (phone) userData.ph = hashSHA256(normalizePhone(phone));
    if (name) {
      const parts = name.trim().split(' ');
      userData.fn = hashSHA256(parts[0]);
      if (parts.length > 1) userData.ln = hashSHA256(parts.slice(1).join(' '));
    }
    if (src) userData.fbc = `fb.1.${Date.now()}.${src}`;

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
