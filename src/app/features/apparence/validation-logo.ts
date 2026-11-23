import { LOGO_TAILLE_MAX } from '../../core/models/personnalisation.model';
import { formaterNombre, traduire } from '../../core/i18n/traduire';

export const messageLogoFormat = (): string => traduire('apparence.logo.format');
export const messageLogoVide = (): string => traduire('apparence.logo.vide');

/** « 1 Mo », « 350 Ko » (« 1 MB », « 350 KB » en anglais). */
export function tailleEnClair(octets: number): string {
  if (octets >= 1024 * 1024) {
    return traduire('apparence.logo.mo', { n: formaterNombre(octets / (1024 * 1024), { maximumFractionDigits: 1 }) });
  }
  return traduire('apparence.logo.ko', { n: formaterNombre(Math.max(1, Math.round(octets / 1024))) });
}

/** PNG ou JPEG reconnu à ses premiers octets, comme le backend (l'extension et le type annoncé ne suffisent pas). */
export function typeLogo(octets: Uint8Array): 'image/png' | 'image/jpeg' | null {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (octets.length >= 8 && png.every((o, i) => octets[i] === o)) {
    return 'image/png';
  }
  if (octets.length >= 3 && octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff) {
    return 'image/jpeg';
  }
  return null;
}

/**
 * Vérification avant envoi : PNG ou JPEG, 1 Mo au plus. Renvoie le message à afficher, ou null si le fichier peut être
 * envoyé. Le serveur revérifie tout (dimensions 2000 x 2000, image lisible, JPEG CMYK…).
 */
export async function verifierLogo(fichier: File): Promise<string | null> {
  if (fichier.size === 0) {
    return messageLogoVide();
  }
  if (fichier.size > LOGO_TAILLE_MAX) {
    return traduire('apparence.logo.tropGros', { max: tailleEnClair(LOGO_TAILLE_MAX), taille: tailleEnClair(fichier.size) });
  }
  const entete = new Uint8Array(await fichier.slice(0, 8).arrayBuffer());
  return typeLogo(entete) ? null : messageLogoFormat();
}
