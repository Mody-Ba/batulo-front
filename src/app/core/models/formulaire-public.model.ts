import { SectionResponse } from './sondage.model';
import { ReponseQuestionRequest } from '../../shared/formulaire/reponses';

/**
 * GET /api/public/sondages/{jeton} (sans compte) : seulement ce qu'il faut pour répondre. Le jeton du lien désigne la
 * lignée ; on répond à sa version ouverte. 404 SONDAGE_INTROUVABLE, 403 SONDAGE_NON_OUVERT, 410 SONDAGE_FERME.
 */
export interface FormulairePublicResponse {
  titre: string;
  description: string | null;
  /** true : une seule réponse par appareil ; le front envoie alors son jetonRepondant. */
  reponseUnique: boolean;
  /** Fermeture prévue ; null si aucune. */
  dateFermeture: string | null;
  sections: SectionResponse[];
}

/**
 * POST /api/public/sondages/{jeton}/reponses. 400 REPONSES_INVALIDES (une erreur par question) ou
 * JETON_REPONDANT_INVALIDE, 409 DEJA_REPONDU, 403/410 si le sondage n'est pas ouvert, 429 TROP_DE_REQUETES.
 */
export interface SoumissionRequest {
  /** UUID gardé par le navigateur (un par sondage) ; obligatoire si reponseUnique. */
  jetonRepondant?: string;
  reponses: ReponseQuestionRequest[];
}

export interface ConfirmationReponseResponse {
  message: string;
  dateSoumission: string;
}
