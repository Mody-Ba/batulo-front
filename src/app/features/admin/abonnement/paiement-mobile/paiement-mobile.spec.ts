import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { StatutPaiementMobileResponse } from '../../../../core/models/abonnement.model';
import { AbonnementService } from '../../../../core/services/abonnement.service';
import { sessionMobileDeTest, statutMobileDeTest } from '../../../../testing/donnees-test';
import { cheminQr } from './code-qr';
import { PaiementMobile } from './paiement-mobile';
import { messageEchecMobile } from './suivi-paiement-mobile';

describe('PaiementMobile (Moosyl)', () => {
  let fixture: ComponentFixture<PaiementMobile>;
  let element: HTMLElement;
  let payerMobile: ReturnType<typeof vi.fn>;
  let statutMobile: ReturnType<typeof vi.fn>;

  const texte = () => (element.textContent ?? '').replace(/\s+/g, ' ');
  const bouton = (libelle: string) =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(libelle));
  /** Laisse passer le premier battement (timer 0), l'import d'uqr, puis le rendu. */
  const stable = async () => {
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      await fixture.whenStable();
      fixture.detectChanges();
    }
  };

  /** Attend qu'une condition soit vraie (import dynamique d'uqr plus ou moins rapide), 2 s au plus. */
  const attendre = async (condition: () => boolean) => {
    for (let i = 0; i < 100 && !condition(); i++) {
      await stable();
    }
  };

  async function creer(): Promise<void> {
    fixture = TestBed.createComponent(PaiementMobile);
    element = fixture.nativeElement;
    fixture.componentRef.setInput('formule', 'ANNUEL');
    await stable();
  }

  beforeEach(() => {
    payerMobile = vi.fn(() => of(sessionMobileDeTest()));
    statutMobile = vi.fn(() => of(statutMobileDeTest()));
    TestBed.configureTestingModule({
      imports: [PaiementMobile],
      providers: [{ provide: AbonnementService, useValue: { payerMobile, statutMobile } }],
    });
  });

  afterEach(() => fixture?.destroy());

  it('crée le paiement, puis code QR, bouton « Payer sur ce téléphone » (même onglet), montant en MRU et expiration', async () => {
    await creer();
    expect(payerMobile).toHaveBeenCalledWith('ANNUEL');
    await attendre(() => !!element.querySelector('app-code-qr svg'));
    const qr = element.querySelector('app-code-qr svg');
    expect(qr?.getAttribute('role')).toBe('img');
    expect(qr?.getAttribute('aria-label')).toBe('Code QR de la page de paiement mobile');
    expect(qr?.querySelector('path')?.getAttribute('d')).toMatch(/^M\d+ \d+h1v1h-1z/);

    const lien = Array.from(element.querySelectorAll('a')).find((a) => a.textContent?.includes('Payer sur ce téléphone'))!;
    expect(lien.getAttribute('href')).toBe('https://pay.moosyl.test/checkout/abc');
    expect(lien.getAttribute('target')).toBeNull();

    expect(texte()).toContain('80 MRU');
    expect(texte()).toContain('Valable jusqu’à');
    expect(texte()).toContain('Une fois payé, revenez sur cette page.');
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Paiement en cours…');
    expect(statutMobile).toHaveBeenCalledWith('ref-123');
  });

  it('succès confirmé par Moosyl : remis au parent', async () => {
    const reussi = statutMobileDeTest({ statut: 'REUSSI' });
    statutMobile.mockReturnValue(of(reussi));
    let recu: StatutPaiementMobileResponse | null = null;
    fixture = TestBed.createComponent(PaiementMobile);
    element = fixture.nativeElement;
    fixture.componentInstance.reussi.subscribe((s) => (recu = s));
    fixture.componentRef.setInput('formule', 'ANNUEL');
    await stable();
    expect(recu).toEqual(reussi);
  });

  it('échec : message clair et « Réessayer » crée un nouveau paiement', async () => {
    statutMobile.mockReturnValue(of(statutMobileDeTest({ statut: 'ECHOUE' })));
    await creer();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(messageEchecMobile());
    expect(element.querySelector('app-code-qr')).toBeNull();
    statutMobile.mockReturnValue(of(statutMobileDeTest()));
    bouton('Réessayer')!.click();
    await attendre(() => !!element.querySelector('app-code-qr'));
    expect(payerMobile).toHaveBeenCalledTimes(2);
    expect(element.querySelector('app-code-qr')).not.toBeNull();
  });

  it('session expirée sans paiement : message et « Réessayer »', async () => {
    payerMobile.mockReturnValue(of(sessionMobileDeTest({ expireLe: new Date(Date.now() - 1000).toISOString() })));
    await creer();
    expect(texte()).toContain('La session de paiement a expiré');
    expect(bouton('Réessayer')).toBeTruthy();
  });

  it('paiement mobile non configuré (503) : message du serveur et « Réessayer »', async () => {
    payerMobile.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 503,
            error: { code: 'PAIEMENT_MOBILE_NON_CONFIGURE', message: 'Le paiement mobile n’est pas disponible pour le moment.' },
          }),
      ),
    );
    await creer();
    expect(texte()).toContain('Le paiement mobile n’est pas disponible pour le moment.');
    expect(statutMobile).not.toHaveBeenCalled();
    expect(bouton('Réessayer')).toBeTruthy();
  });

  it('« Changer de formule » : remis au parent', async () => {
    await creer();
    const changer = vi.fn();
    fixture.componentInstance.changerFormule.subscribe(changer);
    bouton('Changer de formule')!.click();
    expect(changer).toHaveBeenCalled();
  });

  it('tracé du code QR : un carré par module noir', () => {
    expect(cheminQr([[true, false], [false, true]])).toBe('M0 0h1v1h-1zM1 1h1v1h-1z');
  });
});
