import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ConnexionResponse } from '../models/auth.model';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

const API = environment.apiUrl;

function reponseConnexion(jeton: string, rafraichissement: string): ConnexionResponse {
  return {
    jeton,
    typeJeton: 'Bearer',
    expireDans: 900,
    jetonRafraichissement: rafraichissement,
    role: 'ADMIN',
    statutAbonnement: 'ACTIF',
    motDePasseTemporaire: false,
    utilisateur: {
      id: 1,
      prenom: 'Awa',
      nom: 'Diallo',
      courriel: 'awa@test.com',
      role: 'ADMIN',
      entrepriseId: 1,
      entreprise: 'Entreprise Test',
      actif: true,
      motDePasseTemporaire: false,
      motDePasseTemporaireExpireLe: null,
      peutCreerSondages: true,
      dateCreation: '2026-01-01T00:00:00Z',
    },
  };
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let serveur: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    serveur = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    // Ouvre une session : jeton A, rafraîchissement R1.
    auth.connexion({ courriel: 'awa@test.com', motDePasse: 'x' }).subscribe();
    serveur.expectOne(`${API}/api/auth/connexion`).flush(reponseConnexion('A', 'R1'));
  });

  afterEach(() => serveur.verify());

  it('ajoute le jeton aux appels de l’API seulement', () => {
    http.get(`${API}/api/notifications`).subscribe();
    http.get('https://ailleurs.example.com/donnees').subscribe();

    expect(serveur.expectOne(`${API}/api/notifications`).request.headers.get('Authorization')).toBe(
      'Bearer A',
    );
    expect(
      serveur.expectOne('https://ailleurs.example.com/donnees').request.headers.has('Authorization'),
    ).toBe(false);
  });

  it('sur 401 : rafraîchit une seule fois puis rejoue toutes les requêtes', () => {
    const resultats: unknown[] = [];
    http.get(`${API}/api/un`).subscribe((r) => resultats.push(r));
    http.get(`${API}/api/deux`).subscribe((r) => resultats.push(r));

    const erreur401 = { status: 401, statusText: 'Unauthorized' };
    serveur.expectOne(`${API}/api/un`).flush({ code: 'NON_AUTHENTIFIE', message: '' }, erreur401);
    serveur.expectOne(`${API}/api/deux`).flush({ code: 'NON_AUTHENTIFIE', message: '' }, erreur401);

    const rafraichir = serveur.expectOne(`${API}/api/auth/rafraichir`);
    expect(rafraichir.request.body).toEqual({ jetonRafraichissement: 'R1' });
    expect(rafraichir.request.headers.has('Authorization')).toBe(false);
    rafraichir.flush(reponseConnexion('B', 'R2'));

    const un = serveur.expectOne(`${API}/api/un`);
    const deux = serveur.expectOne(`${API}/api/deux`);
    expect(un.request.headers.get('Authorization')).toBe('Bearer B');
    expect(deux.request.headers.get('Authorization')).toBe('Bearer B');
    un.flush({ ok: 1 });
    deux.flush({ ok: 2 });

    expect(resultats).toEqual([{ ok: 1 }, { ok: 2 }]);
    expect(auth.jeton()).toBe('B');
  });

  it('déconnecte si le rafraîchissement échoue', () => {
    let erreurRecue: unknown = null;
    http.get(`${API}/api/un`).subscribe({ error: (e) => (erreurRecue = e) });

    serveur
      .expectOne(`${API}/api/un`)
      .flush({ code: 'NON_AUTHENTIFIE', message: '' }, { status: 401, statusText: 'Unauthorized' });
    serveur
      .expectOne(`${API}/api/auth/rafraichir`)
      .flush(
        { code: 'JETON_RAFRAICHISSEMENT_INVALIDE', message: 'Session expirée.' },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(erreurRecue).not.toBeNull();
    expect(auth.estConnecte()).toBe(false);
    expect(auth.messageConnexion()).toContain('session a expiré');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/connexion');
  });

  it('ne rafraîchit pas sur un 401 de la connexion (identifiants faux)', () => {
    let erreurRecue: unknown = null;
    http
      .post(`${API}/api/auth/connexion`, {})
      .subscribe({ error: (e) => (erreurRecue = e) });
    serveur
      .expectOne(`${API}/api/auth/connexion`)
      .flush(
        { code: 'IDENTIFIANTS_INVALIDES', message: 'Courriel ou mot de passe incorrect.' },
        { status: 401, statusText: 'Unauthorized' },
      );

    serveur.expectNone(`${API}/api/auth/rafraichir`);
    expect(erreurRecue).not.toBeNull();
    expect(auth.estConnecte()).toBe(true);
  });

  it('sur 403 ABONNEMENT_EN_ATTENTE_PAIEMENT : met à jour le statut et redirige', () => {
    http.get(`${API}/api/sondages`).subscribe({ error: () => undefined });
    serveur
      .expectOne(`${API}/api/sondages`)
      .flush(
        { code: 'ABONNEMENT_EN_ATTENTE_PAIEMENT', message: 'En attente.' },
        { status: 403, statusText: 'Forbidden' },
      );

    expect(auth.statutAbonnement()).toBe('EN_ATTENTE_PAIEMENT');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/abonnement');
  });

  it('sur 403 MOT_DE_PASSE_TEMPORAIRE : redirige vers le changement de mot de passe', () => {
    http.get(`${API}/api/sondages`).subscribe({ error: () => undefined });
    serveur
      .expectOne(`${API}/api/sondages`)
      .flush(
        { code: 'MOT_DE_PASSE_TEMPORAIRE', message: 'Temporaire.' },
        { status: 403, statusText: 'Forbidden' },
      );

    expect(auth.motDePasseTemporaire()).toBe(true);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/changer-mot-de-passe');
  });

  it('laisse la page gérer les autres 403', () => {
    http.get(`${API}/api/sondages/1`).subscribe({ error: () => undefined });
    serveur
      .expectOne(`${API}/api/sondages/1`)
      .flush({ code: 'ACCES_REFUSE', message: 'Non.' }, { status: 403, statusText: 'Forbidden' });

    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
