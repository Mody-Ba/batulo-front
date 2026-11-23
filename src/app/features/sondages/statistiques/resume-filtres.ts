import { CritereResponse, FiltresStatistiques } from '../../../core/models/statistiques.model';
import { periode } from './graphiques/format';
import { decouperCritere } from './filtres-url';
import { traduire } from '../../../core/i18n/traduire';

/** Filtres en clair, pour les rappeler dans les dialogues d'export et d'envoi (« Toutes les versions · Région = Kayes »). */
export function resumeFiltres(filtres: FiltresStatistiques, criteres: CritereResponse[], version: number): string[] {
  const parties = [filtres.lignee ? traduire('statistiques.filtres.toutesVersions') : traduire('statistiques.filtres.version', { version })];
  if (filtres.du || filtres.au) {
    parties.push(
      traduire('statistiques.filtres.periode', {
        du: filtres.du ? periode(filtres.du) : traduire('statistiques.envoi.debut'),
        au: filtres.au ? periode(filtres.au) : traduire('statistiques.envoi.dernierJour'),
      }),
    );
  }
  const parCle = new Map<string, string[]>();
  for (const critere of filtres.criteres) {
    const [cle, valeur] = decouperCritere(critere);
    const def = criteres.find((c) => c.cle === cle);
    const libelle = def?.valeurs.find((v) => v.valeur === valeur)?.libelle ?? valeur;
    parCle.set(cle, [...(parCle.get(cle) ?? []), libelle]);
  }
  for (const [cle, valeurs] of parCle) {
    const def = criteres.find((c) => c.cle === cle);
    parties.push(`${def?.libelle ?? cle} = ${valeurs.join(traduire('statistiques.filtres.ou'))}`);
  }
  return parties;
}

/**
 * Total des réponses pour « vue par X répondants sur Y » : seulement pour une seule version. En vue « toutes les
 * versions », le total peut compter des versions où la question n'existait pas (le backend ne donne pas encore ce total
 * par question) : null.
 */
export function totalUneVersion(st: { lignee: boolean; versions: number[]; resume: { nombreReponses: number } }): number | null {
  return !st.lignee || st.versions.length <= 1 ? st.resume.nombreReponses : null;
}
