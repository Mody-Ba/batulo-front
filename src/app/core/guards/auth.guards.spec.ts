import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { environment } from '../../../environments/environment';
import { StatutAbonnement } from '../models/abonnement.model';
import { Role } from '../models/role.model';
import { AuthService } from '../services/auth.service';
import { inviteGuard, roleGuard } from './auth.guards';

function executer(garde: CanActivateFn, url: string): string | true {
  const resultat = TestBed.runInInjectionContext(() =>
    garde({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  );
  if (resultat instanceof UrlTree) {
    return TestBed.inject(Router).serializeUrl(resultat);
  }
  return resultat as true;
}

describe('gardes', () => {
  let auth: AuthService;
  let serveur: HttpTestingController;

  function connecter(role: Role, statut: StatutAbonnement | null, temporaire = false): void {
    auth.connexion({ courriel: 'a@b.c', motDePasse: 'x' }).subscribe();
    serveur.expectOne(`${environment.apiUrl}/api/auth/connexion`).flush({
      jeton: 'A',
      typeJeton: 'Bearer',
      expireDans: 900,
      jetonRafraichissement: 'R',
      role,
      statutAbonnement: statut,
      motDePasseTemporaire: temporaire,
      utilisateur: { prenom: 'A', nom: 'B', role, motDePasseTemporaire: temporaire },
    });
  }

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    serveur = TestBed.inject(HttpTestingController);
  });

  it('renvoie un visiteur vers la connexion', () => {
    expect(executer(roleGuard('ADMIN'), '/admin')).toBe('/connexion');
  });

  it('laisse passer le bon rôle', () => {
    connecter('ADMIN', 'ACTIF');
    expect(executer(roleGuard('ADMIN'), '/admin')).toBe(true);
  });

  it('refuse un autre rôle', () => {
    connecter('GESTIONNAIRE', 'ACTIF');
    expect(executer(roleGuard('ADMIN'), '/admin')).toBe('/acces-refuse');
  });

  it('impose le changement d’un mot de passe temporaire', () => {
    connecter('SUPER_ADMIN', null, true);
    expect(executer(roleGuard('SUPER_ADMIN'), '/super-admin')).toBe('/changer-mot-de-passe');
  });

  it('abonnement en attente : l’admin ne voit que la page abonnement', () => {
    connecter('ADMIN', 'EN_ATTENTE_PAIEMENT');
    expect(executer(roleGuard('ADMIN'), '/admin')).toBe('/admin/abonnement');
    expect(executer(roleGuard('ADMIN'), '/admin/abonnement')).toBe(true);
  });

  it('abonnement en attente ou désactivé : le gestionnaire est bloqué', () => {
    connecter('GESTIONNAIRE', 'EN_ATTENTE_PAIEMENT');
    expect(executer(roleGuard('GESTIONNAIRE'), '/gestionnaire')).toBe('/compte-suspendu');
  });

  it('abonnement expiré : accès en lecture, pas de redirection', () => {
    connecter('ADMIN', 'EXPIRE');
    expect(executer(roleGuard('ADMIN'), '/admin')).toBe(true);
  });

  it('pages publiques : un compte connecté va vers son accueil', () => {
    connecter('ADMIN', 'EN_ATTENTE_PAIEMENT');
    expect(executer(inviteGuard, '/connexion')).toBe('/admin/abonnement');
  });
});
