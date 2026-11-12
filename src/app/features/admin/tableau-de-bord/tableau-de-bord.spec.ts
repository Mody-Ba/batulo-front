import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AbonnementService } from '../../../core/services/abonnement.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TableauDeBordService } from '../../../core/services/tableau-de-bord.service';
import { abonnementDeTest, tableauDeBordDeTest } from '../../../testing/donnees-test';
import { TableauDeBord } from './tableau-de-bord';

describe('TableauDeBord', () => {
  let lire: ReturnType<typeof vi.fn>;

  async function creer(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(TableauDeBord);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function tuiles(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('.tuile')).map(
      (t) => t.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );
  }

  beforeEach(() => {
    lire = vi.fn(() => of(tableauDeBordDeTest()));
    TestBed.configureTestingModule({
      imports: [TableauDeBord],
      providers: [
        provideRouter([]),
        { provide: TableauDeBordService, useValue: { lire } },
        { provide: AbonnementService, useValue: { abonnement: signal(abonnementDeTest()) } },
        {
          provide: NotificationService,
          useValue: { lister: () => of({ contenu: [], page: 0, taille: 5, totalElements: 0, totalPages: 0 }) },
        },
        {
          provide: AuthService,
          useValue: { utilisateur: signal({ prenom: 'Awa', entreprise: 'Entreprise Test' }) },
        },
      ],
    });
  });

  it('affiche les compteurs : gestionnaires, sondages par statut (brouillons compris), réponses', async () => {
    const element = await creer();
    expect(tuiles(element)).toEqual([
      '4 Actifs',
      '1 Désactivé',
      '2 Non commencés brouillons compris',
      '3 En cours',
      '5 Terminés',
      '125 Reçues au total toutes versions',
    ]);
  });

  it('les compteurs mènent aux listes filtrées', async () => {
    const element = await creer();
    const liens = Array.from(element.querySelectorAll('a.tuile')).map((a) => a.getAttribute('href'));
    expect(liens).toEqual([
      '/admin/gestionnaires?actif=true',
      '/admin/gestionnaires?actif=false',
      '/sondages?statut=NON_COMMENCE',
      '/sondages?statut=EN_COURS',
      '/sondages?statut=TERMINE',
    ]);
  });

  it('erreur : message et nouvel essai', async () => {
    lire.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 500, error: { code: 'ERREUR', message: 'Panne' } })),
    );
    const element = await creer();
    expect(element.querySelector('.chiffres [role="alert"]')?.textContent).toContain('Panne');
    expect(tuiles(element)).toEqual([]);

    const bouton = Array.from(element.querySelectorAll('.chiffres button')).find((b) =>
      b.textContent?.includes('Réessayer'),
    ) as HTMLButtonElement;
    bouton.click();
    expect(lire).toHaveBeenCalledTimes(2);
  });
});
