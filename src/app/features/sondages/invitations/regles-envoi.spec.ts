import { inviteDeTest as invite, resumeInvitationsDeTest as resume } from '../../../testing/donnees-test';
import { ContexteEnvoi, ouvertureEnvoi, raisonEnvoiImpossible, raisonRelanceImpossible } from './regles-envoi';

const MAINTENANT = new Date('2026-11-20T12:00:00Z').getTime();
const IL_Y_A = (h: number) => new Date(MAINTENANT - h * 3_600_000).toISOString();

function ctx(modifs: Partial<ContexteEnvoi> = {}): ContexteEnvoi {
  return { ouverture: 'ouvert', lectureSeule: false, limiteJusqua: null, resume: resume(), selection: [], maintenant: MAINTENANT, ...modifs };
}

describe('Règles d’envoi et de relance des invitations', () => {
  it('ouverture : une version publiée en cours ou planifiée ; sinon jamais publié ou terminé', () => {
    expect(ouvertureEnvoi([])).toBe('jamais-publie');
    expect(ouvertureEnvoi([{ publie: false, statut: 'NON_COMMENCE' }])).toBe('jamais-publie');
    expect(ouvertureEnvoi([{ publie: true, statut: 'NON_COMMENCE' }])).toBe('ouvert');
    expect(ouvertureEnvoi([{ publie: true, statut: 'TERMINE' }, { publie: false, statut: 'NON_COMMENCE' }])).toBe('termine');
    expect(ouvertureEnvoi([{ publie: true, statut: 'TERMINE' }, { publie: true, statut: 'EN_COURS' }])).toBe('ouvert');
  });

  it('raisons communes : lecture seule, sondage non publié, terminé, limite horaire', () => {
    expect(raisonEnvoiImpossible(ctx({ lectureSeule: true }))).toContain('lecture seule');
    expect(raisonEnvoiImpossible(ctx({ ouverture: 'jamais-publie' }))).toContain('publiez le sondage');
    expect(raisonRelanceImpossible(ctx({ ouverture: 'termine' }))).toContain('ce sondage est terminé');
    expect(raisonEnvoiImpossible(ctx({ limiteJusqua: MAINTENANT + 60_000 }))).toContain('limite d’envois par heure');
    expect(raisonEnvoiImpossible(ctx({ limiteJusqua: MAINTENANT - 1 }))).toBeNull();
  });

  it('envoyer : personne à inviter, ou sélection déjà invitée ; un premier envoi en échec se retente', () => {
    expect(raisonEnvoiImpossible(ctx())).toBeNull();
    expect(raisonEnvoiImpossible(ctx({ resume: resume({ total: 0, aInviter: 0 }) }))).toContain('ajoutez d’abord des invités');
    expect(raisonEnvoiImpossible(ctx({ resume: resume({ aInviter: 0 }) }))).toContain('ont déjà reçu leur invitation');
    expect(raisonEnvoiImpossible(ctx({ selection: [invite({ statut: 'INVITEE', premierEnvoiLe: IL_Y_A(2) })] }))).toContain(
      'invités sélectionnés ont déjà reçu',
    );
    expect(raisonEnvoiImpossible(ctx({ selection: [invite({ statut: 'EN_ECHEC' })] }))).toBeNull();
  });

  it('relancer : délai de 24 h pour la sélection (date de la prochaine relance), personne sans réponse', () => {
    const recent = invite({ statut: 'INVITEE', premierEnvoiLe: IL_Y_A(3), dernierEnvoiLe: IL_Y_A(3) });
    expect(raisonRelanceImpossible(ctx({ selection: [recent] }))).toMatch(/24 h ; possible à partir du .+/);
    expect(raisonRelanceImpossible(ctx({ selection: [{ ...recent, dernierEnvoiLe: IL_Y_A(25) }] }))).toBeNull();
    expect(raisonRelanceImpossible(ctx({ selection: [invite(), invite({ id: 2, statut: 'A_REPONDU', premierEnvoiLe: IL_Y_A(30) })] }))).toContain(
      'aucun invité sélectionné n’est à relancer',
    );
    expect(raisonRelanceImpossible(ctx({ resume: resume({ invitees: 0, ouvertes: 0, enEchec: 0 }) }))).toContain('personne n’attend');
    expect(raisonRelanceImpossible(ctx())).toBeNull();
  });
});
