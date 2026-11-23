import { DOCUMENT } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TRADUCTIONS, traducteurStatique } from '../../../../test-providers';
import { LangueService } from '../../../core/i18n/langue.service';
import { CLE_STOCKAGE_LANGUE } from '../../../core/i18n/langues';
import { brancherTraductions } from '../../../core/i18n/traduire';
import { SelecteurLangue } from './selecteur-langue';

describe('SelecteurLangue', () => {
  async function afficher() {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
    await TestBed.inject(LangueService).initialiser();
    await TestBed.inject(LangueService).changer('fr');
    const fixture = TestBed.createComponent(SelecteurLangue);
    await fixture.whenStable();
    return fixture;
  }

  afterEach(() => {
    localStorage.removeItem(CLE_STOCKAGE_LANGUE);
    const html = TestBed.inject(DOCUMENT).documentElement;
    html.lang = 'fr';
    html.dir = 'ltr';
    brancherTraductions(traducteurStatique(TRADUCTIONS['fr']), 'fr');
  });

  it('liste native : Français, English, العربية, chacune dans sa langue ; libellé accessible ; sans Angular Material', async () => {
    const fixture = await afficher();
    const element: HTMLElement = fixture.nativeElement;
    const options = Array.from(element.querySelectorAll('option'));

    expect(options.map((o) => o.textContent?.trim())).toEqual(['Français', 'English', 'العربية']);
    expect(options.map((o) => o.getAttribute('lang'))).toEqual(['fr', 'en', 'ar']);
    expect(element.querySelector('select')!.value).toBe('fr');
    expect(element.querySelector('label')!.textContent).toContain('Langue');
    expect(element.querySelector('[class*="mat-"]')).toBeNull();
  });

  it('choisir l’arabe : interface en arabe et en RTL, libellé traduit, choix mémorisé', async () => {
    const fixture = await afficher();
    const element: HTMLElement = fixture.nativeElement;
    const select = element.querySelector('select')!;

    select.value = 'ar';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    // Chargement des données de langue (import dynamique) puis rendu.
    await new Promise((r) => setTimeout(r, 0));
    await fixture.whenStable();

    expect(TestBed.inject(LangueService).langue()).toBe('ar');
    expect(TestBed.inject(DOCUMENT).documentElement.dir).toBe('rtl');
    expect(element.querySelector('label')!.textContent).toContain('اللغة');
    expect(localStorage.getItem(CLE_STOCKAGE_LANGUE)).toBe('"ar"');
  });

  it('valeur inattendue : ignorée', async () => {
    const fixture = await afficher();
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    const option = document.createElement('option');
    option.value = 'xx';
    select.appendChild(option);

    select.value = 'xx';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(TestBed.inject(LangueService).langue()).toBe('fr');
  });
});
