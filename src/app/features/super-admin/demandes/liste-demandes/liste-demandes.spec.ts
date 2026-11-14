import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { DemandeAbonnementService } from '../../../../core/services/demande-abonnement.service';
import { demandeDeTest } from '../../../../testing/donnees-test';
import { ListeDemandes } from './liste-demandes';

describe('ListeDemandes', () => {
  let fixture: ComponentFixture<ListeDemandes>;
  let lister: ReturnType<typeof vi.fn>;
  let detail: ReturnType<typeof vi.fn>;
  let resultatDialogue: unknown;

  async function creer(entrees: Record<string, string> = {}): Promise<HTMLElement> {
    fixture = TestBed.createComponent(ListeDemandes);
    for (const [nom, valeur] of Object.entries(entrees)) {
      fixture.componentRef.setInput(nom, valeur);
    }
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function bouton(element: HTMLElement, libelle: string): HTMLButtonElement {
    return Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.trim() === libelle)!;
  }

  beforeEach(() => {
    resultatDialogue = undefined;
    detail = vi.fn((id: number) => of(demandeDeTest({ id, entreprise: 'Sahel Data' })));
    lister = vi.fn(() =>
      of({ contenu: [demandeDeTest()], page: 0, taille: 20, totalElements: 1, totalPages: 1 }),
    );
    TestBed.configureTestingModule({
      imports: [ListeDemandes],
      providers: [
        provideRouter([]),
        { provide: DemandeAbonnementService, useValue: { lister, detail } },
        { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of(resultatDialogue) })) } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });
  });

  it('transmet le statut de l’URL et propose de répondre aux demandes en attente', async () => {
    const element = await creer({ statut: 'EN_ATTENTE' });
    expect(lister).toHaveBeenLastCalledWith({ statut: 'EN_ATTENTE', page: 0, taille: 20 });
    expect(element.textContent).toContain('Entreprise Test');
    expect(element.textContent).toContain('Formule annuelle');
    expect(bouton(element, 'Répondre')).toBeTruthy();
  });

  it('filtre « En attente » : la demande traitée sort de la liste, qui est relue', async () => {
    const element = await creer({ statut: 'EN_ATTENTE' });
    lister.mockClear();
    resultatDialogue = demandeDeTest({ statut: 'TRAITEE' });
    bouton(element, 'Répondre').click();
    expect(lister).toHaveBeenCalledTimes(1);
  });

  it('sans filtre : la ligne est mise à jour sans relire la liste', async () => {
    const element = await creer();
    lister.mockClear();
    resultatDialogue = demandeDeTest({ statut: 'REFUSEE' });
    bouton(element, 'Répondre').click();
    fixture.detectChanges();
    expect(lister).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Refusée');
    expect(bouton(element, 'Voir')).toBeTruthy();
  });

  it('?demande={id} (lien d’une notification) : la demande est relue seule, son détail s’ouvre, puis le paramètre est retiré', async () => {
    resultatDialogue = undefined;
    const naviguer = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await creer({ demande: '12' });
    expect(detail).toHaveBeenCalledWith(12);
    const dialog = TestBed.inject(MatDialog) as unknown as { open: ReturnType<typeof vi.fn> };
    expect(dialog.open.mock.calls[0][1].data.demande.id).toBe(12);
    expect(naviguer).toHaveBeenCalledWith([], { queryParams: { demande: null }, queryParamsHandling: 'merge', replaceUrl: true });
  });
});
