import { VersionResponse } from '../../../core/models/sondage.model';

export interface SituationVersions {
  /** Brouillon de la lignée (une seule version en préparation à la fois), ou null. */
  brouillon: VersionResponse | null;
  /** Ce sondage est la dernière version publiée : on peut en créer une nouvelle version. */
  derniereVersionPubliee: boolean;
}

/**
 * Situation d'une version dans sa lignée (GET .../versions, de la plus ancienne à la plus récente), pour proposer
 * « Nouvelle version » (dernière version publiée, sans brouillon : sinon 409 VERSION_OBSOLETE ou BROUILLON_EXISTANT)
 * ou « Ouvrir la version en préparation ».
 */
export function situationVersions(sondageId: number, versions: readonly VersionResponse[]): SituationVersions {
  const publiees = versions.filter((v) => v.publie);
  const derniere = publiees.reduce<VersionResponse | null>(
    (max, v) => (max === null || v.version > max.version ? v : max),
    null,
  );
  return {
    brouillon: versions.find((v) => !v.publie) ?? null,
    derniereVersionPubliee: derniere?.id === sondageId,
  };
}
