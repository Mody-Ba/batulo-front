import { questionDeTest } from '../../../testing/donnees-test';
import { formaterReponse } from '../reponses/formater-reponse';
import { decouperCritere, filtresActifs, filtresDepuisUrl, parametresUrl } from './filtres-url';
import { decimal, nombre, periode, pourcentage } from './graphiques/format';
import { grouperParSection } from './groupes-questions';
import { resumeFiltres } from './resume-filtres';
import { QuestionStat } from '../../../core/models/statistiques.model';

describe('Filtres d’URL, mise en forme et regroupement', () => {
  it('filtres lus dans l’URL : valeurs invalides ignorées, critere seul ou répété, doublons retirés', () => {
    expect(filtresDepuisUrl({})).toEqual({ lignee: false, du: null, au: null, granularite: null, criteres: [] });
    expect(
      filtresDepuisUrl({ lignee: 'true', du: '2026-11-01', au: 'demain', granularite: 'SEMAINE', critere: ['a:1', 'a:1', 'mauvais', 'b:x:y'] }),
    ).toEqual({ lignee: true, du: '2026-11-01', au: null, granularite: null, criteres: ['a:1', 'b:x:y'] });
    expect(filtresDepuisUrl({ critere: 'region:kayes' }).criteres).toEqual(['region:kayes']);
    expect(decouperCritere('b:x:y')).toEqual(['b', 'x:y']);
  });

  it('paramètres d’URL : valeurs par défaut retirées ; aller-retour sans perte', () => {
    const filtres = { lignee: true, du: '2026-11-01', au: null, granularite: 'JOUR' as const, criteres: ['a:1'] };
    expect(parametresUrl(filtres)).toEqual({ lignee: 'true', du: '2026-11-01', au: null, granularite: 'JOUR', critere: ['a:1'] });
    expect(filtresDepuisUrl({ lignee: 'true', du: '2026-11-01', granularite: 'JOUR', critere: ['a:1'] })).toEqual(filtres);
    expect(parametresUrl({ lignee: false, du: null, au: null, granularite: null, criteres: [] })).toEqual({
      lignee: null, du: null, au: null, granularite: null, critere: null,
    });
    expect(filtresActifs(filtres)).toBe(true);
  });

  it('résumé des filtres en clair (OU dans une clé)', () => {
    const criteres = [
      { cle: 'region', questionId: 1, libelle: 'Région', type: 'CHOIX_UNIQUE' as const, valeurs: [{ valeur: 'kayes', libelle: 'Kayes' }, { valeur: 'dakar', libelle: 'Dakar' }] },
    ];
    expect(resumeFiltres({ lignee: false, du: null, au: null, granularite: null, criteres: ['region:kayes', 'region:dakar'] }, criteres, 2)).toEqual([
      'Version 2',
      'Région = Kayes ou Dakar',
    ]);
  });

  it('nombres et pourcentages en français', () => {
    expect(nombre(1234)).toBe('1 234');
    expect(decimal(22.456)).toBe('22,46');
    expect(pourcentage(51.66)).toBe('51,7 %');
    expect(nombre(null)).toBe('—');
    expect(periode('2026-03')).toContain('2026');
  });

  it('questions regroupées par section, numérotation continue', () => {
    const q = (id: number, section: string) => ({ questionId: id, section }) as QuestionStat;
    const groupes = grouperParSection([q(1, 'A'), q(2, 'A'), q(3, 'B')]);
    expect(groupes.map((g) => [g.section, g.questions.map((x) => x.numero)])).toEqual([['A', [1, 2]], ['B', [3]]]);
  });

  it('réponse mise en forme avec les libellés de la question', () => {
    const choix = questionDeTest();
    expect(formaterReponse('CHOIX_UNIQUE', 'commerce', choix)).toEqual({ texte: 'Commerce' });
    expect(formaterReponse('CHOIX_MULTIPLE', ['agriculture', 'commerce'], choix)).toEqual({ texte: 'Agriculture, Commerce' });
    expect(formaterReponse('CLASSEMENT', ['commerce', 'agriculture'], choix)).toEqual({ liste: ['Commerce', 'Agriculture'] });
    expect(formaterReponse('OUI_NON', false)).toEqual({ texte: 'Non' });
    expect(formaterReponse('ECHELLE', 4, questionDeTest({ type: 'ECHELLE', configuration: { min: 1, max: 5 } }))).toEqual({ texte: '4 sur 5' });
    expect(formaterReponse('NUMERIQUE', 1234.5)).toEqual({ texte: '1 234,5' });
    expect(formaterReponse('DATE', '2026-03-05')!.texte).toContain('2026');
    expect(
      formaterReponse('MATRICE', { Accueil: 'Bon', Prix: 'Mauvais' }, questionDeTest({ type: 'MATRICE', configuration: { lignes: ['Prix', 'Accueil'], colonnes: ['Bon', 'Mauvais'] } })),
    ).toEqual({ paires: [['Prix', 'Mauvais'], ['Accueil', 'Bon']] });
    expect(formaterReponse('CHOIX_UNIQUE', 'inconnu')).toEqual({ texte: 'inconnu' });
    expect(formaterReponse('TEXTE_COURT', '')).toBeNull();
  });
});
