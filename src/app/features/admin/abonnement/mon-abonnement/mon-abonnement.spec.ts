import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PaiementResponse } from '../../../../core/models/abonnement.model';
import { PageResponse } from '../../../../core/models/page.model';
import { AbonnementService } from '../../../../core/services/abonnement.service';
import { abonnementDeTest } from '../../../../testing/donnees-test';
import { MonAbonnement } from './mon-abonnement';

function page(contenu: PaiementResponse[], totalElements = contenu.length): PageResponse<PaiementResponse> {
  return { contenu, page: 0, taille: 5, totalElements, totalPages: Math.ceil(totalElements / 5) };
}

const RECENT: PaiementResponse = {
  id: 3,
  datePaiement: '2026-11-01T15:00:00Z',
  formule: 'ANNUEL',
  montant: 120,
  devise: 'cad',
};
const ANCIEN: PaiementResponse = {
  id: 1,
  datePaiement: '2026-09-01T15:00:00Z',
  formule: 'MENSUEL',
  montant: 12.5,
  devise: 'cad',
};

describe('MonAbonnement', () => {
  let paiements: ReturnType<typeof vi.fn>;

  async function creer(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(MonAbonnement);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  beforeEach(() => {
    paiements = vi.fn(() => of(page([RECENT, ANCIEN])));
    const abonnement = signal(abonnementDeTest());
    TestBed.configureTestingModule({
      imports: [MonAbonnement],
      providers: [
        provideRouter([]),
        {
          provide: AbonnementService,
          useValue: { abonnement, monAbonnement: () => of(abonnement()), paiements },
        },
      ],
    });
  });

  it('affiche l’historique des paiements, du plus récent au plus ancien', async () => {
    const element = await creer();
    expect(paiements).toHaveBeenCalledWith(0, 5);
    const lignes = Array.from(element.querySelectorAll('.historique tbody tr')).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => td.textContent?.replace(/\s+/g, ' ').trim()),
    );
    expect(lignes).toHaveLength(2);
    expect(lignes[0][1]).toBe('Formule annuelle');
    expect(lignes[0][2]).toContain('120');
    expect(lignes[1][1]).toBe('Formule mensuelle');
    expect(element.textContent).not.toContain('bientôt disponible');
    // Une seule page : pas de paginateur.
    expect(element.querySelector('mat-paginator')).toBeNull();
  });

  it('plus de paiements qu’une page : paginateur', async () => {
    paiements.mockReturnValue(of(page([RECENT, ANCIEN], 12)));
    const element = await creer();
    expect(element.querySelector('mat-paginator')).not.toBeNull();
  });

  it('aucun paiement : message', async () => {
    paiements.mockReturnValue(of(page([])));
    const element = await creer();
    expect(element.querySelector('.historique')).toBeNull();
    expect(element.textContent).toContain('Aucun paiement pour le moment.');
  });
});
