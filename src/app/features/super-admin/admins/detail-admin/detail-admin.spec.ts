import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { SuperAdminService } from '../../../../core/services/super-admin.service';
import { abonnementDeTest, adminDeTest, adminDetailDeTest } from '../../../../testing/donnees-test';
import { ActionsAdmin } from '../actions-admin';
import { DetailAdmin } from './detail-admin';

describe('DetailAdmin', () => {
  let fixture: ComponentFixture<DetailAdmin>;
  let detailAdmin: ReturnType<typeof vi.fn>;
  let actions: Record<string, ReturnType<typeof vi.fn>>;

  async function creer(): Promise<HTMLElement> {
    fixture = TestBed.createComponent(DetailAdmin);
    fixture.componentRef.setInput('id', '3');
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function bouton(element: HTMLElement, libelle: string): HTMLButtonElement {
    return Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(libelle))!;
  }

  beforeEach(() => {
    detailAdmin = vi.fn(() => of(adminDetailDeTest()));
    actions = {
      basculerActif: vi.fn(() => of(adminDetailDeTest({ admin: adminDeTest({ actif: false }) }))),
      supprimer: vi.fn(() => of(true)),
    };
    TestBed.configureTestingModule({
      imports: [DetailAdmin],
      providers: [
        provideRouter([]),
        { provide: SuperAdminService, useValue: { detailAdmin } },
        { provide: ActionsAdmin, useValue: actions },
      ],
    });
  });

  it('affiche l’entreprise, l’admin, l’abonnement, les jours restants et les gestionnaires', async () => {
    const element = await creer();
    expect(detailAdmin).toHaveBeenCalledWith(3);
    expect(element.textContent).toContain('Entreprise Test');
    expect(element.textContent).toContain('Fatou Sow');
    expect(element.textContent).toContain('fatou@test.local');
    expect(element.textContent).toContain('4 gestionnaires');
    expect(element.textContent).toContain('Formule mensuelle');
    expect(element.textContent).toContain('23 jours restants');
  });

  it('abonnement jamais payé : pas de date ni de jours restants', async () => {
    detailAdmin.mockReturnValue(
      of(
        adminDetailDeTest({
          abonnement: abonnementDeTest({
            statut: 'EN_ATTENTE_PAIEMENT',
            formule: null,
            dateDebut: null,
            dateExpiration: null,
            joursRestants: null,
            montant: null,
            devise: null,
          }),
        }),
      ),
    );
    const element = await creer();
    expect(element.textContent).toContain('En attente de paiement');
    expect(element.textContent).toContain('Aucune (jamais payé)');
    expect(element.textContent).not.toContain('jours restants');
  });

  it('désactiver passe le nombre de gestionnaires et affiche le nouvel état', async () => {
    const element = await creer();
    bouton(element, 'Désactiver l’entreprise').click();
    fixture.detectChanges();
    expect(actions['basculerActif']).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }), 4);
    expect(element.textContent).toContain('Désactivée');
    expect(bouton(element, 'Activer l’entreprise')).toBeTruthy();
  });

  it('après suppression, retour à la liste', async () => {
    const element = await creer();
    const naviguer = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    bouton(element, 'Supprimer').click();
    expect(actions['supprimer']).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }), 4);
    expect(naviguer).toHaveBeenCalledWith('/super-admin/admins');
  });
});
