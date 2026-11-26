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
  /** Calculé par AuthService : null pour un abonné (illimité) ou sans achat. */
  const soldeAffiche = signal<number | null>(null);

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
    soldeAffiche.set(null);
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
          useValue: { utilisateur: signal({ prenom: 'Awa', entreprise: 'Entreprise Test' }), soldeAffiche },
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

  it('abonné : pas de « Sondages disponibles » (illimité)', async () => {
    const element = await creer();
    expect(element.querySelector('.solde-sondages')).toBeNull();
    expect(element.textContent).not.toContain('Acheter des sondages');
  });

  it('sans abonnement en cours, avec des sondages achetés : solde et « Acheter des sondages » ; à 0, mis en évidence', async () => {
    soldeAffiche.set(6);
    let element = await creer();
    const solde = element.querySelector('.abonnement .solde-sondages')!;
    expect(solde.textContent?.replace(/\s+/g, ' ').trim()).toBe('Sondages disponibles : 6');
    expect(solde.classList).not.toContain('epuise');
    const lien = Array.from(element.querySelectorAll('.abonnement a')).find((a) => a.textContent?.includes('Acheter des sondages'))!;
    expect(lien.getAttribute('href')).toBe('/admin/abonnement/souscrire?offre=ACHAT_SONDAGES');

    soldeAffiche.set(0);
    element = await creer();
    expect(element.querySelector('.abonnement .solde-sondages')!.classList).toContain('epuise');
  });
});
