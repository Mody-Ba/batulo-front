/**
 * Textes de la vitrine publique (« / » pour un visiteur), sous forme de clés de traduction (public/i18n). Ils décrivent ce que Batulo fait réellement (règles du
 * backend) : ne rien promettre de plus. Les prix ne sont jamais écrits ici : ils viennent de GET /api/abonnements/formules.
 */

/** Adresse de contact affichée (domaine réservé .example : à remplacer par la vraie adresse avant la mise en ligne). */
export const COURRIEL_CONTACT = 'contact@batulo.example';

export const ANNEE_COPYRIGHT = 2026;

/** Sections de la page, dans l'ordre des liens de la barre du haut. */
export interface SectionVitrine {
  id: string;
  libelle: string;
}

export const SECTIONS_VITRINE: readonly SectionVitrine[] = [
  { id: 'fonctionnalites', libelle: 'vitrine.sections.fonctionnalites' },
  { id: 'comment-ca-marche', libelle: 'vitrine.sections.comment_ca_marche' },
  { id: 'tarifs', libelle: 'vitrine.sections.tarifs' },
  { id: 'faq', libelle: 'vitrine.sections.faq' },
  { id: 'contact', libelle: 'vitrine.sections.contact' },
];

export interface Fonctionnalite {
  icone: string;
  titre: string;
  texte: string;
}

export const FONCTIONNALITES: readonly Fonctionnalite[] = [
  {
    icone: 'dynamic_form',
    titre: 'vitrine.fonctionnalites.dynamic_form.titre',
    texte: 'vitrine.fonctionnalites.dynamic_form.texte',
  },
  {
    icone: 'qr_code_2',
    titre: 'vitrine.fonctionnalites.qr_code_2.titre',
    texte: 'vitrine.fonctionnalites.qr_code_2.texte',
  },
  {
    icone: 'smartphone',
    titre: 'vitrine.fonctionnalites.smartphone.titre',
    texte: 'vitrine.fonctionnalites.smartphone.texte',
  },
  {
    icone: 'insights',
    titre: 'vitrine.fonctionnalites.insights.titre',
    texte: 'vitrine.fonctionnalites.insights.texte',
  },
  {
    icone: 'download',
    titre: 'vitrine.fonctionnalites.download.titre',
    texte: 'vitrine.fonctionnalites.download.texte',
  },
  {
    icone: 'groups',
    titre: 'vitrine.fonctionnalites.groups.titre',
    texte: 'vitrine.fonctionnalites.groups.texte',
  },
];

export interface Etape {
  titre: string;
  texte: string;
}

export const ETAPES: readonly Etape[] = [
  { titre: 'vitrine.etapes.e1.titre', texte: 'vitrine.etapes.e1.texte' },
  { titre: 'vitrine.etapes.e2.titre', texte: 'vitrine.etapes.e2.texte' },
  { titre: 'vitrine.etapes.e3.titre', texte: 'vitrine.etapes.e3.texte' },
  { titre: 'vitrine.etapes.e4.titre', texte: 'vitrine.etapes.e4.texte' },
];

export interface QuestionFaq {
  question: string;
  reponse: string;
}

export const FAQ: readonly QuestionFaq[] = [
  {
    question: 'vitrine.faq.q1.question',
    reponse: 'vitrine.faq.q1.reponse',
  },
  {
    question: 'vitrine.faq.q2.question',
    reponse:
      'vitrine.faq.q2.reponse',
  },
  {
    question: 'vitrine.faq.q3.question',
    reponse:
      'vitrine.faq.q3.reponse',
  },
  {
    question: 'vitrine.faq.q4.question',
    reponse:
      'vitrine.faq.q4.reponse',
  },
  {
    question: 'vitrine.faq.q5.question',
    reponse: 'vitrine.faq.q5.reponse',
  },
  {
    question: 'vitrine.faq.q6.question',
    reponse: 'vitrine.faq.q6.reponse',
  },
];
