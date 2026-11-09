import { HttpErrorResponse } from '@angular/common/http';
import { CODES_ERREUR, ErreurApi } from '../models/erreur.model';

export const MESSAGE_INJOIGNABLE =
  'Le serveur Batulo est injoignable. Vérifiez votre connexion puis réessayez.';
export const MESSAGE_INATTENDU = 'Une erreur inattendue est survenue. Réessayez.';
export const MESSAGE_SERVEUR = 'Le serveur a rencontré un problème. Réessayez dans un instant.';
export const MESSAGE_VALIDATION = 'Certaines informations sont invalides :';

/** Noms des champs du backend -> libellés affichés (erreurs VALIDATION « champ : message »). */
const LIBELLES_CHAMPS: Record<string, string> = {
  prenom: 'Prénom',
  nom: 'Nom',
  courriel: 'Courriel',
  motDePasse: 'Mot de passe',
  motDePasseActuel: 'Mot de passe actuel',
  nouveauMotDePasse: 'Nouveau mot de passe',
  confirmationMotDePasse: 'Confirmation',
  nomEntreprise: 'Entreprise',
  jeton: 'Lien',
  jetonRafraichissement: 'Session',
};

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
 * Message à afficher : celui du backend (déjà en français), jamais une trace technique.
 * Pour une erreur VALIDATION, le détail par champ est donné par detailsErreur().
 */
export function messageErreur(erreur: unknown, parDefaut = MESSAGE_INATTENDU): string {
  if (erreur instanceof HttpErrorResponse) {
    if (erreur.status === 0) {
      return MESSAGE_INJOIGNABLE;
    }
    if (codeErreur(erreur) === CODES_ERREUR.VALIDATION && detailsErreur(erreur).length) {
      return MESSAGE_VALIDATION;
    }
    const message = corpsErreur(erreur)?.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
    if (erreur.status >= 500) {
      return MESSAGE_SERVEUR;
    }
  }
  return parDefaut;
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
      return `${LIBELLES_CHAMPS[champ] ?? champ} : ${texte}`;
    });
}
