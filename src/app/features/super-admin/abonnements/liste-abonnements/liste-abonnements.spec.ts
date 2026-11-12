import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { expireBientot } from '../../../../core/models/super-admin.model';
import { SuperAdminService } from '../../../../core/services/super-admin.service';
import { abonnementAdminDeTest, abonnementDeTest } from '../../../../testing/donnees-test';
import { libelleJoursRestants } from '../../../../shared/components/echeance-abonnement/echeance-abonnement';
import { ListeAbonnements } from './liste-abonnements';

describe('ListeAbonnements', () => {
  let fixture: ComponentFixture<ListeAbonnements>;
  let lister: ReturnType<typeof vi.fn>;

  async function creer(entrees: Record<string, string> = {}): Promise<HTMLElement> {
    fixture = TestBed.createComponent(ListeAbonnements);
    for (const [nom, valeur] of Object.entries(entrees)) {
      fixture.componentRef.setInput(nom, valeur);
    }
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  beforeEach(() => {
    lister = vi.fn(() =>
      of({
        contenu: [
          abonnementAdminDeTest({
            abonnement: abonnementDeTest({ id: 1, entreprise: 'Bientôt SA', statut: 'EXPIRE_BIENTOT', joursRestants: 3 }),
          }),
          abonnementAdminDeTest({ abonnement: abonnementDeTest({ id: 2, entreprise: 'Tranquille SA' }) }),
          abonnementAdminDeTest({
            abonnement: abonnementDeTest({
              id: 3,
              entreprise: 'Nouvelle SA',
              statut: 'EN_ATTENTE_PAIEMENT',
              formule: null,
              dateExpiration: null,
              joursRestants: null,
            }),
          }),
        ],
        page: 0,
        taille: 20,
        totalElements: 3,
        totalPages: 1,
      }),
    );
    TestBed.configureTestingModule({
      imports: [ListeAbonnements],
      providers: [provideRouter([]), { provide: SuperAdminService, useValue: { listerAbonnements: lister } }],
    });
  });

  it('expire bientôt : 7 jours ou moins, jamais un abonnement expiré ou désactivé', () => {
    expect(expireBientot(abonnementDeTest({ statut: 'EXPIRE_BIENTOT', joursRestants: 5 }))).toBe(true);
    expect(expireBientot(abonnementDeTest({ statut: 'ACTIF', joursRestants: 7 }))).toBe(true);
    expect(expireBientot(abonnementDeTest({ statut: 'ACTIF', joursRestants: 8 }))).toBe(false);
    expect(expireBientot(abonnementDeTest({ statut: 'EXPIRE', joursRestants: 0 }))).toBe(false);
    expect(expireBientot(abonnementDeTest({ statut: 'DESACTIVE', joursRestants: 2 }))).toBe(false);
    expect(libelleJoursRestants(1)).toBe('Expire demain');
    expect(libelleJoursRestants(3)).toBe('Expire dans 3 jours');
  });

  it('transmet le statut de l’URL ; un statut inconnu est ignoré', async () => {
    await creer({ statut: 'EXPIRE', page: '1', taille: '50' });
    expect(lister).toHaveBeenLastCalledWith({ statut: 'EXPIRE', page: 1, taille: 50 });

    await creer({ statut: 'N_IMPORTE_QUOI' });
    expect(lister).toHaveBeenLastCalledWith({ statut: null, page: 0, taille: 20 });
  });

  it('met en évidence ceux qui expirent dans 7 jours ou moins', async () => {
    const element = await creer();
    const lignes = Array.from(element.querySelectorAll('tr.mat-mdc-row'));
    expect(lignes.length).toBe(3);
    expect(lignes[0].classList).toContain('en-alerte');
    expect(lignes[0].textContent).toContain('Expire dans 3 jours');
    expect(lignes[1].classList).not.toContain('en-alerte');
    expect(lignes[2].textContent).toContain('Jamais payé');
  });
});
