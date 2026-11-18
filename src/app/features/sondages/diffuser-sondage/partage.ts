/**
 * Partage du lien d'un sondage par WhatsApp et par SMS, sans service payant : liens qui ouvrent l'application avec un
 * message prérempli (le répondant choisit lui-même son destinataire). Texte toujours encodé par encodeURIComponent.
 */

/** « Bonjour, merci de répondre à notre enquête « Titre » : lien ». Sans titre : « … à notre enquête : lien ». */
export function messageParDefaut(titre: string | null | undefined, url: string): string {
  const nom = titre?.trim();
  return `Bonjour, merci de répondre à notre enquête${nom ? ` « ${nom} »` : ''} : ${url}`;
}

/** https://wa.me/?text=… : WhatsApp (application sur téléphone, WhatsApp Web sinon), destinataire au choix. */
export function lienWhatsApp(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** sms:?&body=… : forme comprise par iPhone (« &body ») et Android (« ?body », le « & » initial est ignoré). */
export function lienSms(message: string): string {
  return `sms:?&body=${encodeURIComponent(message)}`;
}
