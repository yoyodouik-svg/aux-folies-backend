/**
 * Envoi de SMS via Twilio.
 *
 * ⚠️ Nécessite un compte Twilio réel (payant, avec un numéro d'envoi
 * acheté) — je ne peux pas créer ce compte à votre place. Tant que les
 * variables d'environnement ne sont pas renseignées, cette fonction ne
 * fait rien silencieusement (aucun crash), pour que le reste du site
 * fonctionne normalement sans SMS.
 *
 * Pour l'activer :
 *  1. Créez un compte sur https://www.twilio.com
 *  2. Achetez un numéro capable d'envoyer des SMS vers la Tunisie
 *     (vérifiez la couverture internationale Twilio pour +216)
 *  3. Renseignez dans .env :
 *       TWILIO_SID=...
 *       TWILIO_AUTH_TOKEN=...
 *       TWILIO_FROM=+1xxxxxxxxxx
 *  4. npm install twilio
 */
let twilioClient = null;
if (process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    // require() paresseux : si le package "twilio" n'est pas installé,
    // on ne casse pas le serveur, on désactive juste l'envoi de SMS.
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (err) {
    console.warn('[sms] Package "twilio" non installé (npm install twilio) — SMS désactivés.');
  }
}

/**
 * @param {string} toPhone  numéro du client, ex: "55 61 86 18"
 * @param {string} message  contenu du SMS
 */
async function sendSms(toPhone, message) {
  if (!twilioClient) {
    console.log(`[sms] (désactivé, pas de config Twilio) → aurait envoyé à ${toPhone} : "${message}"`);
    return { sent: false, reason: 'twilio_not_configured' };
  }

  // Numéro tunisien : on nettoie et on ajoute l'indicatif +216 si absent
  const clean = toPhone.replace(/\s/g, '');
  const to = clean.startsWith('+') ? clean : `+216${clean}`;

  try {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_FROM,
      to,
    });
    return { sent: true };
  } catch (err) {
    console.error('[sms] Échec envoi SMS :', err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendSms };
