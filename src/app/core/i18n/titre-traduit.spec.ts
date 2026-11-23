import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { TRADUCTIONS, traducteurStatique } from '../../../test-providers';
import { brancherTraductions } from './traduire';
import { TitreTraduit } from './titre-traduit';

@Component({ template: '' })
class PageVide {}

describe('TitreTraduit (titres de page)', () => {
  afterEach(() => brancherTraductions(traducteurStatique(TRADUCTIONS['fr']), 'fr'));

  async function naviguer(url: string): Promise<Title> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'connexion', title: 'titres.connexion', component: PageVide },
          { path: 'libre', title: 'Titre libre', component: PageVide },
        ]),
        { provide: TitleStrategy, useExisting: TitreTraduit },
      ],
    });
    await TestBed.inject(Router).navigateByUrl(url);
    return TestBed.inject(Title);
  }

  it('la clé de la route est traduite, puis retraduite au changement de langue', async () => {
    const titre = await naviguer('/connexion');
    expect(titre.getTitle()).toBe('Connexion · Batulo');

    brancherTraductions(traducteurStatique(TRADUCTIONS['ar']), 'ar');
    TestBed.tick();
    expect(titre.getTitle()).toBe('تسجيل الدخول · Batulo');
  });

  it('un titre qui n’est pas une clé reste tel quel ; une page peut imposer le sien', async () => {
    const titre = await naviguer('/libre');
    expect(titre.getTitle()).toBe('Titre libre');

    TestBed.inject(TitreTraduit).personnaliser(() => 'Malnutrition · Batulo');
    expect(titre.getTitle()).toBe('Malnutrition · Batulo');
  });
});
