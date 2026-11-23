import { HttpErrorResponse } from '@angular/common/http';
import { langueCourante, traduire, traduireSiConnu } from '../i18n/traduire';
import { CODES_ERREUR, ErreurApi } from '../models/erreur.model';

// Messages du front (clés « public.erreurs » : aussi utilisées par le formulaire public, qui ne charge que son fichier).
export const messageInjoignable = (): string => traduire('public.erreurs.injoignable');
export const messageInattendu = (): string => traduire('public.erreurs.inattendue');
export const messageServeur = (): string => traduire('public.erreurs.serveur');
export const messageValidation = (): string => traduire('public.erreurs.validation');

/**
 * Message traduit d'un code du backend : « erreursApi.CODE » (fichier principal) ou « public.erreursApi.CODE »
 * (codes vus par le formulaire public), sinon null.
 */
export function messageDuCode(code: string | null | undefined): string | null {
  if (!code || !/^[A-Z0-9_]+$/.test(code)) {
    return null;
  }
  return traduireSiConnu(`erreursApi.${code}`) ?? traduireSiConnu(`public.erreursApi.${code}`);
}

/**
 * Message d'une erreur du backend dans la langue courante. En français, le message du serveur (déjà en français, et
 * souvent plus précis : dates, noms) ; dans une autre langue, la traduction de son code, sinon le message du serveur.
 */
export function messageApi(code: string | null | undefined, messageServeurRecu: string | null | undefined): string | null {
  const recu = typeof messageServeurRecu === 'string' && messageServeurRecu.trim() ? messageServeurRecu : null;
  if (langueCourante() === 'fr' && recu) {
    return recu;
  }
  return messageDuCode(code) ?? recu;
}

/** Noms des champs du backend (erreurs VALIDATION « champ : message ») : libellé traduit s'il est connu. */
function libelleChamp(champ: string): string {
  return /^\w+$/.test(champ) ? (traduireSiConnu(`erreurs.champs.${champ}`) ?? champ) : champ;
}

/** Corps JSON { code, message } d'une réponse d'erreur, ou null s'il est absent ou illisible. */
export function corpsErreur(erreur: unknown): Partial<ErreurApi> | null {
  if (!(erreur instanceof HttpErrorResponse)) {
    return null;
  }
  const corps: unknown = erreur.error;
  return corps && typeof corps === 'object' ? (corps as Partial<ErreurApi>) : null;
}

/** Code stable du backend (ex. IDENTIFIANTS_INVALIDES), ou null. */
export function codeErreur(erreur: unknown): string | null {
  const code = corpsErreur(erreur)?.code;
  return typeof code === 'string' ? code : null;
}

export function aLeCode(erreur: unknown, code: string): boolean {
  return codeErreur(erreur) === code;
}

/**
 * Message à afficher : celui du backend traduit par son code (messageApi), jamais une trace technique.
 * Pour une erreur VALIDATION, le détail par champ est donné par detailsErreur().
 */
export function messageErreur(erreur: unknown, parDefaut?: string): string {
  if (erreur instanceof HttpErrorResponse) {
    if (erreur.status === 0) {
      return messageInjoignable();
    }
    if (codeErreur(erreur) === CODES_ERREUR.VALIDATION && detailsErreur(erreur).length) {
      return messageValidation();
    }
    const message = messageApi(codeErreur(erreur), corpsErreur(erreur)?.message);
    if (message) {
      return message;
    }
    if (erreur.status >= 500) {
      return messageServeur();
    }
  }
  return parDefaut ?? messageInattendu();
}

/**
 * Détail d'une erreur VALIDATION : le backend envoie « champ : message ; champ : message ».
 * Chaque ligne devient « Libellé : message ».
 */
export function detailsErreur(erreur: unknown): string[] {
  if (codeErreur(erreur) !== CODES_ERREUR.VALIDATION) {
    return [];
  }
  const message = corpsErreur(erreur)?.message;
  if (typeof message !== 'string') {
    return [];
  }
  return message
    .split(' ; ')
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.includes(' : '))
    .map((ligne) => {
      const separateur = ligne.indexOf(' : ');
      const champ = ligne.slice(0, separateur);
      const texte = ligne.slice(separateur + 3);
      return traduire('public.erreurs.detailChamp', { champ: libelleChamp(champ), message: texte });
    });
}
