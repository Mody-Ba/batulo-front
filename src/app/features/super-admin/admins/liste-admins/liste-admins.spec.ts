import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { SuperAdminService } from '../../../../core/services/super-admin.service';
import { DELAI_RECHERCHE_MS } from '../../../../core/utils/recherche';
import { adminLigneDeTest, compteAdminDeTest } from '../../../../testing/donnees-test';
import { ActionsAdmin } from '../actions-admin';
import { ListeAdmins } from './liste-admins';

describe('ListeAdmins', () => {
  let fixture: ComponentFixture<ListeAdmins>;
  let listerAdmins: ReturnType<typeof vi.fn>;
  let actions: Record<string, ReturnType<typeof vi.fn>>;

  async function creer(entrees: Record<string, string> = {}): Promise<HTMLElement> {
    fixture = TestBed.createComponent(ListeAdmins);
    for (const [nom, valeur] of Object.entries(entrees)) {
      fixture.componentRef.setInput(nom, valeur);
    }
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  beforeEach(() => {
    listerAdmins = vi.fn(() =>
      of({
        contenu: [
          adminLigneDeTest({
            abonnement: { formule: 'ANNUEL', statut: 'EXPIRE_BIENTOT', dateExpiration: '2026-11-15T12:00:00Z', joursRestants: 3 },
          }),
          adminLigneDeTest({
            entreprise: { id: 2, nom: 'Nouvelle SA', actif: true },
            admin: { ...adminLigneDeTest().admin, id: 4, motDePasseTemporaire: true },
            abonnement: { formule: null, statut: 'EN_ATTENTE_PAIEMENT', dateExpiration: null, joursRestants: null },
            nombreGestionnaires: 0,
          }),
        ],
        page: 0,
        taille: 20,
        totalElements: 2,
        totalPages: 1,
      }),
    );
    actions = {
      creer: vi.fn(() => of(compteAdminDeTest({ id: 9 }))),
      basculerActif: vi.fn(() => of({})),
    };
    TestBed.configureTestingModule({
      imports: [ListeAdmins],
      providers: [
        provideRouter([]),
        { provide: SuperAdminService, useValue: { listerAdmins } },
        { provide: ActionsAdmin, useValue: actions },
      ],
    });
  });

  it('transmet recherche, statut et page de l’URL ; un statut inconnu est ignoré', async () => {
    await creer({ recherche: ' sow ', statut: 'EXPIRE', page: '2', taille: '10' });
    expect(listerAdmins).toHaveBeenLastCalledWith({ recherche: 'sow', statut: 'EXPIRE', page: 2, taille: 10 });

    await creer({ statut: 'INCONNU' });
    expect(listerAdmins).toHaveBeenLastCalledWith({ recherche: '', statut: null, page: 0, taille: 20 });
  });

  it('affiche entreprise, admin, statut, échéance et gestionnaires ; met en évidence 7 jours ou moins', async () => {
    const element = await creer();
    const lignes = Array.from(element.querySelectorAll('tr.mat-mdc-row'));
    expect(lignes.length).toBe(2);
    expect(lignes[0].textContent).toContain('Entreprise Test');
    expect(lignes[0].textContent).toContain('Fatou Sow · fatou@test.local');
    expect(lignes[0].textContent).toContain('Expire bientôt');
    expect(lignes[0].textContent).toContain('Expire dans 3 jours');
    expect(lignes[0].classList).toContain('en-alerte');
    expect(lignes[1].textContent).toContain('En attente de paiement');
    expect(lignes[1].textContent).toContain('Mot de passe temporaire');
    expect(lignes[1].textContent).toContain('Jamais payé');
    expect(lignes[1].classList).not.toContain('en-alerte');
  });

  it('la recherche part dans l’URL après la dernière frappe', async () => {
    const element = await creer();
    const naviguer = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.useFakeTimers();
    try {
      const champ = element.querySelector<HTMLInputElement>('input[type="search"]')!;
      champ.value = 'diallo';
      champ.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(DELAI_RECHERCHE_MS - 1);
      expect(naviguer).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(naviguer).toHaveBeenCalledWith([], {
        queryParams: { recherche: 'diallo', page: null },
        queryParamsHandling: 'merge',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('aucun résultat : message selon les filtres', async () => {
    listerAdmins.mockReturnValue(of({ contenu: [], page: 0, taille: 20, totalElements: 0, totalPages: 0 }));
    const element = await creer({ recherche: 'zzz', statut: 'DESACTIVE' });
    expect(element.textContent).toContain('Aucune entreprise au statut « Désactivé » ne correspond à « zzz ».');
  });

  it('nouvel admin : ouvre son détail', async () => {
    const element = await creer();
    const naviguer = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    Array.from(element.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Nouvel admin'))!
      .click();
    expect(naviguer).toHaveBeenCalledWith(['/super-admin/admins', 9]);
  });
});
