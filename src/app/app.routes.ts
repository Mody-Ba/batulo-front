import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard, connecteGuard, inviteGuard, roleGuard } from './core/guards/auth.guards';
import { AuthService } from './core/services/auth.service';

const pageAVenir = () =>
  import('./shared/components/page-a-venir/page-a-venir').then((m) => m.PageAVenir);

/*
 * Les gardes ne font que choisir la page affichée : le serveur vérifie le jeton, le rôle et
 * l'abonnement à chaque appel, c'est lui seul qui protège les données.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => inject(AuthService).urlAccueil(),
  },

  // ---------- Pages publiques (sans mise en page) ----------
  {
    path: 'connexion',
    title: 'Connexion · Batulo',
    canActivate: [inviteGuard],
    loadComponent: () => import('./features/auth/connexion/connexion').then((m) => m.Connexion),
  },
  {
    path: 'inscription',
    title: 'Créer un compte · Batulo',
    canActivate: [inviteGuard],
    loadComponent: () =>
      import('./features/auth/inscription/inscription').then((m) => m.Inscription),
  },
  {
    path: 'mot-de-passe-oublie',
    title: 'Mot de passe oublié · Batulo',
    canActivate: [inviteGuard],
    loadComponent: () =>
      import('./features/auth/mot-de-passe-oublie/mot-de-passe-oublie').then(
        (m) => m.MotDePasseOublie,
      ),
  },
  {
    // Adresse du lien envoyé par courriel (batulo.mot-de-passe.url-reinitialisation du backend).
    path: 'reinitialiser-mot-de-passe',
    title: 'Nouveau mot de passe · Batulo',
    loadComponent: () =>
      import('./features/auth/reinitialiser-mot-de-passe/reinitialiser-mot-de-passe').then(
        (m) => m.ReinitialiserMotDePasse,
      ),
  },
  {
    // Connecté, même avec un mot de passe temporaire.
    path: 'changer-mot-de-passe',
    title: 'Changer le mot de passe · Batulo',
    canActivate: [connecteGuard],
    loadComponent: () =>
      import('./features/auth/changer-mot-de-passe/changer-mot-de-passe').then(
        (m) => m.ChangerMotDePasse,
      ),
  },

  // ---------- Formulaire public du répondant (sans compte, hors mise en page) ----------
  {
    // Lien public d'un sondage (PUBLIC_FORM_URL du backend) : le même pour toutes les versions.
    path: 's/:jeton',
    title: 'Répondre au sondage · Batulo',
    loadComponent: () =>
      import('./features/public/formulaire-public/formulaire-public').then((m) => m.FormulairePublic),
  },

  // ---------- Pages connectées (barre du haut + menu latéral) ----------
  {
    path: '',
    canActivate: [connecteGuard],
    loadComponent: () =>
      import('./layout/mise-en-page/mise-en-page').then((m) => m.MiseEnPage),
    children: [
      {
        path: 'acces-refuse',
        title: 'Accès refusé · Batulo',
        loadComponent: () =>
          import('./features/erreurs/acces-refuse/acces-refuse').then((m) => m.AccesRefuse),
      },
      {
        path: 'compte-suspendu',
        title: 'Accès suspendu · Batulo',
        loadComponent: () =>
          import('./features/erreurs/compte-suspendu/compte-suspendu').then(
            (m) => m.CompteSuspendu,
          ),
      },
      {
        path: 'super-admin',
        canActivate: [roleGuard('SUPER_ADMIN')],
        loadChildren: () =>
          import('./features/super-admin/super-admin.routes').then((m) => m.routes),
      },
      {
        path: 'admin',
        canActivate: [roleGuard('ADMIN')],
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.routes),
      },
      {
        path: 'gestionnaire',
        canActivate: [roleGuard('GESTIONNAIRE')],
        loadChildren: () =>
          import('./features/gestionnaire/gestionnaire.routes').then((m) => m.routes),
      },
      // Rubriques communes à plusieurs rôles, livrées dans les étapes suivantes.
      {
        path: 'sondages',
        canActivate: [roleGuard('ADMIN', 'GESTIONNAIRE')],
        loadChildren: () => import('./features/sondages/sondages.routes').then((m) => m.routes),
      },
      {
        path: 'messagerie',
        title: 'Messagerie · Batulo',
        canActivate: [authGuard],
        loadComponent: pageAVenir,
        data: { titre: 'Messagerie', icone: 'forum', etape: 'F8' },
      },
      {
        path: 'notifications',
        title: 'Notifications · Batulo',
        canActivate: [authGuard],
        loadComponent: pageAVenir,
        data: { titre: 'Notifications', icone: 'notifications', etape: 'F8' },
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
