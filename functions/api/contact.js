/**
 * POST /api/contact — Cloudflare Pages Function
 *
 * Vérifie le captcha Turnstile côté serveur, puis envoie le message
 * par email via l'API Resend.
 *
 * Variables d'environnement à définir dans Cloudflare Pages
 * (Settings → Environment variables) :
 *   TURNSTILE_SECRET_KEY  (secret)  clé secrète du widget Turnstile
 *   RESEND_API_KEY        (secret)  clé API Resend (re_...)
 *   CONTACT_TO            (texte)   destinataire, ex. piksel.website@gmail.com
 *   CONTACT_FROM          (texte)   expéditeur vérifié, ex. "Piksel <contact@piksel.fr>"
 *                                   ou "Piksel <onboarding@resend.dev>" pour tester
 */

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  // Aucun en-tete Access-Control-Allow-Origin : sans lui, un site tiers ne
  // peut pas lire la reponse de cette route depuis le navigateur d'un
  // visiteur. Le formulaire du site, lui, est en meme origine et n'a besoin
  // d'aucune autorisation CORS.
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  Vary: 'Origin',
};

/**
 * Le navigateur envoie systematiquement `Origin` sur une requete POST. S'il
 * est present et ne correspond pas au site, la requete vient d'une page
 * tierce qui se sert du formulaire comme d'un relais : on refuse. Un `Origin`
 * absent (outil en ligne de commande, test) reste accepte, car le captcha
 * Turnstile fait deja barrage plus bas.
 */
function origineEtrangere(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(request.url).host;
  } catch {
    return true; // en-tete illisible : on considere l'appel comme suspect
  }
}

const reply = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Neutralise les tentatives d'injection d'en-têtes dans le sujet
const oneLine = (s = '') => String(s).replace(/[\r\n]+/g, ' ').trim();

export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    // Pas de reponse aux preflights OPTIONS non plus : la route n'est pas
    // faite pour etre appelee depuis une autre origine.
    return new Response('Method Not Allowed', {
      status: 405,
      headers: {
        Allow: 'POST',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }
  if (origineEtrangere(context.request)) {
    return reply(403, { ok: false, error: 'Origine non autorisee.' });
  }
  return handleContact(context);
}

async function handleContact({ request, env }) {
  // --- 1. Parsing ---------------------------------------------------------
  let body;
  try {
    body = await request.json();
  } catch {
    return reply(400, { ok: false, error: 'Requête invalide.' });
  }

  const name = (body.name || '').toString().trim();
  const email = (body.email || '').toString().trim();
  const message = (body.message || '').toString().trim();
  const company = (body.company || '').toString().trim(); // honeypot
  const token = (body.token || '').toString();

  // --- 2. Piège à robots --------------------------------------------------
  // Un humain ne voit jamais ce champ. S'il est rempli, on répond « ok »
  // sans rien envoyer : le bot croit avoir réussi et n'insiste pas.
  if (company) return reply(200, { ok: true });

  // --- 3. Validation ------------------------------------------------------
  if (!name || !email || !message) {
    return reply(400, { ok: false, error: 'Merci de remplir tous les champs.' });
  }
  if (name.length > 120 || email.length > 180 || message.length > 4000) {
    return reply(400, { ok: false, error: 'Message trop long.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return reply(400, { ok: false, error: 'Adresse email invalide.' });
  }

  // --- 4. Vérification du captcha ----------------------------------------
  if (!token) {
    return reply(400, { ok: false, error: 'Captcha manquant.' });
  }
  if (!env.TURNSTILE_SECRET_KEY) {
    return reply(500, { ok: false, error: 'Captcha non configuré côté serveur.' });
  }

  const ip = request.headers.get('CF-Connecting-IP') || '';
  const verifyForm = new FormData();
  verifyForm.append('secret', env.TURNSTILE_SECRET_KEY);
  verifyForm.append('response', token);
  if (ip) verifyForm.append('remoteip', ip);

  let verdict;
  try {
    const vr = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body: verifyForm }
    );
    verdict = await vr.json();
  } catch {
    return reply(502, { ok: false, error: 'Vérification du captcha impossible.' });
  }

  if (!verdict.success) {
    return reply(403, {
      ok: false,
      error: 'Captcha refusé. Rechargez la page et réessayez.',
    });
  }

  // --- 5. Envoi de l'email via Resend ------------------------------------
  if (!env.RESEND_API_KEY) {
    return reply(500, { ok: false, error: 'Service mail non configuré.' });
  }

  const to = env.CONTACT_TO || 'piksel.website@gmail.com';
  const from = env.CONTACT_FROM || 'Piksel <onboarding@resend.dev>';
  const subject = oneLine(`Piksel — nouveau message de ${name}`).slice(0, 180);

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;max-width:600px;margin:0 auto;color:#1d1d1f">
      <h2 style="margin:0 0 4px;font-size:20px">Nouveau message depuis piksel</h2>
      <p style="margin:0 0 24px;color:#6e6e73;font-size:14px">Formulaire de contact du site</p>
      <table style="width:100%;border-collapse:collapse;font-size:15px">
        <tr>
          <td style="padding:10px 0;border-top:1px solid #e5e5e7;color:#6e6e73;width:90px;vertical-align:top">Nom</td>
          <td style="padding:10px 0;border-top:1px solid #e5e5e7">${esc(name)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-top:1px solid #e5e5e7;color:#6e6e73;vertical-align:top">Email</td>
          <td style="padding:10px 0;border-top:1px solid #e5e5e7"><a href="mailto:${esc(email)}" style="color:#0071e3;text-decoration:none">${esc(email)}</a></td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-top:1px solid #e5e5e7;color:#6e6e73;vertical-align:top">Projet</td>
          <td style="padding:10px 0;border-top:1px solid #e5e5e7;white-space:pre-wrap;line-height:1.55">${esc(message)}</td>
        </tr>
      </table>
      <p style="margin:24px 0 0;color:#a1a1a6;font-size:12px">
        Répondez directement à cet email pour joindre ${esc(name)}.
      </p>
    </div>`;

  const text =
    `Nouveau message depuis le site Piksel\n\n` +
    `Nom    : ${name}\n` +
    `Email  : ${email}\n\n` +
    `Projet :\n${message}\n`;

  try {
    const sr = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
        reply_to: email, // « Répondre » écrit directement au visiteur
      }),
    });

    if (!sr.ok) {
      const detail = await sr.text();

      // Traduction des refus les plus fréquents, pour que le log dise quoi
      // corriger plutôt que de renvoyer un code brut.
      const piste = {
        401: "RESEND_API_KEY invalide ou révoquée — recrée une clé dans Resend > API Keys.",
        403: `Resend refuse cet envoi. Les deux causes habituelles :
             1) CONTACT_FROM ("${from}") utilise un domaine non vérifié — vérifie-le dans Resend > Domains, ou repasse à "Piksel <onboarding@resend.dev>" ;
             2) avec onboarding@resend.dev, on ne peut écrire QU'À l'adresse du compte Resend. CONTACT_TO vaut "${to}" : ce doit être exactement l'email d'inscription à Resend.`,
        422: `Champ invalide côté Resend. CONTACT_FROM doit avoir la forme "Nom <adresse@domaine>". Valeur actuelle : "${from}".`,
        429: 'Quota Resend atteint (100 mails/jour sur le plan gratuit).',
      }[sr.status] || 'Voir la réponse brute ci-dessus.';

      console.error(
        `[contact] Resend a répondu ${sr.status}\n` +
        `  from    : ${from}\n` +
        `  to      : ${to}\n` +
        `  réponse : ${detail}\n` +
        `  piste   : ${piste}`
      );

      return reply(502, {
        ok: false,
        error: "L'envoi a échoué. Écrivez-moi directement à " + to,
      });
    }
  } catch (err) {
    console.error('Resend fetch failed', err);
    return reply(502, {
      ok: false,
      error: "L'envoi a échoué. Écrivez-moi directement à " + to,
    });
  }

  return reply(200, { ok: true });
}
