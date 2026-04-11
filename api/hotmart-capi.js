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

    const data = body.data || body;
    const buyer = data.buyer || data.buyers || {};
    const purchase = data.purchase || {};

    // Email — puede estar en buyer.email directamente
    const email     = buyer.email || '';
    const firstName = buyer.first_name || buyer.name || '';
    const lastName  = buyer.last_name || '';
    const phoneCode = buyer.checkout_phone_code || '';
    const phoneNum  = buyer.checkout_phone || buyer.phone || '';
    const phone     = phoneCode + phoneNum;

    // Precio — Hotmart real usa original_offer_price
    const priceObj  = purchase.original_offer_price || purchase.price || {};
    const price     = parseFloat(priceObj.value || data.producer_price || '9.99');
    const currency  = priceObj.currency_value || data.currency || 'USD';

    // Transaccion y status
    const transactionId = purchase.transaction || body.hottok || Date.now().toString();
    const status        = purchase.status || data.status || 'COMPLETED';
    const src           = purchase.src || data.src || body.src || '';

    console.log('Extracted:', { email, phone, firstName, lastName, price, currency, status, transactionId });

    if (status && !['COMPLETE', 'COMPLETED', 'approved', 'APPROVED'].includes(status)) {
      console.log('Skipped status:', status);
      return res.status(200).json({ message: 'Skipped', status });
    }

    const userData = {
      client_user_agent: req.headers['user-agent'] || 'Mozilla/5.0',
      external_id: hashSHA256(transactionId),
    };

    if (email)     userData.em = hashSHA256(email);
    if (phone && normalizePhone(phone)) userData.ph = hashSHA256(normalizePhone(phone));
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
