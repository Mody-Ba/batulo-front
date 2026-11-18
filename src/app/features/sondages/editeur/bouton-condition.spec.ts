import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { authInterceptor } from '../../../core/interceptors/auth.interceptor';
import { SondageResponse } from '../../../core/models/sondage.model';
import { AuthService } from '../../../core/services/auth.service';
import { questionDeTest, sectionDeTest, sondageDeTest } from '../../../testing/donnees-test';
import { EditeurSondage } from './editeur-sondage';

/**
 * Vrai rendu de l'éditeur (page, cartes, store ; seul le serveur est simulé) : le bouton « Ajouter une condition » est
 * visible en bas de chaque carte qui a une question avant elle, sur un brouillon ; jamais sur la toute première question
 * ni sur un sondage publié. Cas du sondage « test » : Oui/Non puis « combien » (Nombre).
 */
describe('Éditeur : bouton « Ajouter une condition » visible sur les cartes', () => {
  const url = environment.apiUrl;
  let fixture: ComponentFixture<EditeurSondage>;

  const OUI_NON = questionDeTest({ id: 29, libelle: 'avec vous des enfant', type: 'OUI_NON', options: [], ordre: 1 });
  const COMBIEN = questionDeTest({ id: 30, libelle: 'combien', type: 'NUMERIQUE', options: [], ordre: 2, configuration: { decimales: 0 } });
  const AGE = questionDeTest({ id: 31, libelle: 'âge', type: 'NUMERIQUE', options: [], ordre: 1, configuration: { decimales: 0 } });
  const brouillon = (modifs: Partial<SondageResponse> = {}) =>
    sondageDeTest({
      id: 8,
      titre: 'test',
      sections: [
        sectionDeTest({ id: 9, ordre: 1, titre: 'Famille', questions: [OUI_NON, COMBIEN] }),
        sectionDeTest({ id: 10, ordre: 2, titre: 'Enfants', questions: [AGE] }),
      ],
      ...modifs,
    });

  async function ouvrir(sondage: SondageResponse): Promise<HTMLElement> {
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
    fixture = TestBed.createComponent(EditeurSondage);
    fixture.componentRef.setInput('id', '8');
    fixture.detectChanges();
    serveur.expectOne(`${url}/api/sondages/8`).flush(sondage);
    serveur.match(`${url}/api/sondages/8/versions`).forEach((r) => r.flush([]));
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const carteQuestion = (el: HTMLElement, libelle: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('app-carte-question')).find(
      (c) => c.querySelector<HTMLTextAreaElement>('textarea')?.value === libelle,
    )!;
  const boutonQuestion = (carte: HTMLElement) =>
    Array.from(carte.querySelectorAll<HTMLButtonElement>('.pied button')).find((b) => b.textContent?.includes('Ajouter une condition'));
  const carteSection = (el: HTMLElement, rang: number) => el.querySelectorAll<HTMLElement>('app-carte-section')[rang];
  const boutonSection = (carte: HTMLElement) =>
    Array.from(carte.querySelectorAll<HTMLButtonElement>('.entete-section-editeur button')).find((b) =>
      b.textContent?.includes('Ajouter une condition à la section'),
    );

  it('brouillon : bouton visible en bas de la 2e question (« combien »), absent sur la 1re', async () => {
    const el = await ouvrir(brouillon());
    const combien = carteQuestion(el, 'combien');
    const bouton = boutonQuestion(combien);
    expect(bouton).toBeDefined();
    expect(bouton!.disabled).toBe(false);
    expect(bouton!.closest('.pied')).not.toBeNull();
    expect(boutonQuestion(carteQuestion(el, 'avec vous des enfant'))).toBeUndefined();
    // Première question d'une section suivante : des questions la précèdent, le bouton est là.
    expect(boutonQuestion(carteQuestion(el, 'âge'))).toBeDefined();
  });

  it('brouillon : bouton de la 2e section visible, absent sur la 1re ; un clic ouvre la boîte de condition', async () => {
    const el = await ouvrir(brouillon());
    expect(boutonSection(carteSection(el, 0))).toBeUndefined();
    expect(boutonSection(carteSection(el, 1))).toBeDefined();

    boutonQuestion(carteQuestion(el, 'combien'))!.click();
    await fixture.whenStable();
    const boite = document.querySelector('app-dialogue-condition')!;
    expect(boite.textContent).toContain('Condition d’affichage de la question 2 de la section 1');
    document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = ''));
  });

  it('question qui a déjà une condition : résumé « Visible si » à la place du bouton', async () => {
    const combien = { ...COMBIEN, condition: { combinaison: 'ET' as const, regles: [{ questionId: 29, operateur: 'EGAL' as const, valeur: true }] } };
    const el = await ouvrir(brouillon({ sections: [sectionDeTest({ id: 9, questions: [OUI_NON, combien] })] }));
    const carte = carteQuestion(el, 'combien');
    expect(boutonQuestion(carte)).toBeUndefined();
    expect(carte.querySelector('app-resume-condition')!.textContent).toContain('Visible si : avec vous des enfant = Oui');
  });

  it('sondage publié : aucun bouton, ni sur les questions ni sur les sections', async () => {
    const el = await ouvrir(brouillon({ publie: true, statut: 'EN_COURS', datePublication: '2026-11-17T10:00:00Z' }));
    for (const libelle of ['avec vous des enfant', 'combien', 'âge']) {
      expect(boutonQuestion(carteQuestion(el, libelle))).toBeUndefined();
    }
    expect(boutonSection(carteSection(el, 1))).toBeUndefined();
  });

  it('question Nombre : plus de « 0 » décoratif sous Minimum / Maximum / Décimales', async () => {
    const el = await ouvrir(brouillon());
    const configuration = carteQuestion(el, 'combien').querySelector('app-question-numerique')!;
    expect(configuration.querySelector('.faux-champ')).toBeNull();
    expect(configuration.textContent).toContain('Décimales');
  });
});
