/**
 * Textes de la vitrine publique (« / » pour un visiteur). Ils décrivent ce que Batulo fait réellement (règles du
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
  { id: 'fonctionnalites', libelle: 'Fonctionnalités' },
  { id: 'comment-ca-marche', libelle: 'Comment ça marche' },
  { id: 'tarifs', libelle: 'Tarifs' },
  { id: 'faq', libelle: 'FAQ' },
  { id: 'contact', libelle: 'Contact' },
];

export interface Fonctionnalite {
  icone: string;
  titre: string;
  texte: string;
}

export const FONCTIONNALITES: readonly Fonctionnalite[] = [
  {
    icone: 'dynamic_form',
    titre: 'Formulaires dynamiques',
    texte: 'Dix types de questions : choix, oui/non, échelle, nombre, date, texte, classement, grille. Sections, glisser-déposer et enregistrement automatique.',
  },
  {
    icone: 'qr_code_2',
    titre: 'Partage par lien et QR code',
    texte: 'Chaque sondage publié a son lien. Imprimez son QR code ; les répondants n’ont besoin d’aucun compte.',
  },
  {
    icone: 'smartphone',
    titre: 'Collecte terrain sur téléphone',
    texte: 'Formulaire pensé pour le téléphone, plusieurs réponses depuis le même appareil, réponses en cours gardées sur l’appareil.',
  },
  {
    icone: 'insights',
    titre: 'Statistiques et tableaux croisés',
    texte: 'Graphiques par question calculés à partir des dernières réponses, filtres par période et par critère, tableaux croisés.',
  },
  {
    icone: 'download',
    titre: 'Exports Excel, CSV et PDF',
    texte: 'Téléchargez les réponses brutes pour Excel, Python ou R, et un rapport PDF prêt à partager.',
  },
  {
    icone: 'groups',
    titre: 'Gestionnaires de l’entreprise',
    texte: 'Créez les comptes de votre équipe, choisissez qui crée des sondages et assignez-leur ceux à suivre.',
  },
];

export interface Etape {
  titre: string;
  texte: string;
}

export const ETAPES: readonly Etape[] = [
  { titre: 'Créez votre compte et abonnez-vous', texte: 'Inscrivez votre entreprise, puis choisissez la formule mensuelle ou annuelle et payez par carte bancaire ou par application mobile (Bankily, Masrvi, Sedad).' },
  { titre: 'Construisez votre sondage', texte: 'Ajoutez sections et questions, prévisualisez sur ordinateur et sur téléphone, puis publiez.' },
  { titre: 'Partagez le lien', texte: 'Envoyez le lien ou affichez le QR code ; collectez aussi sur le terrain depuis un téléphone.' },
  { titre: 'Analysez et exportez', texte: 'Suivez les résultats, croisez les réponses, exportez en Excel, CSV ou PDF.' },
];

export interface QuestionFaq {
  question: string;
  reponse: string;
}

export const FAQ: readonly QuestionFaq[] = [
  {
    question: 'Faut-il un compte pour répondre à un sondage ?',
    reponse: 'Non. Les répondants ouvrent simplement le lien ou scannent le QR code, sur ordinateur ou sur téléphone.',
  },
  {
    question: 'Les réponses sont-elles confidentielles ?',
    reponse:
      'Une réponse n’est liée à aucun compte : seules les informations demandées par le sondage sont enregistrées. Les résultats ne sont visibles que par l’admin de votre entreprise et les gestionnaires concernés.',
  },
  {
    question: 'Comment se fait le paiement ?',
    reponse:
      'Par carte bancaire, avec un paiement sécurisé par Stripe, en dollars canadiens, ou par application mobile (Bankily, Masrvi, Sedad), en ouguiyas. Pour un mois ou pour un an.',
  },
  {
    question: 'Puis-je annuler ?',
    reponse:
      'Il n’y a pas de renouvellement automatique : chaque période est payée à part. Sans renouvellement, l’abonnement expire et votre espace reste consultable en lecture seule.',
  },
  {
    question: 'Puis-je travailler en équipe ?',
    reponse: 'Oui. L’admin crée les comptes de ses gestionnaires, leur donne ou non le droit de créer des sondages et leur assigne ceux à suivre.',
  },
  {
    question: 'Peut-on répondre sans connexion Internet ?',
    reponse: 'Les réponses en cours sont gardées sur l’appareil, mais l’envoi demande une connexion.',
  },
];
