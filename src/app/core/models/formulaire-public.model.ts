import { ApparenceResponse } from './personnalisation.model';
import { InvitationPubliqueResponse } from './invitation.model';
import { LanguesServies, PageAccueil, SectionAffichee } from './sondage.model';
import { ReponseQuestionRequest } from '../../shared/formulaire/reponses';

/**
 * GET /api/public/sondages/{jeton} (sans compte) : seulement ce qu'il faut pour répondre. Le jeton du lien désigne la
 * lignée ; on répond à sa version ouverte. 404 SONDAGE_INTROUVABLE, 403 SONDAGE_NON_OUVERT, 410 SONDAGE_FERME.
 */
export interface FormulairePublicResponse extends PageAccueil, LanguesServies {
  titre: string;
  description: string | null;
  /** true : une seule réponse par appareil ; le front envoie alors son jetonRepondant. */
  reponseUnique: boolean;
  /** Fermeture prévue ; null si aucune. */
  dateFermeture: string | null;
  /** SectionPubliqueResponse : sans réglages d'analyse internes. */
  sections: SectionAffichee[];
  /** Apparence à l'image de l'entreprise (nom affiché, logo, couleurs) ; rien d'autre sur l'entreprise. */
  apparence?: ApparenceResponse | null;
  /**
   * Seulement si reponseUnique : true si l'appareil (en-tête X-Jeton-Repondant) a déjà répondu à l'une des versions ;
   * false sans jeton ou avec un jeton mal formé. Absent sinon.
   */
  dejaRepondu?: boolean;
  /** Lien personnel (en-tête X-Jeton-Invitation) : jamais d'identité. */
  invitation?: InvitationPubliqueResponse | null;
}

/**
 * POST /api/public/sondages/{jeton}/reponses. 400 REPONSES_INVALIDES (une erreur par question) ou
 * JETON_REPONDANT_INVALIDE, 409 DEJA_REPONDU, 403/410 si le sondage n'est pas ouvert, 429 TROP_DE_REQUETES.
 */
export interface SoumissionRequest {
  /** UUID gardé par le navigateur (un par sondage) ; obligatoire si reponseUnique. */
  jetonRepondant?: string;
  /** Jeton du lien personnel (paramètre « i » du lien reçu par courriel) : une seule réponse par invitation. */
  jetonInvitation?: string;
  /** true quand le sondage exige le consentement (case cochée sur la page d'accueil, à chaque visite). */
  consentement?: boolean;
  /** Langue dans laquelle le formulaire a été vu ; absente : principale (400 LANGUE_INVALIDE si non proposée). */
  langue?: string;
  reponses: ReponseQuestionRequest[];
}

export interface ConfirmationReponseResponse {
  message: string;
  dateSoumission: string;
}
