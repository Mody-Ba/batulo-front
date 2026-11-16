import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AbonnementService } from '../../../../core/services/abonnement.service';
import { AuthService } from '../../../../core/services/auth.service';
import { abonnementDeTest, statutMobileDeTest } from '../../../../testing/donnees-test';
import { RetourPaiementMobile } from './retour-paiement-mobile';
import { MESSAGE_ECHEC_MOBILE, MESSAGE_RECONNEXION } from './suivi-paiement-mobile';

describe('RetourPaiementMobile (/admin/abonnement/paiement-mobile?reference=)', () => {
  let fixture: ComponentFixture<RetourPaiementMobile>;
  let element: HTMLElement;
  let statutMobile: ReturnType<typeof vi.fn>;
  let auth: { mettreAJourStatutAbonnement: ReturnType<typeof vi.fn>; rafraichir: ReturnType<typeof vi.fn>; terminerSession: ReturnType<typeof vi.fn> };

  const texte = () => (element.textContent ?? '').replace(/\s+/g, ' ');
  const lien = (libelle: string) => Array.from(element.querySelectorAll('a')).find((a) => a.textContent?.includes(libelle));
  const stable = async () => {
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      await fixture.whenStable();
      fixture.detectChanges();
    }
  };

  async function creer(reference?: string): Promise<void> {
    fixture = TestBed.createComponent(RetourPaiementMobile);
    element = fixture.nativeElement;
    if (reference !== undefined) {
      fixture.componentRef.setInput('reference', reference);
    }
    await stable();
  }

  beforeEach(() => {
    statutMobile = vi.fn(() => of(statutMobileDeTest()));
    auth = { mettreAJourStatutAbonnement: vi.fn(), rafraichir: vi.fn(() => of('jeton')), terminerSession: vi.fn() };
    TestBed.configureTestingModule({
      imports: [RetourPaiementMobile],
      providers: [
        provideRouter([]),
        { provide: AbonnementService, useValue: { statutMobile } },
        { provide: AuthService, useValue: auth },
      ],
    });
  });

  afterEach(() => fixture?.destroy());

  it('en attente : « Paiement en cours… », le statut est relu', async () => {
    await creer('ref-123');
    expect(statutMobile).toHaveBeenCalledWith('ref-123');
    expect(texte()).toContain('Paiement en cours…');
  });

  it('réussi : nouveau jeton, « Abonnement activé » et lien vers le tableau de bord', async () => {
    statutMobile.mockReturnValue(
      of(
        statutMobileDeTest({
          statut: 'REUSSI',
          abonnement: abonnementDeTest({ statut: 'ACTIF', formule: 'ANNUEL', dateExpiration: '2027-11-15T12:00:00Z' }),
        }),
      ),
    );
    await creer('ref-123');
    expect(auth.mettreAJourStatutAbonnement).toHaveBeenCalledWith('ACTIF');
    expect(auth.rafraichir).toHaveBeenCalled();
    expect(texte()).toContain('Abonnement activé');
    expect(texte()).toContain('80 MRU');
    expect(lien('Aller au tableau de bord')?.getAttribute('href')).toBe('/admin');
  });

  it('réussi mais jeton non rafraîchi : reconnexion demandée', async () => {
    statutMobile.mockReturnValue(of(statutMobileDeTest({ statut: 'REUSSI' })));
    auth.rafraichir.mockReturnValue(throwError(() => new Error('refus')));
    await creer('ref-123');
    expect(auth.terminerSession).toHaveBeenCalledWith(MESSAGE_RECONNEXION);
  });

  it('échoué : message clair et « Réessayer » vers un nouveau paiement mobile de la même formule', async () => {
    statutMobile.mockReturnValue(of(statutMobileDeTest({ statut: 'ECHOUE', formule: 'MENSUEL' })));
    await creer('ref-123');
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(MESSAGE_ECHEC_MOBILE);
    expect(lien('Réessayer')?.getAttribute('href')).toBe('/admin/abonnement/souscrire?moyen=mobile&formule=MENSUEL');
    expect(auth.rafraichir).not.toHaveBeenCalled();
  });

  it('référence inconnue (404 PAIEMENT_INTROUVABLE) ou absente : message et lien vers la souscription', async () => {
    statutMobile.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404, error: { code: 'PAIEMENT_INTROUVABLE', message: 'x' } })),
    );
    await creer('inconnue');
    expect(texte()).toContain('Ce paiement est introuvable');
    fixture.destroy();

    statutMobile.mockClear();
    await creer();
    expect(statutMobile).not.toHaveBeenCalled();
    expect(texte()).toContain('Ce paiement est introuvable');
    expect(lien('Payer mon abonnement')?.getAttribute('href')).toBe('/admin/abonnement/souscrire?moyen=mobile');
  });

  it('autre erreur : message et « Vérifier à nouveau »', async () => {
    statutMobile.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 403, error: { code: 'ACCES_REFUSE', message: 'Accès refusé.' } })),
    );
    await creer('ref-123');
    expect(texte()).toContain('Accès refusé.');
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes('Vérifier à nouveau'))!.click();
    await stable();
    expect(statutMobile).toHaveBeenCalledTimes(2);
    expect(texte()).toContain('Paiement en cours…');
  });
});
