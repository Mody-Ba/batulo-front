import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { Role } from './core/models/role.model';
import { StatutAbonnement } from './core/models/abonnement.model';
import { Vitrine } from './features/vitrine/vitrine';

/** Session comme l'écrit AuthService (sessionStorage, clé batulo.session). */
function ouvrirSession(role: Role, modifs: { statutAbonnement?: StatutAbonnement | null; motDePasseTemporaire?: boolean } = {}): void {
  sessionStorage.setItem(
    'batulo.session',
    JSON.stringify({
      jeton: 'jeton',
      jetonRafraichissement: 'rafraichissement',
      expireLe: Date.now() + 900_000,
      role,
      statutAbonnement: role === 'SUPER_ADMIN' ? null : 'ACTIF',
      motDePasseTemporaire: false,
      utilisateur: { id: 1, prenom: 'Awa', nom: 'Diallo', courriel: 'awa@test.local', role, entrepriseId: 1, entreprise: 'Sahel Data', actif: true, motDePasseTemporaire: false },
      ...modifs,
    }),
  );
}

/** Routage réel de l'application (gardes, redirections, chargement à la demande), vrai AuthService. */
describe('Routage : vitrine pour un visiteur, tableau de bord pour un compte connecté', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  function configurer(): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
  }

  async function aller(url: string): Promise<string> {
    configurer();
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    return router.url;
  }

  it('visiteur sur « / » : la vitrine s’affiche (pas de redirection vers la connexion)', async () => {
    configurer();
    const harness = await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/');
    expect(harness.routeDebugElement!.componentInstance).toBeInstanceOf(Vitrine);
  });

  it.each<[Role, string]>([
    ['ADMIN', '/admin'],
    ['GESTIONNAIRE', '/gestionnaire'],
    ['SUPER_ADMIN', '/super-admin'],
  ])('%s connecté sur « / » : son tableau de bord (%s)', async (role, accueil) => {
    ouvrirSession(role);
    expect(await aller('/')).toBe(accueil);
  });

  it('connecté sur « /connexion » (bouton Connexion de la vitrine) : directement son tableau de bord', async () => {
    ouvrirSession('ADMIN');
    expect(await aller('/connexion')).toBe('/admin');
  });

  it('connecté avec une page imposée : « / » y mène (mot de passe temporaire, paiement en attente)', async () => {
    ouvrirSession('GESTIONNAIRE', { motDePasseTemporaire: true });
    expect(await aller('/')).toBe('/changer-mot-de-passe');
    TestBed.resetTestingModule();
    sessionStorage.clear();
    ouvrirSession('ADMIN', { statutAbonnement: 'EN_ATTENTE_PAIEMENT' });
    expect(await aller('/')).toBe('/admin/abonnement/souscrire');
  });

  it('routes existantes inchangées : connexion et inscription pour un visiteur, espace protégé -> connexion, /s/:jeton public', async () => {
    expect(await aller('/connexion')).toBe('/connexion');
    TestBed.resetTestingModule();
    expect(await aller('/inscription')).toBe('/inscription');
    TestBed.resetTestingModule();
    expect(await aller('/admin')).toBe('/connexion');
    TestBed.resetTestingModule();
    expect(await aller('/s/Ab3x')).toBe('/s/Ab3x');
  });

  it('adresse inconnue : la vitrine pour un visiteur', async () => {
    expect(await aller('/nulle-part')).toBe('/');
  });
});
