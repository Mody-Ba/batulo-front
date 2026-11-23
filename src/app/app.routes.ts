import { Routes } from '@angular/router';
import { authGuard, connecteGuard, inviteGuard, roleGuard } from './core/guards/auth.guards';

/*
 * Les gardes ne font que choisir la page affichée : le serveur vérifie le jeton, le rôle et
 * l'abonnement à chaque appel, c'est lui seul qui protège les données.
 */
export const routes: Routes = [
  {
    // Vitrine publique pour un visiteur ; un compte connecté va à son accueil (tableau de bord ou page imposée).
    path: '',
    pathMatch: 'full',
    title: 'titres.vitrine',
    canActivate: [inviteGuard],
    loadComponent: () => import('./features/vitrine/vitrine').then((m) => m.Vitrine),
  },

  // ---------- Pages publiques (sans mise en page) ----------
  {
    path: 'connexion',
    title: 'titres.connexion',
    canActivate: [inviteGuard],
    loadComponent: () => import('./features/auth/connexion/connexion').then((m) => m.Connexion),
  },
  {
    path: 'inscription',
    title: 'titres.inscription',
    canActivate: [inviteGuard],
    loadComponent: () =>
      import('./features/auth/inscription/inscription').then((m) => m.Inscription),
  },
  {
    path: 'mot-de-passe-oublie',
    title: 'titres.motDePasseOublie',
    canActivate: [inviteGuard],
    loadComponent: () =>
      import('./features/auth/mot-de-passe-oublie/mot-de-passe-oublie').then(
        (m) => m.MotDePasseOublie,
      ),
  },
  {
    // Adresse du lien envoyé par courriel (batulo.mot-de-passe.url-reinitialisation du backend).
    path: 'reinitialiser-mot-de-passe',
    title: 'titres.nouveauMotDePasse',
    loadComponent: () =>
      import('./features/auth/reinitialiser-mot-de-passe/reinitialiser-mot-de-passe').then(
        (m) => m.ReinitialiserMotDePasse,
      ),
  },
  {
    // Connecté, même avec un mot de passe temporaire.
    path: 'changer-mot-de-passe',
    title: 'titres.changerMotDePasse',
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
    title: 'public.titres.repondre',
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
        title: 'titres.accesRefuse',
        loadComponent: () =>
          import('./features/erreurs/acces-refuse/acces-refuse').then((m) => m.AccesRefuse),
      },
      {
        path: 'compte-suspendu',
        title: 'titres.accesSuspendu',
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
      // Rubriques communes à plusieurs rôles.
      {
        path: 'sondages',
        canActivate: [roleGuard('ADMIN', 'GESTIONNAIRE')],
        loadChildren: () => import('./features/sondages/sondages.routes').then((m) => m.routes),
      },
      {
        // Apparence des formulaires de l'entreprise : modifiable par l'admin, en lecture seule pour ses gestionnaires.
        path: 'apparence',
        title: 'titres.apparence',
        canActivate: [roleGuard('ADMIN', 'GESTIONNAIRE')],
        loadComponent: () => import('./features/apparence/page-apparence').then((m) => m.PageApparence),
      },
      {
        path: 'messagerie',
        canActivate: [authGuard],
        loadChildren: () => import('./features/messagerie/messagerie.routes').then((m) => m.routes),
      },
      {
        path: 'notifications',
        canActivate: [authGuard],
        loadChildren: () => import('./features/notifications/notifications.routes').then((m) => m.routes),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
