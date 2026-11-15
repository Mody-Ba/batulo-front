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

/** Carte « Page d'accueil » de l'éditeur : même enregistrement automatique que l'en-tête (un seul PUT du brouillon). */
describe('Éditeur : carte « Page d’accueil »', () => {
  const url = environment.apiUrl;
  let serveur: HttpTestingController;
  let fixture: ComponentFixture<EditeurSondage>;

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
    serveur = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EditeurSondage);
    fixture.componentRef.setInput('id', '1');
    fixture.detectChanges();
    serveur.expectOne(`${url}/api/sondages/1`).flush(sondage);
    serveur.match(`${url}/api/sondages/1/versions`).forEach((r) => r.flush([]));
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const brouillon = sondageDeTest({ id: 1, sections: [sectionDeTest({ questions: [questionDeTest()] })] });
  const carte = (el: HTMLElement) => el.querySelector<HTMLElement>('.carte-accueil')!;

  function saisir(el: HTMLElement, nom: string, valeur: string): void {
    const champ = carte(el).querySelector<HTMLTextAreaElement>(`[formcontrolname="${nom}"]`)!;
    champ.value = valeur;
    champ.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Sortie de la carte : enregistrement tout de suite (sans attendre 800 ms). */
  function sortir(el: HTMLElement): void {
    carte(el).dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    fixture.detectChanges();
  }

  it('objet et confidentialité enregistrés avec tout l’en-tête (textes nettoyés, vides -> null)', async () => {
    const el = await ouvrir(brouillon);
    expect(carte(el).querySelector('h2')!.textContent).toContain('Page d’accueil');
    saisir(el, 'objetEnquete', '  Mieux vous servir  ');
    sortir(el);
    const requete = serveur.expectOne((r) => r.method === 'PUT' && r.url === `${url}/api/sondages/1`);
    expect(requete.request.body).toEqual({
      titre: brouillon.titre,
      description: null,
      reponseUnique: brouillon.reponseUnique,
      objetEnquete: 'Mieux vous servir',
      texteConfidentialite: null,
      consentementRequis: false,
      texteConsentement: null,
    });
  });

  it('consentement exigé sans texte : erreur affichée, rien n’est envoyé ; avec le texte : enregistré', async () => {
    const el = await ouvrir(brouillon);
    carte(el).querySelector<HTMLInputElement>('[formcontrolname="consentementRequis"] input')!.click();
    fixture.detectChanges();
    sortir(el);
    serveur.expectNone((r) => r.method === 'PUT');
    expect(carte(el).textContent).toContain('Écrivez le texte de la case de consentement.');

    saisir(el, 'texteConsentement', 'J’accepte de participer.');
    sortir(el);
    const requete = serveur.expectOne((r) => r.method === 'PUT');
    expect(requete.request.body).toEqual(expect.objectContaining({ consentementRequis: true, texteConsentement: 'J’accepte de participer.' }));
  });

  it('valeurs enregistrées reprises ; sondage publié : champs en lecture seule', async () => {
    const el = await ouvrir(
      sondageDeTest({ id: 1, publie: true, statut: 'EN_COURS', objetEnquete: 'Objet', consentementRequis: true, texteConsentement: 'J’accepte' }),
    );
    const objet = carte(el).querySelector<HTMLTextAreaElement>('[formcontrolname="objetEnquete"]')!;
    expect(objet.value).toBe('Objet');
    expect(objet.disabled).toBe(true);
    expect(carte(el).querySelector<HTMLTextAreaElement>('[formcontrolname="texteConsentement"]')!.value).toBe('J’accepte');
  });

  it('400 TEXTE_CONSENTEMENT_REQUIS du serveur : message sur la carte « Page d’accueil »', async () => {
    const el = await ouvrir(brouillon);
    saisir(el, 'objetEnquete', 'Objet');
    sortir(el);
    serveur
      .expectOne((r) => r.method === 'PUT')
      .flush({ code: 'TEXTE_CONSENTEMENT_REQUIS', message: 'Le texte de consentement est obligatoire.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(carte(el).textContent).toContain('Le texte de consentement est obligatoire.');
    expect(el.querySelector('.carte-entete:not(.carte-accueil)')!.textContent).not.toContain('Le texte de consentement est obligatoire.');
  });
});
