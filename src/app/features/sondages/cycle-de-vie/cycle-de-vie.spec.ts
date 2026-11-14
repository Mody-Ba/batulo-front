import { etatSondage, libelleEtatSondage, VersionResponse } from '../../../core/models/sondage.model';
import { UtilisateurResponse } from '../../../core/models/utilisateur.model';
import { gestionnaireDeTest, questionDeTest, sectionDeTest } from '../../../testing/donnees-test';
import { droitsSondage } from '../droits-sondage';
import { raisonIncomplet, versIso, versLocal } from './dates-sondage';
import { situationVersions } from './versions';

function version(modifs: Partial<VersionResponse>): VersionResponse {
  return {
    id: 1,
    version: 1,
    titre: 'S',
    statut: 'TERMINE',
    publie: true,
    datePublication: null,
    dateFermeture: null,
    dateCreation: '2026-01-01T00:00:00Z',
    nombreReponses: 0,
    ...modifs,
  };
}

describe('Cycle de vie : états, versions, dates, droits', () => {
  it('état affiché : Brouillon, Planifié, En cours, Terminé', () => {
    expect(libelleEtatSondage({ publie: false, statut: 'NON_COMMENCE' })).toBe('Brouillon');
    expect(libelleEtatSondage({ publie: true, statut: 'NON_COMMENCE' })).toBe('Planifié');
    expect(etatSondage({ publie: true, statut: 'EN_COURS' })).toBe('EN_COURS');
    expect(libelleEtatSondage({ publie: true, statut: 'TERMINE' })).toBe('Terminé');
  });

  it('versions : nouvelle version seulement depuis la dernière publiée ; brouillon en préparation repéré', () => {
    const lignee = [version({ id: 1, version: 1 }), version({ id: 2, version: 2, statut: 'EN_COURS' })];
    expect(situationVersions(2, lignee)).toEqual({ brouillon: null, derniereVersionPubliee: true });
    expect(situationVersions(1, lignee).derniereVersionPubliee).toBe(false);
    const avecBrouillon = [...lignee, version({ id: 3, version: 3, publie: false, statut: 'NON_COMMENCE' })];
    expect(situationVersions(2, avecBrouillon).brouillon?.id).toBe(3);
  });

  it('dates : aller-retour entre le champ date et heure et ISO ; sondage incomplet', () => {
    const iso = versIso('2030-03-01T09:30')!;
    expect(versLocal(iso)).toBe('2030-03-01T09:30');
    expect(versIso('')).toBeNull();
    expect(raisonIncomplet([])).toBe('Le sondage n’a aucune section : rien à publier.');
    expect(raisonIncomplet([sectionDeTest({ questions: [questionDeTest()] })])).toBeNull();
  });

  it('droits : admin gère ; créateur avec permission gère ; assigné avec permission duplique seulement', () => {
    const sondage = { publie: true, statut: 'EN_COURS' as const, creePar: { id: 7, prenom: 'M', nom: 'K' } };
    const admin = droitsSondage(sondage, { role: 'ADMIN', utilisateur: null, lectureSeule: false });
    expect(admin).toEqual({ modifierContenu: false, gerer: true, dupliquer: true, previsualiser: true, diffuser: true });

    const createur = gestionnaireDeTest({ id: 7, peutCreerSondages: true }) as UtilisateurResponse;
    expect(droitsSondage(sondage, { role: 'GESTIONNAIRE', utilisateur: createur, lectureSeule: false }).gerer).toBe(true);

    const assigne = gestionnaireDeTest({ id: 8, peutCreerSondages: true }) as UtilisateurResponse;
    const d = droitsSondage(sondage, { role: 'GESTIONNAIRE', utilisateur: assigne, lectureSeule: false });
    expect(d).toEqual({ modifierContenu: false, gerer: false, dupliquer: true, previsualiser: true, diffuser: true });

    const sansPermission = gestionnaireDeTest({ id: 7, peutCreerSondages: false }) as UtilisateurResponse;
    expect(
      droitsSondage(sondage, { role: 'GESTIONNAIRE', utilisateur: sansPermission, lectureSeule: false }),
    ).toEqual(expect.objectContaining({ gerer: false, dupliquer: false, previsualiser: true }));

    expect(droitsSondage(sondage, { role: 'ADMIN', utilisateur: null, lectureSeule: true })).toEqual(
      expect.objectContaining({ gerer: false, dupliquer: false, diffuser: true }),
    );
  });
});
