# Batulo – frontend

Frontend Angular de Batulo, plateforme SaaS de sondages (B2B).

## Références
- Cahier des charges : `docs/cahier-des-charges.pdf` (référence fonctionnelle).
- Backend Spring Boot : `~/BATULO-SONDAGE` (phases 1 à 3 terminées), **lecture seule**. Son `CLAUDE.md` décrit
  toutes les règles métier et **prime sur le cahier** en cas de différence.
- Contrat de l'API : OpenAPI `http://localhost:8090/v3/api-docs`, référence exacte des routes et des JSON.
  Attention : si l'instance de l'utilisateur n'a pas été relancée, sa doc peut être en retard sur le code ; vérifier
  alors les records `service/model/*Request|*Response.java` du backend.
- Architecture à reproduire : `~/proxymed-front` (structure, services, intercepteur, gardes), **lecture seule**.

## Méthode de travail
- Une étape à la fois : plan d'abord (arborescence, routes, services), accord de l'utilisateur, puis code ;
  attendre sa validation avant l'étape suivante.
- **Aucune commande Git** : l'utilisateur gère le dépôt.
- Ne rien modifier dans `~/BATULO-SONDAGE` ni dans `~/proxymed-front`.
- Le backend de l'utilisateur tourne sur 8090 (IntelliJ) : ne jamais l'arrêter. Pour un test de bout en bout, lancer
  le jar du backend sur 8092 avec la base `batulo_test` (conteneur `batulo-db`, port 5434) et un Mailpit à part
  (jamais celui de l'utilisateur sur 1025/8025), pointer temporairement `environment.ts` sur 8092 et servir le front
  sur 4300 (`CORS_ORIGINS`, `RESET_PASSWORD_URL`) ; tout arrêter, supprimer et remettre 8090 à la fin.
- Vérifications : `npx ng build` (sans avertissement) et `npx ng test --watch=false` (Vitest).

## Règles techniques
- Dernière version stable d'Angular (22.x), composants **standalone**, **signals** (`signal`, `computed`,
  `input`, `output`), contrôle de flux `@if/@for/@switch`, **Reactive Forms** (`NonNullableFormBuilder`),
  **Angular Material** (Material 3, thème dans `src/styles.scss`, champs `outline` + `subscriptSizing: 'dynamic'`).
- Tous les textes en **français** (apostrophe typographique ’), locale `fr-CA`.
- **Modèles TypeScript séparés par domaine** dans `core/models/` (copie exacte des JSON du backend).
- **Un service HTTP par domaine** dans `core/services/`, URL tirée de `environment.apiUrl` (jamais écrite ailleurs).
- **Responsive, mobile d'abord** (impératif pour le formulaire public F6) : pas de largeur fixe, cibles tactiles
  de 44 px, grilles qui passent à une colonne sous 600 px.
- Accessibilité : `role="alert"` pour les erreurs, `role="status"` pour les infos, icônes décoratives
  `aria-hidden`, libellés `aria-label` sur les boutons-icônes, focus visible.
- Variables CSS propres à Batulo préfixées `--bt-` (espacements, couleurs absentes de Material 3).
- Routes chargées à la demande (`loadComponent`, `loadChildren`), titre de page `… · Batulo`.

## Architecture
```
src/app/
  core/
    models/        un fichier par domaine (auth, utilisateur, abonnement, notification, inscription, page, erreur, role)
    services/      un service par domaine (auth = session en signals, inscription, mot-de-passe, notification,
                   abonnement, stripe = chargement de Stripe.js)
    interceptors/  auth.interceptor.ts + contexte-http.ts (SANS_AUTHENTIFICATION)
    guards/        auth.guards.ts (authGuard, roleGuard, connecteGuard, inviteGuard)
    utils/         erreur-http.ts (messages d'erreur), validateurs.ts (règles du backend)
  layout/          mise-en-page (sidenav + contenu), barre-haut, bandeau-abonnement, menu-lateral (+ liens-navigation.ts),
                   cloche-notifications
  features/        auth/, super-admin/, admin/, gestionnaire/, erreurs/ (un *.routes.ts par espace de rôle)
  shared/components/ encadre, message-erreur, entete-page, page-a-venir, accueil-provisoire
  testing/         données partagées par les tests unitaires (donnees-test.ts)
```

## Session, intercepteur et gardes (F1)
- Session dans **`sessionStorage`** (clé `batulo.session`) : une session par onglet. Ne pas passer à
  `localStorage` : deux onglets réutiliseraient le même jeton de rafraîchissement, à usage unique, et le backend
  fermerait alors toutes les sessions du compte.
- Jeton d'accès 15 min, jeton de rafraîchissement 7 jours (usage unique). L'intercepteur : n'envoie le jeton qu'à
  l'origine de `environment.apiUrl` ; sur 401 (hors routes publiques `/api/auth/connexion|inscription|rafraichir|
  mot-de-passe-oublie|reinitialiser-mot-de-passe`) lance **un seul** `POST /api/auth/rafraichir` partagé
  (`AuthService.rafraichir()`), puis rejoue ; si le rafraîchissement échoue, `terminerSession()` -> /connexion
  avec « session expirée ». Sur 403 `MOT_DE_PASSE_TEMPORAIRE`, `ABONNEMENT_EN_ATTENTE_PAIEMENT` ou
  `ABONNEMENT_DESACTIVE` : met à jour la session et redirige ; les autres 403 sont affichés par la page.
- `AuthService.redirectionObligatoire()` (une seule source de vérité, utilisée par gardes, menu et accueil) :
  mot de passe temporaire -> `/changer-mot-de-passe` ; sinon (hors SUPER_ADMIN) `DESACTIVE` -> `/compte-suspendu`,
  `EN_ATTENTE_PAIEMENT` -> `/admin/abonnement` (admin) ou `/compte-suspendu` (gestionnaire). `EXPIRE` : pas de
  redirection, bandeau « lecture seule » dans la mise en page.
- Les gardes ne protègent aucune donnée (le serveur le fait) : elles choisissent seulement la page.
- Le statut d'abonnement est écrit dans le jeton : après un paiement (F2), appeler `rafraichir()` (ou
  `mettreAJourStatutAbonnement`) pour que le front et le backend voient le nouveau statut.

## Abonnement et paiement Stripe (F2)
- Pages : `/admin/abonnement` (Mon abonnement ; redirige vers `souscrire` si EN_ATTENTE_PAIEMENT) et
  `/admin/abonnement/souscrire?formule=MENSUEL|ANNUEL` (choix -> paiement -> succès). Pas de bouton d'annulation.
- Parcours : `POST /paiement/intention { formule }` -> `StripeService.charger(clePublique)` (`@stripe/stripe-js/pure`,
  locale `fr-CA`, Stripe.js chargé seulement à ce moment) -> champs `cardNumber`, `cardExpiry`, `cardCvc` ->
  `stripe.confirmCardPayment(clientSecret)` -> si `succeeded` : `POST /paiement/confirmer { paymentIntentId }`
  -> `auth.rafraichir()` (le statut est dans le jeton ; échec = `terminerSession`) -> « Vous êtes bien abonné »
  -> `/admin` après 4 s.
- Les données de carte restent dans les iframes Stripe ; ne jamais journaliser `clientSecret`.
- Paiement accepté par Stripe mais non confirmé par Batulo (réseau, `PAIEMENT_NON_REUSSI`) : ne jamais reproposer
  la carte (double paiement) ; seulement « Vérifier à nouveau » (`/confirmer` est idempotent).
- Erreurs Stripe traduites dans `core/utils/stripe-erreurs.ts` (`decline_code`, puis `code`, puis message
  localisé pour les erreurs de saisie ; jamais un message anglais).
- `AbonnementService.abonnement` (signal) alimente le bandeau de l'admin (`layout/bandeau-abonnement`) : chargé
  par la mise en page pour le rôle ADMIN, mis à jour par `/confirmer`, vidé à la déconnexion. Alerte à 7 jours ou
  moins (`abonnementEnAlerte`), erreur si EXPIRE ; masqué sur `/admin/abonnement/**`.
- Champs Stripe dans des iframes : les couleurs du thème leur sont passées calculées (`styleStripe()`).
- **À ajouter au backend** pour l'historique des paiements : `GET /api/abonnements/paiements?page&taille`
  (ADMIN, entreprise du jeton, plus récents d'abord) -> `PageResponse<PaiementResponse>` avec `id`, `formule`,
  `montant`, `devise`, `statut` (`EN_ATTENTE|REUSSI|ECHOUE`), `datePaiement`, `periodeDebut`, `periodeFin`.
  Permise en EN_ATTENTE_PAIEMENT et EXPIRE (déjà le cas pour `/api/abonnements/**`). Côté front : un tableau
  dans la carte « Paiements » de `mon-abonnement`.

## Règles du backend utiles au front
- Erreurs toujours en JSON `{ code, message }` (+ `erreurs[]` par question pour les réponses à un sondage).
  Afficher le `message` (déjà en français) avec `<app-message-erreur [erreur]="…">` ; une erreur `VALIDATION`
  (« champ : message ; champ : message ») est détaillée champ par champ par `detailsErreur()`.
- Règle du mot de passe : 8 caractères au moins, une lettre et un chiffre, 72 au plus (`validateurs.ts`).
- Accès selon l'abonnement (AccesAbonnementInterceptor) : EN_ATTENTE_PAIEMENT -> seulement `/api/auth/**`,
  `/api/abonnements/**`, `/api/messagerie/**` ; EXPIRE -> lecture seule (GET) sauf ces routes et l'envoi des
  statistiques ; DESACTIVE -> rien. Donc pas d'appel aux notifications tant qu'une page est imposée.
- Lien de réinitialisation : `http://localhost:4200/reinitialiser-mot-de-passe?jeton=…` (valable 1 h, usage
  unique, ferme toutes les sessions). Formulaire public : `http://localhost:4200/s/{jeton}` (F6).
- Les règles métier détaillées (versions, assignations, collecte, statistiques, messagerie…) sont dans le
  `CLAUDE.md` du backend : le relire au début de chaque étape.

## Plan des étapes
- [x] **F1 – Socle et authentification** : structure, mise en page (barre du haut avec utilisateur et
  notifications, menu latéral par rôle), connexion, inscription admin, mot de passe oublié, réinitialisation,
  changement obligatoire du mot de passe temporaire, intercepteur (jeton, rafraîchissement, déconnexion),
  gardes par rôle et par statut, affichage des erreurs.
- [x] **F2 – Abonnement et Stripe** : formules, paiement Stripe Elements, confirmation, rafraîchissement du jeton,
  bandeau d'abonnement de l'admin, page « Mon abonnement » (dernier paiement ; historique en attente du backend).
  Reste : demande d'augmentation (`/api/abonnements/demandes`, avec la messagerie en F8).
- [ ] **F3 – Super admin** : admins et entreprises, abonnements, demandes d'abonnement.
- [ ] **F4 – Admin et gestionnaires** : gestion des gestionnaires (création, activation, permission sondages).
- [ ] **F5 – Éditeur de sondage** : sondages, sections, questions, versions, modèles, assignations, publication.
- [ ] **F6 – Formulaire public** (mobile d'abord) : `/s/:jeton`, hors mise en page connectée.
- [ ] **F7 – Statistiques et exports** : statistiques, critères, tableaux croisés, exports CSV/XLSX/PDF.
- [ ] **F8 – Messagerie et notifications** : conversations, page complète des notifications.

Les rubriques des étapes à venir existent déjà dans le menu (`layout/menu-lateral/liens-navigation.ts`) et mènent
à `PageAVenir` : remplacer la route correspondante par la vraie page.
