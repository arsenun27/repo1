# Hotmart → Meta CAPI Bridge

Función serverless que recibe el webhook de Hotmart y envía el evento Purchase a Meta CAPI con hashing SHA-256.

## Archivos

```
hotmart-capi/
├── api/
│   └── webhook.js     ← La función principal
├── vercel.json        ← Configuración de Vercel
└── package.json
```

## Deploy en Vercel

### Opción A — GitHub (recomendado)

1. Crea un repositorio en GitHub y sube estos archivos
2. Ve a vercel.com → New Project → importa el repo
3. Deploy automático

### Opción B — Vercel CLI

```bash
npm i -g vercel
cd hotmart-capi
vercel deploy
```

## Tu URL del webhook

Una vez deployado, tu URL será:
```
https://TU-PROYECTO.vercel.app/api/webhook
```

Esa URL se la das al productor de Hotmart para configurar el postback.

## Variables de entorno (recomendado)

En lugar de tener el token hardcodeado, configura en Vercel:
- `PIXEL_ID` = 2167039767401065
- `META_ACCESS_TOKEN` = tu_token

Y en el código cambia:
```js
const PIXEL_ID = process.env.PIXEL_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
```

## Verificar que funciona

1. En Meta Events Manager → Test Events
2. Envía un POST de prueba a tu URL con:
```json
{
  "buyer_email": "test@gmail.com",
  "buyer_phone": "+595981234567",
  "buyer_name": "Juan Perez",
  "producer_price": "9.99",
  "currency": "USD",
  "status": "COMPLETE"
}
```
3. Debe aparecer el evento Purchase en Test Events de Meta
