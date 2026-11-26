import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CreditsResponse } from '../../../../core/models/abonnement.model';
import { Role } from '../../../../core/models/role.model';
import { SondageResponse } from '../../../../core/models/sondage.model';
import { AuthService } from '../../../../core/services/auth.service';
import { SondageService } from '../../../../core/services/sondage.service';
import { creditsDeTest, questionDeTest, sectionDeTest, sondageDeTest } from '../../../../testing/donnees-test';
import { DialoguePublication } from './dialogue-publication';

/** Dialogue de publication et sondages achetés : coût annoncé, solde épuisé, 402 CREDITS_EPUISES. */
describe('DialoguePublication : sondages achetés', () => {
  let fixture: ComponentFixture<DialoguePublication>;
  let service: { publier: ReturnType<typeof vi.fn>; modifier: ReturnType<typeof vi.fn> };
  let reference: { close: ReturnType<typeof vi.fn>; disableClose: boolean };
  let chargerProfil: ReturnType<typeof vi.fn>;
  const role = signal<Role>('ADMIN');
  const abonnementIllimite = signal(false);
  const credits = signal<CreditsResponse | null>(creditsDeTest({ solde: 3 }));

  const brouillon = (modifs: Partial<SondageResponse> = {}) =>
    sondageDeTest({ id: 5, version: 1, sections: [sectionDeTest({ questions: [questionDeTest()] })], ...modifs });

  function creer(sondage = brouillon(), mode: 'publier' | 'dates' = 'publier'): HTMLElement {
    TestBed.configureTestingModule({
      imports: [DialoguePublication],
      providers: [
        provideRouter([]),
        { provide: MAT_DIALOG_DATA, useValue: { sondage, mode } },
        { provide: MatDialogRef, useValue: reference },
        { provide: SondageService, useValue: service },
        {
          provide: AuthService,
          useValue: {
            role,
            abonnementIllimite,
            credits,
            compteCredits: () => !!credits()?.compteCredits,
            estConnecte: () => true,
            chargerProfil,
          },
        },
      ],
    });
    fixture = TestBed.createComponent(DialoguePublication);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const cout = (el: HTMLElement) => el.querySelector<HTMLElement>('.cout-publication');
  const texte = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const boutonPublier = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('button[type="submit"]')!;

  beforeEach(() => {
    role.set('ADMIN');
    abonnementIllimite.set(false);
    credits.set(creditsDeTest({ solde: 3 }));
    chargerProfil = vi.fn(() => of({}));
    service = { publier: vi.fn((id: number) => of(brouillon({ id, publie: true, statut: 'EN_COURS' }))), modifier: vi.fn() };
    reference = { close: vi.fn(), disableClose: false };
  });

  it('abonné : aucune mention de sondage utilisé, solde non relu', () => {
    abonnementIllimite.set(true);
    const el = creer();
    expect(cout(el)).toBeNull();
    expect(chargerProfil).not.toHaveBeenCalled();
  });

  it('sans abonnement, version 1 : « Cette publication utilisera 1 sondage (solde : X) » ; solde relu à l’ouverture et après', () => {
    const el = creer();
    expect(chargerProfil).toHaveBeenCalledTimes(1);
    expect(texte(cout(el))).toBe('Cette publication utilisera 1 sondage (solde : 3).');
    expect(cout(el)!.getAttribute('role')).toBe('status');
    expect(boutonPublier(el).disabled).toBe(false);
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    expect(service.publier).toHaveBeenCalled();
    expect(chargerProfil).toHaveBeenCalledTimes(2);
    expect(reference.close).toHaveBeenCalled();
  });

  it('nouvelle version : gratuite si la lignée a déjà été payée, sinon 1 sondage (le front ne peut pas le savoir)', () => {
    const el = creer(brouillon({ version: 2 }));
    expect(texte(cout(el))).toBe(
      'Gratuite si ce sondage a déjà été publié avec un sondage acheté ; sinon, cette publication utilisera 1 sondage (solde : 3).',
    );
    // Même à 0, une nouvelle version peut être gratuite : la publication reste possible.
    credits.set(creditsDeTest({ solde: 0 }));
    fixture.detectChanges();
    expect(boutonPublier(el).disabled).toBe(false);
  });

  it('solde épuisé (version 1) : message clair, « Publier » désactivé, « Acheter des sondages » et « S’abonner »', () => {
    credits.set(creditsDeTest({ solde: 0 }));
    const el = creer();
    const encadre = cout(el)!;
    expect(encadre.getAttribute('role')).toBe('alert');
    expect(texte(encadre)).toContain('Plus aucun sondage disponible');
    expect(boutonPublier(el).disabled).toBe(true);
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    expect(service.publier).not.toHaveBeenCalled();

    const naviguer = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    encadre.querySelector<HTMLButtonElement>('button.acheter')!.click();
    expect(reference.close).toHaveBeenCalled();
    expect(naviguer).toHaveBeenLastCalledWith(['/admin/abonnement/souscrire'], { queryParams: { offre: 'ACHAT_SONDAGES' } });
    encadre.querySelector<HTMLButtonElement>('button.s-abonner')!.click();
    expect(naviguer).toHaveBeenLastCalledWith(['/admin/abonnement/souscrire'], { queryParams: {} });
  });

  it('gestionnaire, solde épuisé : pas de boutons de paiement, il s’adresse à son admin', () => {
    role.set('GESTIONNAIRE');
    credits.set(creditsDeTest({ solde: 0 }));
    const el = creer();
    expect(cout(el)!.querySelector('button')).toBeNull();
    expect(texte(cout(el))).toContain('Demandez à l’admin de votre entreprise');
  });

  it('402 CREDITS_EPUISES du serveur : message dédié et boutons, la boîte reste ouverte', () => {
    service.publier.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 402, error: { code: 'CREDITS_EPUISES', message: 'Plus de crédits.' } })),
    );
    const el = creer(brouillon({ version: 2 }));
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(reference.close).not.toHaveBeenCalled();
    expect(texte(cout(el))).toContain('Plus aucun sondage disponible');
    expect(cout(el)!.querySelector('button.acheter')).not.toBeNull();
    // Pas de message générique en double.
    expect(el.querySelector('.zone-erreur app-message-erreur')).toBeNull();
  });

  it('ajustement des dates d’un sondage publié : jamais de coût', () => {
    const el = creer(brouillon({ publie: true, statut: 'NON_COMMENCE', datePublication: new Date(Date.now() + 86_400_000).toISOString() }), 'dates');
    expect(cout(el)).toBeNull();
  });
});
