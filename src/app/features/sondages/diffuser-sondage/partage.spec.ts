import { lienSms, lienWhatsApp, messageParDefaut } from './partage';

const URL_SONDAGE = 'http://localhost:4200/s/Ab3x-9_k';

describe('Partage WhatsApp et SMS : adresses générées', () => {
  it('message par défaut : titre entre guillemets français, puis le lien ; sans titre : « notre enquête »', () => {
    expect(messageParDefaut('Enquête santé', URL_SONDAGE)).toBe(`Bonjour, merci de répondre à notre enquête « Enquête santé » : ${URL_SONDAGE}`);
    expect(messageParDefaut('  ', URL_SONDAGE)).toBe(`Bonjour, merci de répondre à notre enquête : ${URL_SONDAGE}`);
    expect(messageParDefaut(null, URL_SONDAGE)).toBe(`Bonjour, merci de répondre à notre enquête : ${URL_SONDAGE}`);
  });

  it('WhatsApp : https://wa.me/?text= suivi du message encodé (espaces, accents, ponctuation)', () => {
    const message = messageParDefaut('Enquête santé – Ségou', URL_SONDAGE);
    const url = lienWhatsApp(message);
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(url).toContain('Bonjour%2C%20merci');
    expect(url).toContain('enqu%C3%AAte');
    expect(url).toContain('S%C3%A9gou');
    expect(url).toContain('%E2%80%93');
    expect(url).not.toMatch(/[ «»éê]/);
    expect(decodeURIComponent(url.slice('https://wa.me/?text='.length))).toBe(message);
  });

  it('SMS : sms:?&body= (iPhone et Android) suivi du message encodé', () => {
    const message = messageParDefaut('Santé', URL_SONDAGE);
    const url = lienSms(message);
    expect(url.startsWith('sms:?&body=')).toBe(true);
    expect(decodeURIComponent(url.slice('sms:?&body='.length))).toBe(message);
  });

  it('titre avec guillemets, &, #, ? et retour à la ligne : rien ne coupe le paramètre, le lien reste intact', () => {
    const titre = 'Les « "vraies" » questions & réponses #1 ?';
    const message = `${messageParDefaut(titre, URL_SONDAGE)}\nMerci !`;
    for (const [url, prefixe] of [
      [lienWhatsApp(message), 'https://wa.me/?text='],
      [lienSms(message), 'sms:?&body='],
    ]) {
      const parametre = url.slice(prefixe.length);
      expect(parametre).not.toMatch(/[&#?"\n ]/);
      expect(parametre).toContain('%22vraies%22');
      expect(parametre).toContain('%26');
      expect(parametre).toContain('%23');
      expect(parametre).toContain('%0A');
      expect(decodeURIComponent(parametre)).toBe(message);
      expect(decodeURIComponent(parametre)).toContain(URL_SONDAGE);
    }
  });
});
