import { LOGO_TAILLE_MAX } from '../../core/models/personnalisation.model';

export const MESSAGE_LOGO_FORMAT = 'Le logo doit être une image PNG ou JPEG.';
export const MESSAGE_LOGO_VIDE = 'Ce fichier est vide.';

/** « 1 Mo », « 350 Ko ». */
export function tailleEnClair(octets: number): string {
  if (octets >= 1024 * 1024) {
    return `${(octets / (1024 * 1024)).toLocaleString('fr-CA', { maximumFractionDigits: 1 })} Mo`;
  }
  return `${Math.max(1, Math.round(octets / 1024)).toLocaleString('fr-CA')} Ko`;
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
    return MESSAGE_LOGO_VIDE;
  }
  if (fichier.size > LOGO_TAILLE_MAX) {
    return `Le logo ne doit pas dépasser 1 Mo (ce fichier fait ${tailleEnClair(fichier.size)}).`;
  }
  const entete = new Uint8Array(await fichier.slice(0, 8).arrayBuffer());
  return typeLogo(entete) ? null : MESSAGE_LOGO_FORMAT;
}
