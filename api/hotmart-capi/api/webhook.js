const crypto = require('crypto');

// Config
const PIXEL_ID = '2167039767401065';
const ACCESS_TOKEN = 'EAASIcxZBhUa4BRP5m7CkUZBog5lmd9ACH8iNQzxwXUIHRYwNZAIK0VZBMGUEWvzjZCsvk1aw6iyJ4w1I5ZBjbmc0cZAwWUouMlA72O7ZCW8BnV8AtiXry56mZAKf1Qkw8lYaG2ZACSvAZCnlZAaDVKv0PfdpG1ipZB6pbMGrDpK3Lt4mR7sNh3V1ZARWh89NVsRnwKCgZDZD';
const META_API_URL = `https://graph.facebook.com/v19.0/${PIXEL_ID}/events`;

function hashSHA256(value) {
  if (!value) return undefined;
  return crypto
    .createHash('sha256')
    .update(value.trim().toLowerCase())
    .digest('hex');
}

function normalizePhone(phone) {
  if (!phone) return undefined;
  // Remove everything except digits and leading +
  return phone.replace(/[^\d]/g, '');
}

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;

    console.log('Hotmart webhook received:', JSON.stringify(body));

    // Extract fields from Hotmart payload
    // Hotmart can send data in different formats depending on configuration
    const email = body.buyer_email || body.email || '';
    const phone = body.buyer_phone || body.phone || '';
    const name = body.buyer_name || body.name || '';
    const price = parseFloat(body.producer_price || body.price || '9.99');
    const currency = body.currency || 'USD';
    const src = body.src || ''; // Your RedTrack/affiliate clickid
    const status = body.status || body.purchase_status || '';

    // Only process completed purchases
    if (status && status !== 'COMPLETE' && status !== 'approved' && status !== 'APPROVED') {
      console.log('Skipping non-complete purchase, status:', status);
      return res.status(200).json({ message: 'Skipped - not a completed purchase', status });
    }

    // Build user_data with hashed values (Meta requirement)
    const userData = {};

    if (email) userData.em = hashSHA256(email);
    if (phone) userData.ph = hashSHA256(normalizePhone(phone));

    // Hash first/last name if available
    if (name) {
      const parts = name.trim().split(' ');
      userData.fn = hashSHA256(parts[0]);
      if (parts.length > 1) {
        userData.ln = hashSHA256(parts.slice(1).join(' '));
      }
    }

    // Add fbc if we have a clickid from src parameter
    if (src) {
      userData.fbc = `fb.1.${Date.now()}.${src}`;
    }

    // Build the Meta CAPI event
    const eventPayload = {
      data: [
        {
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
            num_items: 1,
          },
        },
      ],
    };

    console.log('Sending to Meta CAPI:', JSON.stringify(eventPayload));

    // Send to Meta CAPI
    const metaResponse = await fetch(`${META_API_URL}?access_token=${ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventPayload),
    });

    const metaResult = await metaResponse.json();
    console.log('Meta CAPI response:', JSON.stringify(metaResult));

    if (!metaResponse.ok) {
      console.error('Meta CAPI error:', metaResult);
      return res.status(500).json({ error: 'Meta CAPI error', details: metaResult });
    }

    return res.status(200).json({
      success: true,
      events_received: metaResult.events_received,
      fbtrace_id: metaResult.fbtrace_id,
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
