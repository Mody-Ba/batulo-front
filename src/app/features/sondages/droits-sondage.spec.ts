import { UtilisateurResponse } from '../../core/models/utilisateur.model';
import { messageLectureSeule } from '../../core/services/auth.service';
import { gestionnaireDeTest } from '../../testing/donnees-test';
import {
  messageReserveCreateur,
  messageSansPermission,
  messageSondageFerme,
  messageSondagePublie,
  raisonLectureSeule,
} from './droits-sondage';

describe('raisonLectureSeule', () => {
  const brouillon = { publie: false, statut: 'NON_COMMENCE' as const, creePar: { id: 7, prenom: 'M', nom: 'K' } };
  const gestionnaire = (modifs: Partial<UtilisateurResponse> = {}) =>
    gestionnaireDeTest({ peutCreerSondages: true, ...modifs }) as UtilisateurResponse;

  it('admin : tout brouillon de l’entreprise est modifiable', () => {
    expect(raisonLectureSeule(brouillon, { role: 'ADMIN', utilisateur: null, lectureSeule: false })).toBeNull();
  });

  it('publié ou fermé : jamais modifiable, avec le renvoi à une nouvelle version', () => {
    const contexte = { role: 'ADMIN' as const, utilisateur: null, lectureSeule: false };
    expect(raisonLectureSeule({ ...brouillon, publie: true, statut: 'EN_COURS' }, contexte)).toBe(messageSondagePublie());
    expect(raisonLectureSeule({ ...brouillon, publie: true, statut: 'TERMINE' }, contexte)).toBe(messageSondageFerme());
  });

  it('abonnement expiré : lecture seule', () => {
    expect(raisonLectureSeule(brouillon, { role: 'ADMIN', utilisateur: null, lectureSeule: true })).toBe(
      messageLectureSeule(),
    );
  });

  it('gestionnaire : seulement ses brouillons, et avec la permission', () => {
    expect(
      raisonLectureSeule(brouillon, { role: 'GESTIONNAIRE', utilisateur: gestionnaire(), lectureSeule: false }),
    ).toBeNull();
    expect(
      raisonLectureSeule(brouillon, {
        role: 'GESTIONNAIRE',
        utilisateur: gestionnaire({ peutCreerSondages: false }),
        lectureSeule: false,
      }),
    ).toBe(messageSansPermission());
    expect(
      raisonLectureSeule(brouillon, { role: 'GESTIONNAIRE', utilisateur: gestionnaire({ id: 8 }), lectureSeule: false }),
    ).toBe(messageReserveCreateur());
  });
});
