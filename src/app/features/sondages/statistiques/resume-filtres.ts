import { CritereResponse, FiltresStatistiques } from '../../../core/models/statistiques.model';
import { periode } from './graphiques/format';
import { decouperCritere } from './filtres-url';

/** Filtres en clair, pour les rappeler dans les dialogues d'export et d'envoi (« Toutes les versions · Région = Kayes »). */
export function resumeFiltres(filtres: FiltresStatistiques, criteres: CritereResponse[], version: number): string[] {
  const parties = [filtres.lignee ? 'Toutes les versions' : `Version ${version}`];
  if (filtres.du || filtres.au) {
    parties.push(
      `Du ${filtres.du ? periode(filtres.du) : 'début'} au ${filtres.au ? periode(filtres.au) : 'dernier jour'}`,
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
    parties.push(`${def?.libelle ?? cle} = ${valeurs.join(' ou ')}`);
  }
  return parties;
}
