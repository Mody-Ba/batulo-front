import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { StatutAbonnement } from '../models/abonnement.model';
import { Role } from '../models/role.model';
import { creditsDeTest } from '../../testing/donnees-test';
import { AuthService } from './auth.service';

/** Sondages achetés : le compte de crédits ouvre l'accès malgré EN_ATTENTE_PAIEMENT ou EXPIRE. */
describe('AuthService : sondages achetés', () => {
  const url = `${environment.apiUrl}/api/auth`;
  let auth: AuthService;
  let serveur: HttpTestingController;

  const reponseConnexion = (role: Role, statutAbonnement: StatutAbonnement | null) => ({
    jeton: 'A',
    typeJeton: 'Bearer',
    expireDans: 900,
    jetonRafraichissement: 'R',
    role,
    statutAbonnement,
    motDePasseTemporaire: false,
    utilisateur: { id: 7, prenom: 'A', nom: 'B', role, motDePasseTemporaire: false },
  });

  function connecter(role: Role, statut: StatutAbonnement | null, credits?: ReturnType<typeof creditsDeTest> | null): void {
    auth.connexion({ courriel: 'a@b.c', motDePasse: 'x' }).subscribe();
    serveur.expectOne(`${url}/connexion`).flush(reponseConnexion(role, statut));
    if (credits !== undefined) {
      serveur.expectOne(`${url}/moi`).flush({
        utilisateur: reponseConnexion(role, statut).utilisateur,
        statutAbonnement: statut,
        credits,
      });
    }
  }

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    serveur = TestBed.inject(HttpTestingController);
  });

  afterEach(() => serveur.verify());

  it('abonnement actif : pas de lecture du profil à la connexion, aucun solde affiché', () => {
    connecter('ADMIN', 'ACTIF');
    expect(auth.abonnementIllimite()).toBe(true);
    expect(auth.soldeAffiche()).toBeNull();
    expect(auth.urlAccueil()).toBe('/admin');
  });

  it('en attente de paiement avec des sondages achetés : accès complet (pas de page imposée), solde affiché', () => {
    connecter('ADMIN', 'EN_ATTENTE_PAIEMENT', creditsDeTest({ solde: 4 }));
    expect(auth.compteCredits()).toBe(true);
    expect(auth.redirectionObligatoire()).toBeNull();
    expect(auth.urlAccueil()).toBe('/admin');
    expect(auth.soldeAffiche()).toBe(4);
  });

  it('en attente sans achat : la page d’abonnement reste imposée (gestionnaire : compte suspendu)', () => {
    connecter('ADMIN', 'EN_ATTENTE_PAIEMENT', creditsDeTest({ solde: 0, totalAchete: 0, totalUtilise: 0, compteCredits: false }));
    expect(auth.redirectionObligatoire()).toBe('/admin/abonnement');
    expect(auth.soldeAffiche()).toBeNull();
  });

  it('gestionnaire d’une entreprise à crédits, en attente : accès complet', () => {
    connecter('GESTIONNAIRE', 'EN_ATTENTE_PAIEMENT', creditsDeTest());
    expect(auth.redirectionObligatoire()).toBeNull();
  });

  it('expiré : lecture seule sans compte de crédits, écriture avec', () => {
    connecter('ADMIN', 'EXPIRE', null);
    expect(auth.lectureSeule()).toBe(true);
    auth.mettreAJourCredits(creditsDeTest({ solde: 0 }));
    expect(auth.lectureSeule()).toBe(false);
    expect(auth.soldeAffiche()).toBe(0);
  });

  it('profil illisible à la connexion : la connexion aboutit quand même (page imposée habituelle)', () => {
    const resultats: unknown[] = [];
    auth.connexion({ courriel: 'a@b.c', motDePasse: 'x' }).subscribe({ next: (r) => resultats.push(r), error: (e) => resultats.push(e) });
    serveur.expectOne(`${url}/connexion`).flush(reponseConnexion('ADMIN', 'EN_ATTENTE_PAIEMENT'));
    serveur.expectOne(`${url}/moi`).flush(null, { status: 500, statusText: 'Erreur' });
    expect(resultats).toHaveLength(1);
    expect((resultats[0] as { jeton: string }).jeton).toBe('A');
    expect(auth.urlAccueil()).toBe('/admin/abonnement');
  });

  it('le rafraîchissement du jeton garde le solde connu ; la session le mémorise', () => {
    connecter('ADMIN', 'EXPIRE', creditsDeTest({ solde: 9 }));
    auth.rafraichir().subscribe();
    serveur.expectOne(`${url}/rafraichir`).flush(reponseConnexion('ADMIN', 'EXPIRE'));
    expect(auth.credits()?.solde).toBe(9);
    expect(JSON.parse(sessionStorage.getItem('batulo.session')!).credits.solde).toBe(9);
  });

  it('super admin : jamais de solde ni de compte de crédits', () => {
    connecter('SUPER_ADMIN', null);
    expect(auth.compteCredits()).toBe(false);
    expect(auth.soldeAffiche()).toBeNull();
  });
});
