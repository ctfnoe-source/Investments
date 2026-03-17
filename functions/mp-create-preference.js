// ==================== CLOUDFLARE PAGES FUNCTION — Crear Preferencia MP ====================
// Archivo: functions/mp-create-preference.js

export async function onRequestPost(context) {
  try {
    const { uid, email, lang } = await context.request.json();

    if (!uid) {
      return new Response(JSON.stringify({ error: 'uid requerido' }), { status: 400 });
    }

    const accessToken = context.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'MP_ACCESS_TOKEN no configurado' }), { status: 500 });
    }

    const isES = lang !== 'en';
    const siteUrl = 'https://trackfolio.pages.dev';

    const preference = {
      items: [
        {
          id: 'investtracker-lifetime',
          title: isES ? 'InvestTracker — Acceso de por vida' : 'InvestTracker — Lifetime Access',
          description: isES
            ? 'Acceso completo y permanente a InvestTracker. Pago único sin suscripción.'
            : 'Full and permanent access to InvestTracker. One-time payment, no subscription.',
          quantity: 1,
          currency_id: 'USD',
          unit_price: 20,
        }
      ],
      payer: { email: email || '' },
      external_reference: uid,
      back_urls: {
        success: `${siteUrl}?payment=success`,
        failure: `${siteUrl}?payment=failure`,
        pending: `${siteUrl}?payment=pending`,
      },
      auto_return: 'approved',
      notification_url: `${siteUrl}/mp-webhook`,
      statement_descriptor: 'InvestTracker',
    };

    const result = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preference),
    });

    const data = await result.json();
    console.log('[Preference] Status:', result.status);

    if (result.status !== 201) {
      console.error('[Preference] Error MP:', data);
      return new Response(JSON.stringify({ error: 'Error creando preferencia', details: data }), { status: 500 });
    }

    return new Response(JSON.stringify({
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
      preference_id: data.id,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[Preference] Error:', err.message);
    return new Response(JSON.stringify({ error: 'Internal error: ' + err.message }), { status: 500 });
  }
}
