import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { SondageResponse } from '../../../../core/models/sondage.model';
import { AuthService } from '../../../../core/services/auth.service';
import { sondageDeTest } from '../../../../testing/donnees-test';
import { EditeurSondage } from '../editeur-sondage';

describe('Éditeur : carte « Langues du sondage »', () => {
  const url = `${environment.apiUrl}/api/sondages/1`;
  let serveur: HttpTestingController;
  let fixture: ComponentFixture<EditeurSondage>;

  async function ouvrir(sondage: SondageResponse): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [EditeurSondage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { role: signal('ADMIN'), utilisateur: signal({ id: 1 }), lectureSeule: signal(false) } },
      ],
    });
    serveur = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EditeurSondage);
    fixture.componentRef.setInput('id', '1');
    fixture.detectChanges();
    serveur.expectOne(url).flush(sondage);
    serveur.match(`${url}/versions`).forEach((r) => r.flush([]));
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const carte = (el: HTMLElement) => el.querySelector<HTMLElement>('app-carte-langues')!;
  const cases = (el: HTMLElement) => Array.from(carte(el).querySelectorAll<HTMLInputElement>('mat-checkbox input'));

  afterEach(() => serveur.verify());

  it('brouillon : principale exclue des supplémentaires (deux au plus) ; cocher une langue l’enregistre tout de suite', async () => {
    const el = await ouvrir(sondageDeTest({ id: 1, languePrincipale: 'fr', languesSupplementaires: [] }));
    expect(carte(el).textContent).toContain('Langues du sondage');
    expect(Array.from(carte(el).querySelectorAll('mat-checkbox')).map((c) => c.textContent?.trim())).toEqual(['Anglais', 'Arabe']);

    cases(el)[1].click();
    fixture.detectChanges();
    const requete = serveur.expectOne(`${url}/langues`);
    expect(requete.request.method).toBe('PUT');
    expect(requete.request.body).toEqual({ languePrincipale: 'fr', languesSupplementaires: ['ar'] });
    requete.flush(sondageDeTest({ id: 1, languePrincipale: 'fr', languesSupplementaires: ['ar'] }));
    await fixture.whenStable();
    fixture.detectChanges();

    // Complétude relue (après un court délai) et lien vers l'écran de traduction.
    await new Promise((r) => setTimeout(r, 700));
    serveur.expectOne(`${url}/traductions`).flush([{ langue: 'ar', traduits: 3, total: 8, complet: false, manquants: [] }]);
    fixture.detectChanges();
    expect(carte(el).textContent).toContain('3 / 8 textes traduits');
    expect(carte(el).querySelector('a')!.getAttribute('href')).toBe('/sondages/1/traductions/ar');
  });

  it('sondage publié : langues en lecture seule, lien pour voir les traductions', async () => {
    const el = await ouvrir(sondageDeTest({ id: 1, publie: true, statut: 'EN_COURS', languePrincipale: 'fr', languesSupplementaires: ['en'] }));
    await new Promise((r) => setTimeout(r, 700));
    serveur.expectOne(`${url}/traductions`).flush([{ langue: 'en', traduits: 8, total: 8, complet: true, manquants: [] }]);
    fixture.detectChanges();
    expect(cases(el)).toEqual([]);
    expect(carte(el).textContent).toContain('Langue principale : Français');
    expect(carte(el).textContent).toContain('Langues supplémentaires : Anglais');
    expect(carte(el).textContent).toContain('Traduction complète (8 / 8)');
    expect(carte(el).textContent).toContain('Voir les traductions');
  });
});
