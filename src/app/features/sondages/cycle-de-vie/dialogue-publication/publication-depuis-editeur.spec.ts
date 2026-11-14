import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { authInterceptor } from '../../../../core/interceptors/auth.interceptor';
import { AuthService } from '../../../../core/services/auth.service';
import { questionDeTest, sectionDeTest, sondageDeTest } from '../../../../testing/donnees-test';
import { EditeurSondage } from '../../editeur/editeur-sondage';

/**
 * Parcours complet (bogue « Publier ne fait rien ») : éditeur -> « Publier » -> dialogue -> « Publier maintenant »,
 * avec le vrai service, l'intercepteur et HttpClient ; seul le serveur est simulé.
 */
describe('Publication depuis l’éditeur (parcours complet)', () => {
  const url = environment.apiUrl;
  const sondage = sondageDeTest({
    id: 1,
    titre: 'Malnitrution',
    reponseUnique: false,
    sections: [
      sectionDeTest({
        id: 1,
        titre: 'identification de l’enfant',
        questions: [
          questionDeTest({ id: 1, type: 'TEXTE_COURT', options: [], configuration: { longueurMax: 255 } }),
          questionDeTest({ id: 2, type: 'NUMERIQUE', options: [], configuration: { decimales: 0 } }),
          questionDeTest({ id: 3, type: 'OUI_NON', options: [] }),
        ],
      }),
    ],
  });

  async function ouvrirDialogue() {
    TestBed.configureTestingModule({
      imports: [EditeurSondage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            role: signal('ADMIN'),
            utilisateur: signal({ id: 1, peutCreerSondages: false }),
            lectureSeule: signal(false),
            jeton: signal('jeton'),
            estConnecte: signal(true),
          },
        },
      ],
    });
    const serveur = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(EditeurSondage);
    fixture.componentRef.setInput('id', '1');
    fixture.detectChanges();
    serveur.expectOne(`${url}/api/sondages/1`).flush(sondage);
    serveur.expectOne(`${url}/api/sondages/1/versions`).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'))
      .find((b) => b.textContent?.trim().endsWith('Publier'))!
      .click();
    await fixture.whenStable();
    const dialogue = document.querySelector('mat-dialog-container')!;
    Array.from(dialogue.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Publier maintenant'))!
      .click();
    await fixture.whenStable();
    return { serveur, fixture, dialogue };
  }

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((o) => (o.innerHTML = '')));

  it('le clic envoie POST .../publier avec le corps attendu, puis l’éditeur passe en lecture seule', async () => {
    const { serveur, fixture } = await ouvrirDialogue();
    const requete = serveur.expectOne(`${url}/api/sondages/1/publier`);
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toEqual({ datePublication: null, dateFermeture: null });
    expect(requete.request.headers.get('Authorization')).toBe('Bearer jeton');
    requete.flush({ ...sondage, publie: true, statut: 'EN_COURS' });
    // Le dialogue se ferme (animation), puis l'éditeur relit les versions.
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 200));
    serveur.match(`${url}/api/sondages/1/versions`).forEach((r) => r.flush([]));
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ce sondage est publié');
  });

  it('refus du serveur : le message s’affiche en haut du dialogue, qui reste ouvert', async () => {
    const { serveur, fixture, dialogue } = await ouvrirDialogue();
    serveur
      .expectOne(`${url}/api/sondages/1/publier`)
      .flush({ code: 'SONDAGE_INCOMPLET', message: 'La section « X » n’a aucune question.' }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();
    const zone = dialogue.querySelector('.zone-erreur')!;
    expect(zone.textContent).toContain('Le sondage n’a pas été publié');
    expect(zone.textContent).toContain('La section « X » n’a aucune question.');
    expect(document.querySelector('mat-dialog-container')).not.toBeNull();
  });
});
