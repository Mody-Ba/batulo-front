import { TexteTraduction } from '../../../core/models/traduction.model';
import { traduireSiConnu } from '../../../core/i18n/traduire';

/** Textes d'un même élément du formulaire : le sondage, une section ou une question (options, lignes, colonnes). */
export interface GroupeTraductions {
  cle: string;
  niveau: 'sondage' | 'section' | 'question';
  /** Numéro de la section ou de la question (dans l'ordre du formulaire), 0 pour le sondage. */
  numero: number;
  /** Texte principal qui nomme le groupe (titre de la section, libellé de la question), ou null. */
  nom: string | null;
  textes: TexteTraduction[];
}

/**
 * Regroupe les textes (déjà dans l'ordre du formulaire) : le sondage, puis chaque section suivie de ses questions.
 * Une option, une ligne ou une colonne rejoint sa question.
 */
export function grouperTraductions(textes: readonly TexteTraduction[]): GroupeTraductions[] {
  const groupes: GroupeTraductions[] = [];
  const parCle = new Map<string, GroupeTraductions>();
  let sections = 0;
  let questions = 0;
  for (const texte of textes) {
    let cle: string;
    let niveau: GroupeTraductions['niveau'];
    if (texte.element === 'SONDAGE') {
      cle = 'sondage';
      niveau = 'sondage';
    } else if (texte.element === 'SECTION') {
      cle = `section.${texte.sectionId}`;
      niveau = 'section';
    } else {
      cle = `question.${texte.questionId}`;
      niveau = 'question';
    }
    let groupe = parCle.get(cle);
    if (!groupe) {
      const numero = niveau === 'section' ? ++sections : niveau === 'question' ? ++questions : 0;
      groupe = { cle, niveau, numero, nom: null, textes: [] };
      parCle.set(cle, groupe);
      groupes.push(groupe);
    }
    if (groupe.nom === null && ((niveau === 'section' && texte.champ === 'titre') || (niveau === 'question' && texte.element === 'QUESTION' && texte.champ === 'libelle'))) {
      groupe.nom = texte.source;
    }
    groupe.textes.push(texte);
  }
  return groupes;
}

/** Nom du champ (« Titre », « Aide », « Option », « Ligne »…) ; clés traductions.champs.*. */
export function libelleChamp(texte: Pick<TexteTraduction, 'element' | 'champ'>): string {
  const cle =
    texte.element === 'OPTION'
      ? 'option'
      : texte.element === 'LIGNE'
        ? 'ligne'
        : texte.element === 'COLONNE'
          ? 'colonne'
          : texte.element === 'QUESTION' && texte.champ === 'libelle'
            ? 'question'
            : texte.champ;
  return traduireSiConnu(`traductions.champs.${cle}`) ?? texte.champ;
}

/** Un texte long (descriptions, page d'accueil, aide) s'écrit dans une zone de plusieurs lignes. */
export function texteLong(texte: Pick<TexteTraduction, 'champ' | 'longueurMax' | 'source'>): boolean {
  return texte.longueurMax > 255 || texte.source.length > 80 || texte.source.includes('\n');
}
