import { ENTETES_CSV_INVITES } from '../../../core/models/invitation.model';

/** Nom du modèle CSV téléchargé. */
export const NOM_MODELE_CSV = 'modele-invites.csv';

/**
 * Modèle CSV d'import : UTF-8 avec BOM (Excel reconnaît les accents), séparateur « ; » (Excel en français ; le serveur
 * accepte aussi « , »), en-têtes attendus par le serveur et une ligne d'exemple.
 */
export function contenuModeleCsv(): string {
  const exemple = ['Aminata', 'Diallo', 'aminata.diallo@exemple.com', '+222 22 33 44 55', 'ar'];
  return '﻿' + [ENTETES_CSV_INVITES.join(';'), exemple.join(';')].join('\r\n') + '\r\n';
}

export function modeleCsv(): Blob {
  return new Blob([contenuModeleCsv()], { type: 'text/csv;charset=utf-8' });
}

/** Fichier acceptable avant envoi : extension .csv (le serveur vérifie le contenu). */
export function estFichierCsv(fichier: Pick<File, 'name' | 'type'>): boolean {
  return /\.csv$/i.test(fichier.name) || fichier.type === 'text/csv';
}
