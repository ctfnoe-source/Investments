// ==================== CLOUDFLARE PAGES FUNCTION — Mercado Pago Webhook ====================
// Archivo: functions/mp-webhook.js

async function getGoogleAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  // Importar clave privada RSA
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = serviceAccount.private_key
    .replace(pemHeader, '').replace(pemFooter, '').replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const encoder = new TextEncoder();
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sigInput = `${header}.${body}`;

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    encoder.encode(sigInput)
  );

  const sigBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = `${sigInput}.${sigBase64}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error('No access token: ' + JSON.stringify(tokenData));
  return tokenData.access_token;
}

async function approveUserInFirestore(uid, env) {
  const projectId = env.FIREBASE_PROJECT_ID || 'control-de-inversion';
  const serviceAccountKey = env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccountKey) throw new Error('FIREBASE_SERVICE_ACCOUNT no configurado');

  const sa = JSON.parse(serviceAccountKey);
  const token = await getGoogleAccessToken(sa);

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/registros/${uid}?updateMask.fieldPaths=aprobado&updateMask.fieldPaths=pagado&updateMask.fieldPaths=pagadoEn`;

  const result = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        aprobado: { booleanValue: true },
        pagado: { booleanValue: true },
        pagadoEn: { stringValue: new Date().toISOString() },
      }
    }),
  });

  console.log('[Webhook] Firestore update status:', result.status);
  return result.status === 200;
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    console.log('[Webhook] Recibido:', JSON.stringify(body));

    if (body.type !== 'payment' || !body.data?.id) {
      return new Response('OK - ignored', { status: 200 });
    }

    const paymentId = body.data.id;
    const accessToken = context.env.MP_ACCESS_TOKEN;

    if (!accessToken) {
      return new Response('Server config error', { status: 500 });
    }

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const payment = await paymentRes.json();

    console.log('[Webhook] Pago status:', payment.status, '| uid:', payment.external_reference);

    if (payment.status !== 'approved') {
      return new Response('OK - payment not approved', { status: 200 });
    }

    const uid = payment.external_reference;
    if (!uid) {
      return new Response('OK - no uid', { status: 200 });
    }

    await approveUserInFirestore(uid, context.env);
    console.log('[Webhook] ✅ Usuario aprobado:', uid);

    return new Response('OK - user approved', { status: 200 });

  } catch (err) {
    console.error('[Webhook] Error:', err.message);
    return new Response('Internal error: ' + err.message, { status: 500 });
  }
}
