import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AbonnementResponse } from '../../core/models/abonnement.model';
import { AbonnementService } from '../../core/services/abonnement.service';
import { abonnementDeTest } from '../../testing/donnees-test';
import { BandeauAbonnement } from './bandeau-abonnement';

registerLocaleData(localeFrCa);

describe('BandeauAbonnement', () => {
  const abonnement = signal<AbonnementResponse | null>(null);

  async function afficher(valeur: AbonnementResponse | null): Promise<HTMLElement> {
    abonnement.set(valeur);
    const fixture = TestBed.createComponent(BandeauAbonnement);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BandeauAbonnement],
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'fr-CA' },
        { provide: AbonnementService, useValue: { abonnement } },
      ],
    });
  });

  it('actif : formule, jours restants, date et bouton Renouveler', async () => {
    const element = await afficher(abonnementDeTest({ joursRestants: 23 }));
    const bandeau = element.querySelector('.bandeau')!;
    expect(bandeau.classList.contains('alerte')).toBe(false);
    expect(bandeau.textContent).toContain('Formule mensuelle');
    expect(bandeau.textContent).toContain('23 jours restants');
    expect(bandeau.textContent).toContain('Expire le 1 décembre 2026');
    const lien = element.querySelector('a')!;
    expect(lien.textContent).toContain('Renouveler');
    expect(lien.getAttribute('href')).toBe('/admin/abonnement/souscrire?formule=MENSUEL');
  });

  it('7 jours ou moins : style d’alerte', async () => {
    const element = await afficher(abonnementDeTest({ statut: 'EXPIRE_BIENTOT', joursRestants: 1 }));
    const bandeau = element.querySelector('.bandeau')!;
    expect(bandeau.classList.contains('alerte')).toBe(true);
    expect(bandeau.textContent).toContain('1 jour restant');
  });

  it('expiré : style d’erreur et lecture seule', async () => {
    const element = await afficher(abonnementDeTest({ statut: 'EXPIRE', joursRestants: 0 }));
    const bandeau = element.querySelector('.bandeau')!;
    expect(bandeau.classList.contains('expire')).toBe(true);
    expect(bandeau.textContent).toContain('lecture seule');
  });

  it('rien tant qu’aucune formule n’est payée', async () => {
    const element = await afficher(
      abonnementDeTest({ statut: 'EN_ATTENTE_PAIEMENT', formule: null, dateExpiration: null, joursRestants: null }),
    );
    expect(element.querySelector('.bandeau')).toBeNull();
  });
});
