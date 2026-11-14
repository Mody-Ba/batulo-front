import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DemandeAbonnementService } from '../../../../core/services/demande-abonnement.service';
import { demandeDeTest } from '../../../../testing/donnees-test';
import { DemandesAbonnement } from './demandes-abonnement';

const texte = (f: ComponentFixture<unknown>) => (f.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';

describe('Demandes d’augmentation (admin)', () => {
  let service: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    service = {
      mesDemandes: vi.fn(() => of({ contenu: [demandeDeTest({ id: 1, statut: 'TRAITEE', formuleSouhaitee: 'ANNUEL', reponse: 'Accordé', traiteeParNom: 'Équipe Batulo' })], page: 0, taille: 20, totalElements: 1, totalPages: 1 })),
      demander: vi.fn(() => of(demandeDeTest({ id: 2, statut: 'EN_ATTENTE', formuleSouhaitee: 'MENSUEL', message: 'Besoin mensuel' }))),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: DemandeAbonnementService, useValue: service }, { provide: MatSnackBar, useValue: { open: vi.fn() } }],
    });
  });

  async function afficher(): Promise<ComponentFixture<DemandesAbonnement>> {
    const f = TestBed.createComponent(DemandesAbonnement);
    await f.whenStable();
    f.detectChanges();
    return f;
  }

  function saisir(f: ComponentFixture<unknown>, message: string): void {
    const el = f.nativeElement as HTMLElement;
    Array.from(el.querySelectorAll<HTMLButtonElement>('mat-button-toggle button')).find((b) => b.textContent?.includes('mensuelle'))!.click();
    const zone = el.querySelector<HTMLTextAreaElement>('textarea')!;
    zone.value = message;
    zone.dispatchEvent(new Event('input'));
  }

  it('rappel du paiement par carte ; demande acceptée : réponse et « Payer la formule annuelle »', async () => {
    const f = await afficher();
    expect(texte(f)).toContain('vous payez vous-même la formule par carte');
    expect(texte(f)).toContain('Accordé');
    const payer = Array.from((f.nativeElement as HTMLElement).querySelectorAll('a')).find((a) => a.textContent?.includes('Payer la formule annuelle'))!;
    expect(payer.getAttribute('href')).toBe('/admin/abonnement/souscrire?formule=ANNUEL');
  });

  it('formule obligatoire (aucune présélection) ; envoi : formule et message nettoyé, puis formulaire masqué (en attente)', async () => {
    const f = await afficher();
    (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    f.detectChanges();
    expect(service['demander']).not.toHaveBeenCalled();
    expect(texte(f)).toContain('Choisissez une formule.');

    saisir(f, '  Besoin mensuel  ');
    (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    f.detectChanges();
    expect(service['demander']).toHaveBeenCalledWith({ formuleSouhaitee: 'MENSUEL', message: 'Besoin mensuel' });
    expect((f.nativeElement as HTMLElement).querySelector('form')).toBeNull();
    expect(texte(f)).toContain('est en attente de réponse');
  });

  it('409 DEMANDE_EN_COURS : message du serveur et liste relue', async () => {
    const f = await afficher();
    service['demander'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'DEMANDE_EN_COURS', message: 'Une demande est déjà en attente.' } })),
    );
    saisir(f, 'Encore');
    (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    f.detectChanges();
    expect(service['mesDemandes']).toHaveBeenCalledTimes(2);
  });

  it('?demande={id} : la demande est mise en évidence et reçoit le focus', async () => {
    const f = TestBed.createComponent(DemandesAbonnement);
    f.componentRef.setInput('demande', '1');
    await f.whenStable();
    f.detectChanges();
    await f.whenStable();
    const ligne = (f.nativeElement as HTMLElement).querySelector('#demande-1')!;
    expect(ligne.classList).toContain('en-evidence');
    expect(ligne.getAttribute('aria-current')).toBe('true');
  });
});
