import {
  ConfigurationEchelle,
  ConfigurationMatrice,
  QuestionResponse,
  TypeQuestion,
} from '../../../core/models/sondage.model';
import { formaterDate } from '../../../shared/formulaire/reponses';

/** Valeur d'une réponse mise en forme : un texte, une liste ordonnée (classement) ou des paires (matrice). */
export interface ReponseMiseEnForme {
  texte?: string;
  liste?: string[];
  paires?: [string, string][];
}

const nombres = new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 4 });

/**
 * Met en forme une valeur telle qu'enregistrée (codes d'options, true/false, AAAA-MM-JJ, objet de matrice...) avec
 * les libellés de la question. Sans la question (autre version), la valeur brute est montrée telle quelle.
 */
export function formaterReponse(
  type: TypeQuestion,
  valeur: unknown,
  question?: QuestionResponse,
): ReponseMiseEnForme | null {
  if (valeur === null || valeur === undefined || valeur === '') {
    return null;
  }
  const libelle = (code: unknown) =>
    question?.options.find((o) => o.valeur === code)?.libelle ?? String(code);
  switch (type) {
    case 'CHOIX_UNIQUE':
      return { texte: libelle(valeur) };
    case 'CHOIX_MULTIPLE':
      return { texte: (Array.isArray(valeur) ? valeur : [valeur]).map(libelle).join(', ') };
    case 'CLASSEMENT':
      return { liste: (Array.isArray(valeur) ? valeur : [valeur]).map(libelle) };
    case 'OUI_NON':
      return { texte: valeur === true || valeur === 'true' ? 'Oui' : 'Non' };
    case 'ECHELLE': {
      const max = (question?.configuration as Partial<ConfigurationEchelle> | undefined)?.max;
      return { texte: max ? `${valeur} sur ${max}` : String(valeur) };
    }
    case 'NUMERIQUE':
      return { texte: typeof valeur === 'number' ? nombres.format(valeur) : String(valeur) };
    case 'DATE':
      return { texte: typeof valeur === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valeur) ? formaterDate(valeur) : String(valeur) };
    case 'MATRICE': {
      if (typeof valeur !== 'object' || Array.isArray(valeur)) {
        return { texte: String(valeur) };
      }
      const objet = valeur as Record<string, string>;
      const lignes = (question?.configuration as Partial<ConfigurationMatrice> | undefined)?.lignes ?? Object.keys(objet);
      return { paires: lignes.filter((l) => l in objet).map((l) => [l, objet[l]] as [string, string]) };
    }
    default:
      return { texte: String(valeur) };
  }
}
