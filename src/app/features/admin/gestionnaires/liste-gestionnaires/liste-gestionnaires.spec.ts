import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSlideToggleHarness } from '@angular/material/slide-toggle/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { GestionnaireService } from '../../../../core/services/gestionnaire.service';
import { gestionnaireDeTest } from '../../../../testing/donnees-test';
import { ActionsGestionnaire } from '../actions-gestionnaire';
import { DELAI_RECHERCHE_MS } from '../../../../core/utils/recherche';
import { ListeGestionnaires } from './liste-gestionnaires';

describe('ListeGestionnaires', () => {
  let fixture: ComponentFixture<ListeGestionnaires>;
  const lectureSeule = signal(false);
  let actions: { changerPermission: ReturnType<typeof vi.fn> };
  let lister: ReturnType<typeof vi.fn>;

  async function creer(entrees: Record<string, string> = {}): Promise<HTMLElement> {
    fixture = TestBed.createComponent(ListeGestionnaires);
    for (const [nom, valeur] of Object.entries(entrees)) {
      fixture.componentRef.setInput(nom, valeur);
    }
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  beforeEach(() => {
    lectureSeule.set(false);
    actions = { changerPermission: vi.fn() };
    lister = vi.fn(() =>
      of({ contenu: [gestionnaireDeTest()], page: 0, taille: 20, totalElements: 1, totalPages: 1 }),
    );
    TestBed.configureTestingModule({
      imports: [ListeGestionnaires],
      providers: [
        provideRouter([]),
        {
          provide: GestionnaireService,
          useValue: { lister },
        },
        { provide: ActionsGestionnaire, useValue: actions },
        { provide: AuthService, useValue: { lectureSeule, role: signal('ADMIN') } },
      ],
    });
  });

  it('affiche les gestionnaires avec leur état', async () => {
    const element = await creer();
    expect(element.textContent).toContain('Moussa Kane');
    expect(element.textContent).toContain('moussa@test.local');
    expect(element.textContent).toContain('Actif');
  });

  it('abonnement expiré : création et interrupteur désactivés', async () => {
    lectureSeule.set(true);
    const element = await creer();
    const bouton = Array.from(element.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Nouveau gestionnaire'),
    )!;
    expect(bouton.disabled).toBe(true);
    const interrupteur = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSlideToggleHarness);
    expect(await interrupteur.isDisabled()).toBe(true);
  });

  it('interrupteur de permission : revient en arrière si le serveur refuse', async () => {
    actions.changerPermission.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403, error: { code: 'ABONNEMENT_EXPIRE', message: 'x' } })),
    );
    await creer();
    const interrupteur = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSlideToggleHarness);
    expect(await interrupteur.isChecked()).toBe(false);
    await interrupteur.toggle();
    await fixture.whenStable();
    expect(actions.changerPermission).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }), true);
    expect(await interrupteur.isChecked()).toBe(false);
  });

  it('interrupteur de permission : reste activé si le serveur accepte', async () => {
    actions.changerPermission.mockReturnValue(of(gestionnaireDeTest({ peutCreerSondages: true })));
    await creer();
    const interrupteur = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSlideToggleHarness);
    await interrupteur.toggle();
    await fixture.whenStable();
    expect(await interrupteur.isChecked()).toBe(true);
  });

  it('lit la recherche et l’état dans l’URL et les envoie au serveur', async () => {
    await creer({ recherche: ' éloïse ', actif: 'false', page: '2' });
    expect(lister).toHaveBeenLastCalledWith({ recherche: 'éloïse', actif: false, page: 2, taille: 20 });
    const champ = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    expect(champ.value).toBe('éloïse');
  });

  it('sans filtre dans l’URL : tous les gestionnaires', async () => {
    await creer();
    expect(lister).toHaveBeenLastCalledWith({ recherche: '', actif: null, page: 0, taille: 20 });
  });

  it('la saisie met la recherche dans l’URL après le délai et revient à la première page', async () => {
    await creer({ page: '3' });
    const router = TestBed.inject(Router);
    const naviguer = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.useFakeTimers();
    try {
      const champ = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
      champ.value = 'kan';
      champ.dispatchEvent(new Event('input'));
      champ.value = 'kane ';
      champ.dispatchEvent(new Event('input'));
      vi.advanceTimersByTime(DELAI_RECHERCHE_MS - 1);
      expect(naviguer).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(naviguer).toHaveBeenCalledTimes(1);
      expect(naviguer).toHaveBeenCalledWith([], {
        queryParams: { recherche: 'kane', page: null },
        queryParamsHandling: 'merge',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('filtre d’état : met actif dans l’URL', async () => {
    await creer();
    const naviguer = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const pastille = Array.from(fixture.nativeElement.querySelectorAll('mat-chip-option')).find((p) =>
      (p as HTMLElement).textContent?.includes('Désactivés'),
    ) as HTMLElement;
    pastille.querySelector('button')!.click();
    await fixture.whenStable();
    expect(naviguer).toHaveBeenCalledWith([], {
      queryParams: { actif: 'false', page: null },
      queryParamsHandling: 'merge',
    });
  });

  it('aucun résultat filtré : message adapté', async () => {
    lister.mockReturnValue(of({ contenu: [], page: 0, taille: 20, totalElements: 0, totalPages: 0 }));
    const element = await creer({ recherche: 'zz', actif: 'true' });
    expect(element.querySelector('.etat-vide')?.textContent?.trim()).toBe(
      'Aucun gestionnaire actif ne correspond à « zz ».',
    );
  });
});
