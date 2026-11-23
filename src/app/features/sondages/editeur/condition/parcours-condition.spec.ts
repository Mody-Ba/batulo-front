import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { SondageResponse } from '../../../../core/models/sondage.model';
import { authInterceptor } from '../../../../core/interceptors/auth.interceptor';
import { AuthService } from '../../../../core/services/auth.service';
import { questionDeTest, sectionDeTest, sondageDeTest } from '../../../../testing/donnees-test';
import { CarteQuestion } from '../carte-question/carte-question';
import { EditeurSondageStore } from '../editeur-sondage.store';
import { messageNonEnregistree } from './dialogue-condition';

/**
 * Parcours complet de la boîte de condition, comme dans l'éditeur : vraie carte, vrai store, vrai service HTTP, vrai
 * intercepteur ; seul le serveur est simulé. Cas du sondage « test » (n° 8) : « combien » (30) visible si « avec vous
 * des enfant » (29) = Oui.
 */
const SOURCE = questionDeTest({ id: 29, libelle: 'avec vous des enfant', type: 'OUI_NON', options: [] });
const CIBLE = questionDeTest({ id: 30, libelle: 'combien', type: 'NUMERIQUE', options: [], configuration: {} });
const SONDAGE: SondageResponse = sondageDeTest({ id: 8, titre: 'test', sections: [sectionDeTest({ id: 9, questions: [SOURCE, CIBLE] })] });
const CONDITION = { combinaison: 'ET' as const, regles: [{ questionId: 29, operateur: 'EGAL' as const, valeur: true }] };
const URL_CONDITION = `${environment.apiUrl}/api/sondages/8/questions/30/condition`;

describe('Boîte de condition : du clic au serveur, puis à l’éditeur', () => {
  let fixture: ComponentFixture<CarteQuestion>;
  let http: HttpTestingController;

  const boite = () => document.querySelector('app-dialogue-condition');
  const listes = () => TestbedHarnessEnvironment.documentRootLoader(fixture).getAllHarnesses(MatSelectHarness.with({ ancestor: 'app-dialogue-condition' }));

  async function saisirEtCliquer(): Promise<TestRequest> {
    (fixture.componentInstance as unknown as { editerCondition(): void }).editerCondition();
    await fixture.whenStable();
    await (await listes())[0].clickOptions({ text: '1. avec vous des enfant' });
    await (await listes())[1].clickOptions({ text: 'est égal à' });
    await (await listes())[2].clickOptions({ text: 'Oui' });
    Array.from(boite()!.querySelectorAll('button')).find((b) => b.textContent?.includes('Enregistrer la condition'))!.click();
    await fixture.whenStable();
    return http.expectOne(URL_CONDITION);
  }

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(), EditeurSondageStore],
    });
    http = TestBed.inject(HttpTestingController);
    // Session ouverte : le jeton doit accompagner le PUT.
    TestBed.inject(AuthService).connexion({ courriel: 'a@b.c', motDePasse: 'x' }).subscribe();
    http.expectOne(`${environment.apiUrl}/api/auth/connexion`).flush({
      jeton: 'JETON-ACCES', typeJeton: 'Bearer', expireDans: 900, jetonRafraichissement: 'R', role: 'ADMIN',
      statutAbonnement: 'ACTIF', motDePasseTemporaire: false, utilisateur: { prenom: 'A', nom: 'B', role: 'ADMIN', motDePasseTemporaire: false },
    });
    TestBed.inject(EditeurSondageStore).charger(8).subscribe();
    http.expectOne(`${environment.apiUrl}/api/sondages/8`).flush(SONDAGE);
    http.match(() => true).forEach((r) => r.flush([]));
    fixture = TestBed.createComponent(CarteQuestion);
    fixture.componentRef.setInput('question', CIBLE);
    fixture.componentRef.setInput('cle', 'question-30');
    fixture.componentRef.setInput('sectionId', 9);
    fixture.componentRef.setInput('numero', 2);
    fixture.componentRef.setInput('position', 1);
    fixture.componentRef.setInput('nombreEnregistrees', 2);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = ''));
  });

  it('clic -> PUT exact (ids du sondage et des questions, corps, jeton) ; réponse avec la condition -> boîte fermée, résumé', async () => {
    const requete = await saisirEtCliquer();
    expect(requete.request.method).toBe('PUT');
    expect(requete.request.body).toEqual(CONDITION);
    expect(requete.request.headers.get('Authorization')).toBe('Bearer JETON-ACCES');
    const avecCondition = structuredClone(SONDAGE);
    avecCondition.sections[0].questions[1].condition = CONDITION;
    requete.flush(avecCondition);
    for (let i = 0; i < 20 && boite(); i++) {
      await new Promise((r) => setTimeout(r, 20));
      fixture.detectChanges();
    }
    expect(boite()).toBeNull();
    expect(fixture.nativeElement.querySelector('app-resume-condition')!.textContent).toContain('Visible si : avec vous des enfant = Oui');
  });

  it('réponse SANS la condition (le serveur ne l’a pas gardée) : boîte ouverte et erreur près du bouton', async () => {
    const requete = await saisirEtCliquer();
    requete.flush(SONDAGE);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(boite()).not.toBeNull();
    const erreur = boite()!.querySelector('mat-dialog-actions .erreur-enregistrement')!;
    expect(erreur.getAttribute('role')).toBe('alert');
    expect(erreur.textContent).toContain(messageNonEnregistree());
    expect(fixture.nativeElement.querySelector('app-resume-condition')).toBeNull();
  });

  it('refus du serveur : message, statut HTTP et code visibles près du bouton ; boîte ouverte', async () => {
    const requete = await saisirEtCliquer();
    requete.flush({ code: 'CONDITION_INVALIDE', message: 'Règle 1 : la valeur doit être true (oui) ou false (non).' }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();
    fixture.detectChanges();
    const erreur = boite()!.querySelector('mat-dialog-actions .erreur-enregistrement')!;
    expect(erreur.textContent).toContain('Règle 1 : la valeur doit être true (oui) ou false (non).');
    expect(erreur.textContent).toContain('HTTP 400 · CONDITION_INVALIDE');
  });

  it('serveur injoignable (erreur réseau) : message clair, boîte ouverte', async () => {
    const requete = await saisirEtCliquer();
    requete.error(new ProgressEvent('error'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(boite()!.querySelector('.erreur-enregistrement')!.textContent).toContain('HTTP 0');
    expect(new HttpErrorResponse({ status: 0 }).status).toBe(0);
  });
});
