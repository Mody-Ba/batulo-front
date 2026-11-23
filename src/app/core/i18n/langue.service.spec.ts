import { Directionality } from '@angular/cdk/bidi';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TRADUCTIONS, traducteurStatique } from '../../../test-providers';
import { CLE_STOCKAGE_LANGUE, langueDuNavigateur } from './langues';
import { LangueService } from './langue.service';
import { brancherTraductions, langueCourante, traduire } from './traduire';

describe('LangueService (langue de l’interface, sens de lecture)', () => {
  const html = document.documentElement;

  function creer(): LangueService {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
    return TestBed.inject(LangueService);
  }

  beforeEach(() => localStorage.removeItem(CLE_STOCKAGE_LANGUE));

  afterEach(() => {
    localStorage.removeItem(CLE_STOCKAGE_LANGUE);
    html.lang = 'fr';
    html.dir = 'ltr';
    // Les autres tests lisent les textes français.
    brancherTraductions(traducteurStatique(TRADUCTIONS['fr']), 'fr');
  });

  it('langue du navigateur si c’est fr, en ou ar (variantes régionales comprises), sinon le français', () => {
    expect(langueDuNavigateur(['en-US', 'fr'])).toBe('en');
    expect(langueDuNavigateur(['ar-MR'])).toBe('ar');
    expect(langueDuNavigateur(['de-DE', 'fr-CA'])).toBe('fr');
    expect(langueDuNavigateur(['es', 'de'])).toBe('fr');
    expect(langueDuNavigateur([])).toBe('fr');
  });

  it('arabe : lang et dir="rtl" sur <html>, Directionality en RTL, textes arabes ; choix mémorisé', async () => {
    const service = creer();
    await service.initialiser();
    await service.changer('ar');

    expect(service.langue()).toBe('ar');
    expect(langueCourante()).toBe('ar');
    expect(html.lang).toBe('ar');
    expect(html.dir).toBe('rtl');
    expect(TestBed.inject(Directionality).value).toBe('rtl');
    expect(traduire('commun.annuler')).toBe('إلغاء');
    expect(localStorage.getItem(CLE_STOCKAGE_LANGUE)).toBe('"ar"');
  });

  it('retour au français : dir="ltr" et Directionality en LTR, sans rechargement', async () => {
    const service = creer();
    await service.initialiser();
    await service.changer('ar');
    const changements: string[] = [];
    TestBed.inject(Directionality).change.subscribe((d) => changements.push(d));

    await service.changer('fr');

    expect(html.lang).toBe('fr');
    expect(html.dir).toBe('ltr');
    expect(TestBed.inject(Directionality).value).toBe('ltr');
    expect(changements).toEqual(['ltr']);
    expect(traduire('commun.annuler')).toBe('Annuler');
  });

  it('au démarrage, le choix mémorisé l’emporte sur la langue du navigateur', async () => {
    localStorage.setItem(CLE_STOCKAGE_LANGUE, '"en"');
    const service = creer();
    await service.initialiser();

    expect(service.langue()).toBe('en');
    expect(html.lang).toBe('en');
    expect(traduire('commun.annuler')).toBe('Cancel');
  });

  it('valeur mémorisée inconnue : ignorée (langue du navigateur ou français)', async () => {
    localStorage.setItem(CLE_STOCKAGE_LANGUE, '"de"');
    const service = creer();
    await service.initialiser();

    expect(['fr', 'en', 'ar']).toContain(service.langue());
  });
});
