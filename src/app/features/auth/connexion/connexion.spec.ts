import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { Connexion } from './connexion';

describe('Connexion : ?retour=', () => {
  let naviguer: ReturnType<typeof vi.fn>;

  async function seConnecter(retour?: string): Promise<void> {
    const fixture = TestBed.createComponent(Connexion);
    if (retour !== undefined) {
      fixture.componentRef.setInput('retour', retour);
    }
    await fixture.whenStable();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    for (const [selecteur, valeur] of [
      ['input[type="email"]', 'awa@test.local'],
      ['input[autocomplete="current-password"]', 'secret123'],
    ]) {
      const champ = element.querySelector<HTMLInputElement>(selecteur)!;
      champ.value = valeur;
      champ.dispatchEvent(new Event('input'));
    }
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Connexion],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { connexion: vi.fn(() => of({})), urlAccueil: () => '/admin', consommerMessageConnexion: () => null },
        },
      ],
    });
    naviguer = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true) as unknown as ReturnType<typeof vi.fn>;
  });

  it('chemin interne : retour à la page demandée', async () => {
    await seConnecter('/admin/abonnement/paiement-mobile?reference=r1');
    expect(naviguer).toHaveBeenCalledWith('/admin/abonnement/paiement-mobile?reference=r1');
  });

  it('URL externe ou « // » : ignorée, accueil du compte (pas de redirection ouverte)', async () => {
    await seConnecter('//exemple.test/piege');
    expect(naviguer).toHaveBeenLastCalledWith('/admin');
    await seConnecter('https://exemple.test');
    expect(naviguer).toHaveBeenLastCalledWith('/admin');
  });

  it('sans retour : accueil du compte', async () => {
    await seConnecter();
    expect(naviguer).toHaveBeenCalledWith('/admin');
  });
});
