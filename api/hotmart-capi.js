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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    console.log('Hotmart payload:', JSON.stringify(body));

    const email    = body.buyer_email || body.email || '';
    const phone    = body.buyer_phone || body.phone || '';
    const name     = body.buyer_name  || body.name  || '';
    const price    = parseFloat(body.producer_price || body.price || '9.99');
    const currency = body.currency || 'USD';
    const src      = body.src || '';
    const status   = body.status || body.purchase_status || 'COMPLETE';

    if (status && !['COMPLETE','approved','APPROVED'].includes(status)) {
      return res.status(200).json({ message: 'Skipped', status });
    }

    const userData = {};
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
      fbtrace_id: metaResult.fbtrace_id,
      meta_raw: metaResult
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
