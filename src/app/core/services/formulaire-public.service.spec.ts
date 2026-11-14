import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { AuthService } from './auth.service';
import { FormulairePublicService } from './formulaire-public.service';

describe('FormulairePublicService', () => {
  let serveur: HttpTestingController;
  let service: FormulairePublicService;
  const rafraichir = vi.fn();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        // Une session est ouverte dans ce navigateur (un admin teste son propre lien).
        { provide: AuthService, useValue: { jeton: signal('jeton-admin'), estConnecte: signal(true), rafraichir } },
      ],
    });
    serveur = TestBed.inject(HttpTestingController);
    service = TestBed.inject(FormulairePublicService);
  });

  afterEach(() => serveur.verify());

  it('lecture : sans jeton de session, même connecté', () => {
    service.lire('Ab3x').subscribe();
    const requete = serveur.expectOne(`${environment.apiUrl}/api/public/sondages/Ab3x`);
    expect(requete.request.method).toBe('GET');
    expect(requete.request.headers.has('Authorization')).toBe(false);
  });

  it('envoi : corps tel quel, sans jeton ; un 401 n’est jamais « rafraîchi »', () => {
    const erreur = vi.fn();
    service.repondre('Ab3x', { jetonRepondant: 'u', reponses: [{ questionId: 1, valeur: true }] }).subscribe({ error: erreur });
    const requete = serveur.expectOne(`${environment.apiUrl}/api/public/sondages/Ab3x/reponses`);
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toEqual({ jetonRepondant: 'u', reponses: [{ questionId: 1, valeur: true }] });
    expect(requete.request.headers.has('Authorization')).toBe(false);
    requete.flush({ code: 'X', message: 'x' }, { status: 401, statusText: 'Unauthorized' });
    expect(rafraichir).not.toHaveBeenCalled();
    expect(erreur).toHaveBeenCalled();
  });

  it('jeton du lien encodé dans l’adresse', () => {
    service.lire('a/b c').subscribe();
    serveur.expectOne(`${environment.apiUrl}/api/public/sondages/a%2Fb%20c`);
  });
});
