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
    models/        un fichier par domaine (auth, utilisateur, abonnement, notification, inscription, page, erreur, role,
                   gestionnaire, sondage, assignation, tableau-de-bord, super-admin, demande-abonnement,
                   formulaire-public, statistiques, messagerie)
    services/      un service par domaine (auth = session en signals, inscription, mot-de-passe, notification,
                   abonnement, stripe = chargement de Stripe.js, gestionnaire, sondage, assignation, tableau-de-bord,
                   super-admin, demande-abonnement, formulaire-public, statistiques, export, messagerie)
    interceptors/  auth.interceptor.ts + contexte-http.ts (SANS_AUTHENTIFICATION)
    guards/        auth.guards.ts (authGuard, roleGuard, connecteGuard, inviteGuard)
    utils/         erreur-http.ts (messages d'erreur), validateurs.ts (règles du backend), pagination-url.ts
                   (?page&taille), recherche.ts (DELAI_RECHERCHE_MS), stockage-local.ts (localStorage en try/catch),
                   interrogation.ts (interrogation périodique arrêtée onglet caché), montant.ts (montants fr-CA,
                   MRU sans décimales), redirection.ts (?retour= : chemins internes seulement)
  layout/          mise-en-page (sidenav + contenu), barre-haut, bandeau-abonnement, menu-lateral (+ liens-navigation.ts),
                   cloche-notifications
  features/        auth/, super-admin/, admin/, gestionnaire/, erreurs/ (un *.routes.ts par espace de rôle),
                   public/ (formulaire du répondant, sans compte), vitrine/ (site public sur « / »)
  shared/components/ encadre, message-erreur, entete-page, page-a-venir, accueil-provisoire, dialogue-confirmation,
                   filtre-statut-abonnement, echeance-abonnement, dernieres-notifications
  shared/formulaire/ formulaire côté répondant, partagé par l'aperçu (F5b) et le formulaire public (F6)
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
- Visiteur sur une page protégée : `/connexion?retour=<page demandée>` (`authGuard`, `roleGuard`, `connecteGuard`) ;
  après connexion, la page y revient. Contre les redirections ouvertes, `cheminInterne()` (`core/utils/redirection.ts`)
  n'accepte qu'un chemin commençant par un seul « / » (ni « // », ni « /\ », ni URL externe, ni caractère de
  contrôle), relu par la page de connexion ; sinon `urlAccueil()`. Une page imposée reste prioritaire (gardes).
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
- Historique des paiements (carte « Paiements » de `mon-abonnement`) : `GET /api/abonnements/paiements?page&taille`
  -> `PageResponse<PaiementResponse>` (`id`, `datePaiement`, `formule`, `montant`, `devise`), paiements **REUSSI
  seulement**, plus récents d'abord ; pas de statut ni de période. Pagination locale à la carte (5, 10, 20), le
  paginateur n'apparaît qu'au-delà de 5 paiements.

## Paiement mobile Moosyl (Bankily, Masrvi, Sedad…)
- À côté de la carte Stripe (inchangée). Contrat vérifié dans l'OpenAPI : `PaiementMobileRequest|Response`,
  `StatutPaiementMobileResponse`, `FormuleResponse.prixMobile|deviseMobile`, `PaiementResponse.fournisseur`
  (STRIPE|MOOSYL).
- `/admin/abonnement/souscrire[?formule&moyen=carte|mobile]` : choix du moyen (cartes radio « Carte bancaire » /
  « Application mobile (Bankily, Masrvi, Sedad…) »), prix du moyen choisi (`prix` CAD ou `prixMobile` MRU, économie
  annuelle comprise). Mobile : `paiement-mobile/paiement-mobile` (étape 2) -> `POST /api/abonnements/paiement-mobile
  { formule }` (le téléphone n'est pas envoyé : Moosyl le demande) -> code QR de `checkoutUrl`, « Payer sur ce
  téléphone » (lien dans le **même onglet** : la session est en sessionStorage, un nouvel onglet reviendrait sans
  session), montant, « Valable jusqu'à » (`expireLe`, 30 min côté backend, rien si absent), « Une fois payé, revenez
  sur cette page ». Succès : signal `abonnement`, `mettreAJourStatutAbonnement` puis `rafraichir()` (statut dans le
  jeton ; échec -> reconnexion), écran « Vous êtes bien abonné » commun avec la carte.
- Suivi (`suivi-paiement-mobile.ts`, `suivrePaiementMobile`) : `GET .../paiement-mobile/{reference}` toutes les 3 s par
  `interrogationPeriodique` (rien onglet caché, relu tout de suite au retour), arrêt à REUSSI / ECHOUE, à `expireLe`
  après une dernière lecture (« expire » si toujours EN_ATTENTE ; sans expireLe : 10 min), ou en quittant la page.
  Erreurs passagères (réseau, 408, 429, 5xx) ignorées ; les autres (404 PAIEMENT_INTROUVABLE…) arrêtent le suivi.
  503 PAIEMENT_MOBILE_NON_CONFIGURE et 502 MOOSYL_ERREUR : message du serveur et « Réessayer ».
- Retour de Moosyl : `/admin/abonnement/paiement-mobile?reference=` (`retour-paiement-mobile`, permise en attente de
  paiement car sous `/admin/abonnement`) : même suivi ; réussi -> nouveau jeton, « Abonnement activé » et lien vers
  `/admin` ; échoué -> « Réessayer » (`souscrire?moyen=mobile&formule=`) ; référence absente ou 404 -> lien vers la
  souscription ; attente trop longue -> « Vérifier à nouveau ». Le téléphone qui a scanné le QR n'a pas de session :
  connexion puis retour sur cette page (`?retour=`) ; l'ordinateur voit le succès par son propre suivi.
- Code QR : bibliothèque `uqr` (ESM, sans dépendance), `encode()` chargé par `import()` dans `code-qr.ts` (chunk à part
  d'environ 10 ko), dessiné en SVG (un tracé, sans innerHTML), noir sur blanc avec 4 modules de marge, `role="img"`.
- Montants : `montantEnClair()` (Intl fr-CA) ; MRU par son code et sans décimales inutiles (« 40 MRU »). Historique
  des paiements : colonne « Moyen » (Carte / Mobile, `LIBELLES_FOURNISSEUR`) et montant avec le code de sa devise.
- Vitrine : sous chaque prix, « ou N MRU par paiement mobile » (`prixMobile`, jamais écrit dans le front) et mention
  des applications (`APPLICATIONS_MOBILES`) ; étapes et FAQ mentionnent les deux moyens.

## Espace admin (F4)
- Routes : `/admin` (tableau de bord), `/admin/gestionnaires[?page&taille]`, `/admin/gestionnaires/:id`,
  `/sondages[?statut&page&taille]` (admin et gestionnaire ; le backend filtre), `/sondages/nouveau` (F5),
  `/sondages/:id`. Pagination et filtres dans l'URL (retour arrière et rechargement conservés).
- Actions sur un gestionnaire centralisées dans `features/admin/gestionnaires/actions-gestionnaire.ts`
  (confirmation, appel, snackbar) ; boîte de confirmation commune `shared/components/dialogue-confirmation`
  (`confirmer(dialog, {...})`, focus sur « Annuler », bouton rouge si `destructive`).
- Assignation : porte sur la lignée. Depuis un sondage : un seul POST avec plusieurs `gestionnaireIds`. Depuis
  un gestionnaire : un POST par sondage, chaque échec affiché sans bloquer les autres.
- Lecture seule : `AuthService.lectureSeule()` (abonnement EXPIRE, hors super admin) désactive tout bouton
  d'écriture, avec l'infobulle `MESSAGE_LECTURE_SEULE`.
- Tableaux Material avec `[trackBy]` (sinon la ligne est recréée et le focus perdu) ; cartes sous 720 px.
- Paginateur français fourni par les routes chargées à la demande (`fournirPaginateurFrancais()`), pas dans
  `app.config.ts` : sinon le paginateur et le select de Material entrent dans le bundle initial (budget 500 ko).
- Tableau de bord : carte « En chiffres » (`GET /api/admin/tableau-de-bord`, `TableauDeBordService`) ; un sondage
  = une lignée, **brouillons compris dans « Non commencés »** (pas de compteur à part) ; chaque tuile mène à la
  liste filtrée (`/admin/gestionnaires?actif=`, `/sondages?statut=`). La carte Abonnement garde le signal partagé.
- Gestionnaires : `?recherche=` (prénom, nom ou courriel, sans majuscules ni accents ; envoyée 300 ms après la
  dernière frappe) et `?actif=true|false` dans l'URL, transmis tels quels au backend.
- Sondages : par défaut `derniereVersion=true` (une ligne par lignée : dernière version publiée EN_COURS ou TERMINE,
  sinon le brouillon) ; `?versions=toutes` pour chaque version. Colonne Réponses : `nombreReponsesLignee` (+ « dont
  N pour la vX ») en vue dernière version, `nombreReponses` sinon. Colonne Assignés (`gestionnairesAssignes`) pour
  l'admin seulement (null pour un gestionnaire). « Nouvelle version en préparation » -> `brouillonEnPreparationId`
  (une version planifiée plus récente n'est pas signalée par le backend).
- Boîtes d'assignation : gestionnaires lus avec `actif=true` ; sondages lus avec `derniereVersion=true`
  (l'assignation porte sur la lignée).

## Espace super admin (F3)
- Routes : `/super-admin` (tableau de bord), `/super-admin/admins[?recherche&statut&page&taille]`,
  `/super-admin/admins/:id`, `/super-admin/abonnements[?statut&page&taille]`,
  `/super-admin/demandes-abonnement[?statut&page&taille]` (détail et réponse dans `dialogue-demande`).
- Tableau de bord : `GET /api/super-admin/tableau-de-bord` (entreprises par statut affiché + total, demandes
  EN_ATTENTE) ; chaque tuile mène à `/super-admin/admins?statut=` ou `demandes-abonnement?statut=EN_ATTENTE`.
  Notifications : composant partagé `dernieres-notifications` (5 dernières, tous types), aussi chez l'admin.
- Deux formes d'admin : `AdminDetailResponse` (détail, `admin` = `UtilisateurResponse`) et `AdminLigneResponse`
  (liste : `entreprise`, `admin`, `abonnement` résumé, `nombreGestionnaires`). Les actions (`actions-admin.ts`)
  prennent un `CompteAdmin` (`compteDepuisDetail`, `compteDepuisLigne`). La liste se relit après chaque action
  (la ligne peut sortir du filtre).
- Désactiver : confirmation qui annonce le blocage des gestionnaires. Supprimer : confirmation forte
  (`saisieAttendue` = nom de l'entreprise, espaces ignorés, majuscules respectées).
- « Expire bientôt » (`expireBientot`) : EXPIRE_BIENTOT, ou ACTIF à 7 jours ou moins ; ligne `en-alerte` et
  mention « Expire dans N jours » (`echeance-abonnement`).
- Demande d'augmentation : sans effet sur l'abonnement ; décision explicite (aucune présélection), message
  obligatoire si REFUSEE (400 `REPONSE_OBLIGATOIRE` côté backend), facultatif si TRAITEE ; 409
  `DEMANDE_DEJA_TRAITEE` -> la liste est relue.
- Pastilles de filtre : un nouveau clic sur la pastille choisie la garde sélectionnée (sinon Material la désélectionne).

## Éditeur de sondage (F5a)
- Routes : `/sondages/nouveau` (vide ou à partir d'un formulaire, `GET /api/sondages/formulaires?modelesSeulement`)
  et `/sondages/:id/modifier` (garde `quitterEditeurGuard` si quelque chose n'est pas enregistré). La fiche
  `/sondages/:id` propose « Modifier » ou « Voir le contenu ».
- Droits (affichage) : `raisonLectureSeule()` (`features/sondages/droits-sondage.ts`) : brouillon, abonnement non
  expiré, admin ou gestionnaire créateur avec la permission ; sinon lecture seule avec un bandeau. Un refus du
  serveur (SONDAGE_PUBLIE, PERMISSION_SONDAGES_REQUISE, ACTION_RESERVEE_CREATEUR, ABONNEMENT_EXPIRE) verrouille l'éditeur.
- `EditeurSondageStore` (fourni par la page) : toutes les écritures passent par une file, l'une après l'autre (pas de
  verrouillage optimiste côté backend) ; chaque réponse remplace le sondage, les formulaires des cartes ne sont jamais
  recréés. Questions pas encore créées gardées à part (clé stable `nouvelle-N`).
- Enregistrement automatique (`EnregistrementAuto`) : 800 ms après la dernière frappe ou à la sortie du champ ; une
  saisie invalide n'est pas envoyée (erreurs affichées) ; erreur du serveur affichée sur la carte, avec « Réessayer ».
- Un composant par type dans `editeur/types/` ; formulaires, valeurs par défaut et conversion en `QuestionRequest`
  dans `formulaires-types.ts` ; règles du backend dans `core/utils/regles-question.ts`. `estCritere` n'est jamais envoyé.
- Glisser-déposer (CDK) des sections, et des questions dans leur section (PUT .../questions/ordre) ou vers une autre
  section (PUT .../questions/{id}/section { sectionId, position à partir de 1 }), brouillon seulement. Listes des
  sections reliées par id (`questions-section-{id}`, pas de cdkDropListGroup : la liste des sections serait reliée
  aussi). Seule une question enregistrée sans modification en attente change de section (`peutChangerDeSection` :
  sa carte est recréée dans la section d'arrivée). Au clavier : Monter/Descendre et « Déplacer vers une autre
  section » dans le menu de la question.
- Budget initial porté à 520 ko (avertissement), **provisoirement** : `MAT_FORM_FIELD_DEFAULT_OPTIONS` dans
  `app.config.ts` place `@angular/forms` et le champ Material (environ 128 ko) dans le bundle initial, qui grossit avec
  chaque usage des formulaires. **À optimiser avant la mise en ligne** (sortir ces paquets du bundle initial sans
  perdre l'apparence des champs dans les boîtes de dialogue), puis revenir à 500 ko.

## Cycle de vie d'un sondage (F5b)
- États affichés (`etatSondage`, `libelleEtatSondage`) : Brouillon (jamais publié), Planifié (publié, NON_COMMENCE),
  En cours, Terminé ; pastilles `sondage-BROUILLON|PLANIFIE|EN_COURS|TERMINE`.
- Routes : `/sondages/:id/apercu` (sélecteur ordinateur / téléphone) et `/sondages/:id/diffuser` (lien, copier, QR
  code en blob via HttpClient, PNG 300/600/1000 ; 409 SONDAGE_BROUILLON = jamais publié). La fiche a une barre
  d'actions ; l'éditeur a Prévisualiser / Publier, et « Créer une nouvelle version » dans le bandeau de lecture seule.
- `cycle-de-vie/actions-sondage.ts` : publier et modifier les dates (`dialogue-publication` : ouverture maintenant ou
  planifiée, fermeture facultative, « une réponse par appareil » enregistré par PUT du brouillon juste avant
  `POST .../publier` s'il a changé), fermer (confirmation : définitif), nouvelle version (BROUILLON_EXISTANT : la
  version en préparation s'ouvre), dupliquer (la copie s'ouvre dans l'éditeur), modèle.
- Droits (`droitsSondage`) : gérer (publier, fermer, dates, nouvelle version, modèle, critères) = admin ou gestionnaire
  créateur avec la permission ; dupliquer = admin ou gestionnaire avec la permission qui voit le sondage, même
  seulement assigné (comme le backend) ; prévisualiser et diffuser (si publié) = tous ceux qui le voient.
- Critères d'analyse (`editeur/critere-question`) : PUT .../critere, à part du contenu, donc réglables sondage publié ;
  NUMERIQUE : 5 tranches égales (exige min et max) ou bornes strictement croissantes (1 à 19) ; DATE : MOIS ou ANNEE.
- `shared/formulaire/` : `formulaire-sondage` (une section par page, « Suivant » vérifie la section, numérotation
  continue ; en aperçu rien n'est envoyé), `reponses.ts` (règles de ValidateurReponse, `reponsesAEnvoyer` au format
  ReponseQuestionRequest), un champ par type dans `champs/`. Mise en page selon la largeur du formulaire (container
  queries `@container formulaire`), pour que l'aperçu « téléphone » soit fidèle.
- Un composant qui affiche l'état d'un contrôle modifié par son parent (touché par « Suivant ») suit `controle.events`
  (`QuestionRepondant`) : sinon il n'est pas rafraîchi.
- Liste des versions de la fiche : statut et `nombreReponses` (réponses de cette version) pour chaque version publiée.

## Formulaire public (F6)
- `/s/:jeton` (`features/public/formulaire-public`) : sans compte, sans garde, hors de la mise en page connectée.
  `FormulairePublicService` envoie ses requêtes avec `SANS_AUTHENTIFICATION` (aucun jeton, pas de rafraîchissement ni
  de redirection, même connecté).
- Écrans : chargement, formulaire, confirmation (message et date ; « Nouvelle réponse » si `reponseUnique` = false),
  indisponible : non ouvert (403 SONDAGE_NON_OUVERT, message du serveur avec la date), fermé (410), déjà répondu
  (`dejaRepondu` du GET ou 409 à l'envoi), lien introuvable (404), trop de requêtes (429), serveur injoignable. À l'envoi, 429 et erreurs
  réseau gardent le formulaire et les réponses ; 400 REPONSES_INVALIDES pose chaque `erreurs[].message` sur sa
  question (section concernée affichée, focus) ; les erreurs sans question sont résumées en haut.
- Mémoire du navigateur (`memoire-repondant.ts`, via `stockage-local.ts`) : `batulo.repondant.{jeton}` (UUID v4, un
  par lignée, jamais partagé entre sondages, envoyé seulement si `reponseUnique`), `batulo.brouillon.{jeton}`
  (réponses par questionId et section, écrit 500 ms après la dernière saisie, repris avec un bandeau « Tout effacer »,
  questions inconnues ignorées, oublié après 30 jours, effacé après l'envoi), `batulo.repondu.{jeton}` (drapeau
  après un envoi à réponse unique, utilisé seulement en repli si le serveur est injoignable).
- « Déjà répondu » avant la saisie : le GET public envoie le jeton de l'appareil, s'il existe déjà (jamais créé pour
  demander), dans l'en-tête `X-Jeton-Repondant` (jamais dans l'URL) ; `dejaRepondu` (présent seulement si
  `reponseUnique`) fait foi : true -> écran « déjà répondu » et brouillon effacé ; sinon le drapeau local est oublié.
  Le 409 DEJA_REPONDU reste la règle à l'envoi.
- Le formulaire public reçoit des DTO publics (SectionPubliqueResponse, QuestionPubliqueResponse) sans réglages
  d'analyse ; côté front, `shared/formulaire/` travaille sur `SectionAffichee` / `QuestionAffichee` (sondage.model).
- Léger : `shared/formulaire/` est en éléments natifs, sans Angular Material ni drag-drop du CDK (classement par
  Monter / Descendre, déplacement annoncé). Styles des champs en une seule copie (`champs/champs-*.scss`, chargés par
  `FormulaireSondage` en `ViewEncapsulation.None`, limités à `app-formulaire-sondage`). Chunk à la demande de
  `/s/:jeton` : environ 56 ko bruts ; la page charge en plus le bundle initial commun (voir le budget de F5a).
- Accessibilité : choix en `fieldset`/`legend`, saisie avec `label for` ; aide et erreur reliées par
  `aria-describedby`, `aria-invalid` ; focus sur le titre de section, la première question à corriger ou le titre
  de l'écran d'état ; boutons natifs de 48 px.

## Réponses, statistiques et exports (F7)
- Fiche d'un sondage en trois onglets, une adresse chacun (`onglets-sondage`) : `/sondages/:id`,
  `/sondages/:id/reponses[?page&taille]` (détail d'une réponse en dialogue, libellés retrouvés depuis les codes avec
  le contenu du sondage : `formater-reponse.ts`), `/sondages/:id/statistiques[?lignee&du&au&granularite&critere]`.
- Filtres (`filtres-url.ts`) dans l'URL, appliqués partout (statistiques, textes, tableau croisé, exports, envoi) :
  `critere=cle:valeur` répété (OU dans une clé, ET entre clés), valeurs proposées par `GET .../statistiques/criteres`
  (qui dépend de la portée version / lignée).
- JSON du backend : les blocs et champs vides sont ABSENTS (JsonInclude NON_NULL) : tester avec `!= null`. Le
  tableau croisé a sa propre cellule (`CelluleCroisement` : `pourcentageLigne`, `pourcentageColonne`, `petitEffectif`).
- Graphiques maison en HTML/CSS (`statistiques/graphiques/`), sans bibliothèque : barres horizontales (choix, oui/non,
  rang moyen du classement) et colonnes (distribution d'un nombre ou d'une échelle, dates par jour ou mois). Une
  seule série, couleur primaire du thème, valeurs écrites en clair, résumé accessible et bouton « Voir le tableau ».
  Matrice en tableau (intensité de la même teinte), textes paginés. Petit effectif (moins de 5) signalé en texte.
- Exports (`ExportService`) : téléchargés par HttpClient (jeton), en Blob ; nom lu dans Content-Disposition
  (exposé par le CORS du backend), sinon nom neutre ; une erreur en Blob est relue en JSON (`erreurLisible`) pour
  afficher son message. CSV : LIBELLES ou CODES, VIRGULE (Excel) ou POINT (Python, R).
- « Envoyer les statistiques à l'admin » : gestionnaire, sondage publié et TERMINE (409 SONDAGE_NON_TERMINE affiché),
  commentaire facultatif (2000 car.) et filtres en cours.
- Admin : `/admin/statistiques-recues` (liste, « Nouveau » si pas encore ouvert) et `/admin/statistiques-recues/:id`
  (statistiques recalculées, rapport PDF). L'expéditeur et le commentaire viennent de la liste (état de navigation),
  sinon (rechargement, lien d'un message ou d'une notification) de `GET /api/envois-statistiques/{id}`.
- Onglet Réponses : « Version N / Toutes les versions » (`?lignee=true`, choix affiché s'il y a plusieurs versions) ;
  chaque réponse porte `sondageId` (sa version) et `version`. Le détail est lu avec le contenu de SA version (relu
  par GET /api/sondages/{sondageId} au besoin et gardé en mémoire), pour retrouver les libellés des options.
- Schémas OpenAPI distincts : `CelluleCroisement` (tableau croisé) et `AbonnementLigneAdmin` (ligne d'un admin).

## Messagerie et notifications (F8)
- Routes : `/messagerie` (liste + panneau vide) et `/messagerie/:id` (fil, route enfant : la liste reste à côté sur
  ordinateur ; sous 840 px, la liste ou le fil, avec « Retour aux conversations »),
  `/notifications[?lue=true|false&page&taille]`, `/admin/abonnement/demandes[?demande=]` (demandes d'augmentation de
  l'admin), `/gestionnaire/statistiques-envoyees[?page&taille]` et `/gestionnaire/statistiques-envoyees/:envoiId` (un
  envoi, « Voir ces statistiques » avec ses filtres), `/super-admin/demandes-abonnement?demande={id}` (détail relu par
  `GET .../demandes-abonnement/{id}`, ouvert dans `dialogue-demande`, paramètre retiré à la fermeture).
- Droits (le backend décide) : super admin <-> admins (boîte « Batulo » partagée) ; admin <-> ses gestionnaires et
  Batulo (interlocuteur `{ id: null, prenom: "Batulo", role: SUPER_ADMIN }`, `estConversationBatulo`) ; gestionnaire
  <-> son admin. « Nouvelle conversation » : `POST /conversations` ouvre ou retrouve ; admin : Batulo + ses
  gestionnaires, super admin : les admins (`dialogue-nouvelle-conversation`) ; gestionnaire : « Écrire à mon admin »,
  corps vide, sans dialogue.
- Interrogation périodique (`interrogationPeriodique`, pas de WebSocket), rien quand l'onglet est caché, battement
  immédiat au retour : fil 10 s (page 0 fusionnée par id), liste 30 s, compteurs 60 s (relus par la cloche, qui
  n'existe pas tant qu'une page est imposée). `EtatMessagerie` (fourni par la page) partage conversations et
  conversation active entre la liste et le fil.
- Fil : plus récents d'abord côté serveur, affichés du plus ancien au plus récent ; « Messages plus anciens » (page
  suivante, position de lecture gardée) ; `role="log"` ; marquée lue (`POST .../lu`) dès qu'un reçu non lu arrive ;
  Ctrl / Cmd + Entrée envoie (5000 car.).
- Lecture seule : abonnement expiré (`lectureSeule()`) ou 403 ABONNEMENT_EXPIRE -> la conversation admin ↔
  gestionnaire n'a plus de saisie ; la conversation Batulo et la demande d'augmentation restent possibles.
- Messages automatiques (`type` != TEXTE) : carte distincte « Message automatique · … » et lien (`liens-messages.ts`,
  `referenceId`) : STATISTIQUES -> `/admin/statistiques-recues/{id}` (admin) ou `/gestionnaire/statistiques-envoyees/{id}`
  (gestionnaire) ; DEMANDE_ABONNEMENT / REPONSE_DEMANDE -> `?demande={id}` sur « Mes demandes » (admin, mise en
  évidence et focus) ou sur la liste des demandes (super admin, détail ouvert).
- Compteurs partagés : `NotificationService.nombreNonLues` (cloche, page des notifications, menu) et
  `MessagerieService.nombreNonLus` (badge « Messagerie » du menu) ; marquer lu les diminue, la relecture les remet.
- Liens des notifications (`liens-notifications.ts`, page et cloche : un clic marque lue et ouvre) : élément précis par
  `referenceId` / `conversationId` (conversation, statistiques reçues, sondage assigné, demande), sinon la rubrique
  (anciennes notifications, désassignation, abonnements : pas de page par abonnement). Filtre `?lue=` : sous un
  filtre, « Tout marquer comme lu » relit la liste.
- Demandes d'augmentation (admin) : formule choisie explicitement + message (2000 car.) ; une seule EN_ATTENTE (le
  formulaire est alors remplacé par un rappel ; 409 DEMANDE_EN_COURS -> liste relue) ; rappel : acceptée, l'admin
  paie lui-même par carte (« Payer la formule … » -> `/admin/abonnement/souscrire?formule=`).

## Page d'accueil du sondage (en cours)
- Champs du sondage (`PageAccueil`, sondage.model) : `objetEnquete`, `texteConfidentialite`, `consentementRequis`,
  `texteConsentement` ; dans `SondageResponse`, `ApercuResponse`, `FormulairePublicResponse`, et dans le PUT du brouillon
  (`SondageRequest`, tout l'en-tête). Tout PUT du brouillon passe par `requeteSondage(sondage, modifs)` (dialogue de
  publication) ou par l'en-tête de l'éditeur : jamais un corps partiel, qui effacerait la page d'accueil.
- Éditeur : carte « Page d'accueil » sous l'en-tête, dans le même formulaire et le même enregistrement automatique ;
  texte de la case obligatoire si le consentement est exigé (erreur dans l'éditeur ; le backend renvoie aussi 400
  TEXTE_CONSENTEMENT_REQUIS, affiché sur la carte) ; lecture seule comme le reste.
- `shared/formulaire/accueil/accueil-sondage` (éléments natifs) : titre, description, objet, confidentialité, case de
  consentement ; « Commencer le questionnaire » désactivé tant qu'elle n'est pas cochée ; avec un brouillon, « Reprendre »
  ou « Recommencer à zéro » (efface le brouillon). Sautée si `accueilNecessaire()` est faux (ni objet, ni
  confidentialité, ni consentement ; la description seule ne suffit pas).
- Formulaire public : chargement -> accueil -> questionnaire -> confirmation. Le consentement n'est jamais gardé dans le
  brouillon : il est redonné à chaque visite (case à recocher pour reprendre) ; `consentement: true` dans le corps de
  l'envoi si exigé. Refus faute de consentement -> retour à l'accueil avec le message, réponses gardées. « Nouvelle
  réponse » (collecte terrain) -> accueil, case décochée.
- Aperçu : l'accueil d'abord, « Recommencer » y ramène (sortie `recommence` de FormulaireSondage).
- À vérifier dans l'OpenAPI quand le backend sera sur 8090 : emplacement exact des champs (dont `ApercuResponse`),
  longueurs maximales (`REGLES_SONDAGE.objetEnqueteMax`, `texteConfidentialiteMax`, `texteConsentementMax`,
  provisoires), code d'erreur du consentement manquant à l'envoi (`estRefusConsentement` accepte pour l'instant tout
  code contenant CONSENTEMENT), puis afficher la date du consentement dans le détail d'une réponse (champ de
  `ReponseResponse` à connaître).

## Questions conditionnelles (phase 4, étape 1)
- Contrat vérifié dans l'OpenAPI : `ConditionRequest|Response`, `RegleConditionRequest|Response`, enums ET|OU et
  opérateurs, champ `condition` de `QuestionResponse`, `SectionResponse` (aperçu compris), `QuestionPubliqueResponse`,
  `SectionPubliqueResponse`, `QuestionStat.vues` et `conditionnelle` ; routes PUT/DELETE `.../questions/{id}/condition`
  et `.../sections/{id}/condition`.
- Modèle (`sondage.model.ts`) : `ConditionAffichage { combinaison: ET|OU, regles: [{ questionId, operateur, valeur? }] }`
  (1 à 10 règles), `condition?` sur `QuestionResponse`, `SectionResponse` et `SectionAffichee` (absente : toujours
  affichée). `operateursPermis(type)` = `OperateurCondition.permis` : CHOIX_UNIQUE EGAL/DIFFERENT/PARMI ; CHOIX_MULTIPLE
  CONTIENT/PARMI ; OUI_NON EGAL/DIFFERENT ; NUMERIQUE, ECHELLE, DATE EGAL/DIFFERENT/SUPERIEUR/INFERIEUR/ENTRE ; tous
  REPONDUE/NON_REPONDUE (sans valeur). Valeur : `valeur` d'option (jamais le libellé), booléen, nombre, date ISO, liste
  (PARMI), [min, max] (ENTRE).
- **Un seul évaluateur côté front** : `shared/formulaire/conditions.ts` (`evaluerVisibilite`, copie fidèle
  d'`EvaluateurConditions`) : parcours dans l'ordre, source masquée = non répondue, section masquée = ses questions
  masquées, sans réponse seule NON_REPONDUE est vraie (DIFFERENT compris), SUPERIEUR / INFERIEUR stricts, ENTRE bornes
  comprises, types incomparables = faux, réponse vide = non répondue. Toute évolution du backend doit y être recopiée
  (tests dans `conditions.spec.ts`).
- Éditeur (`editeur/condition/`) : menu des cartes « Ajouter / Modifier la condition d'affichage » (question enregistrée ;
  section à partir de la deuxième) -> `dialogue-condition` (règles « Afficher si » [question] [condition] [valeur], ET /
  OU, valeur choisie dans les options pour un choix, champs nombre ou date, deux bornes pour ENTRE) -> PUT
  `.../questions/{id}/condition` ou `.../sections/{id}/condition` par la file du store ; « Retirer » -> DELETE. Sources
  (`sourcesPossibles`) : questions enregistrées placées avant (section : sections précédentes). Résumé lisible
  (`resume-condition`, icône `alt_route`, « Visible si : … = Oui ») ; en lecture seule, le résumé sans actions.
  400 CONDITION_INVALIDE / 409 : message du serveur dans la boîte ; 409 CONDITION_DEPENDANTE (suppression, déplacement)
  : « Action refusée » gardé sur la carte (`erreurAction`), pas un message passager.
- Formulaire (`formulaire-sondage`, aperçu et public) : visibilité recalculée à chaque saisie ; question masquée
  désactivée (ni obligatoire ni validée), réponse effacée (brouillon compris) et jamais envoyée ; section sans question
  visible sautée ; « Section N sur M », progression et numéros sur le visible ; apparition : classe `apparition`
  (`conditions.scss`, fondu de 200 ms, aucun si `prefers-reduced-motion`) ; annonce `aria-live="polite"` des questions
  apparues ou masquées dans la section affichée (`texteAnnonce`). Le serveur recalcule tout à l'envoi.
- Statistiques : pourcentages du backend (sur ceux qui ont répondu, qui ont forcément vu la question) ; question
  `conditionnelle` : « Question conditionnelle : vue par X répondants » (`vues`) + « sur Y » (`resume.nombreReponses`)
  pour une seule version seulement (`totalUneVersion`), en plus de « N répondants · M sans réponse ».

## Vitrine publique
- « / » : `features/vitrine` (chargée à la demande, `inviteGuard`) pour un visiteur ; un compte connecté est renvoyé
  par `inviteGuard` vers `urlAccueil()` (tableau de bord du rôle ou page imposée), comme sur `/connexion` et
  `/inscription`. Adresse inconnue (`**` -> `''`) : la vitrine pour un visiteur. Déconnexion et session expirée mènent
  toujours à `/connexion`.
- Éléments natifs, sans Angular Material (chunk d'environ 27 ko, bundle initial inchangé) ; icônes par la classe
  globale `.material-icons`. Découpée en `barre-vitrine` (collée en haut, menu hamburger sous 840 px : aria-expanded,
  Échap, clic ailleurs), `heros-vitrine` (illustration HTML/CSS décorative), `tarifs-vitrine` et la page (budget de
  4 ko de styles par composant).
- Textes dans `contenu-vitrine.ts` (fonctionnalités, étapes, FAQ, `COURRIEL_CONTACT` = contact@batulo.example à
  remplacer avant la mise en ligne) : ne décrire que ce que Batulo fait (pas de renouvellement automatique, envoi
  qui demande une connexion, etc.).
- Tarifs : jamais écrits dans le front, lus dans `GET /api/abonnements/formules` (route publique : prix par carte et
  `prixMobile` en MRU), formatés par `Intl.NumberFormat('fr-CA')` ; annuel mis en avant seulement s'il coûte moins que douze mois ; erreur -> « Réessayer ».
- Liens de section (`href="#id"`) gérés par la page : défilement (doux sauf `prefers-reduced-motion`), focus sur le
  titre, `scroll-margin-top` sous la barre ; un lien partagé `/#tarifs` y mène au chargement. Lien d'évitement
  « Aller au contenu ».

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

## À venir (backend)
- Exposer, pour chaque question des statistiques, le nombre de réponses aux versions qui contiennent la question
  (`reponsesAuxVersions` de `StatistiqueServiceImpl`, ou les réponses où elle était masquée) : le front pourra alors
  afficher « vue par X répondants sur Y » aussi en vue « toutes les versions ».

## Plan des étapes
- [x] **F1 – Socle et authentification** : structure, mise en page (barre du haut avec utilisateur et
  notifications, menu latéral par rôle), connexion, inscription admin, mot de passe oublié, réinitialisation,
  changement obligatoire du mot de passe temporaire, intercepteur (jeton, rafraîchissement, déconnexion),
  gardes par rôle et par statut, affichage des erreurs.
- [x] **F2 – Abonnement et Stripe** : formules, paiement Stripe Elements, confirmation, rafraîchissement du jeton,
  bandeau d'abonnement de l'admin, page « Mon abonnement » avec l'historique des paiements.
  Demande d'augmentation : faite en F8 (`/admin/abonnement/demandes`).
  Paiement mobile Moosyl (Bankily, Masrvi, Sedad…) ajouté ensuite : voir « Paiement mobile Moosyl ».
- [x] **F3 – Super admin** : tableau de bord (compteurs, demandes en attente, notifications), admins et entreprises
  (recherche, filtre, CRUD, activer/désactiver, suppression confirmée, mot de passe temporaire), abonnements
  (expirations proches en évidence), demandes d'abonnement (réponse TRAITEE ou REFUSEE).
- [x] **F4 – Espace admin** : gestionnaires (CRUD, activer/désactiver, permission, mot de passe temporaire,
  recherche et filtre actif, détail + ses sondages), assignations (depuis un sondage ou un gestionnaire), liste
  des sondages (dernière version par défaut, réponses, assignés, nouvelle version en préparation) et détail en
  lecture seule, tableau de bord (compteurs, abonnement, notifications), lecture seule si EXPIRE.
- [x] **F5 – Éditeur de sondage** : F5a (création, sections, questions des 10 types, glisser-déposer, enregistrement
  automatique, lecture seule) et F5b (aperçu, publication et dates, fermeture, nouvelle version, duplication,
  modèles, critères, lien et QR), déplacement d'une question vers une autre section, réponses par version.
- [x] **F6 – Formulaire public** (mobile d'abord) : `/s/:jeton`, hors mise en page connectée, sections, brouillon
  local, confirmation et collecte terrain, écrans d'état, erreurs du serveur par question, sans Angular Material.
- [x] **F7 – Statistiques et exports** : réponses (version ou toute la lignée) et leur détail, statistiques par type,
  filtres et critères, tableau croisé, exports CSV/XLSX/PDF, envoi à l'admin, statistiques reçues.
- [x] **F8 – Messagerie et notifications** : conversations, fil, nouvelle conversation, messages automatiques et leurs
  liens, demandes d'augmentation de l'admin, statistiques envoyées du gestionnaire (liste et détail), page des
  notifications (filtre lues / non lues, liens précis), compteurs partagés, détail d'une demande côté super admin.
- [x] **Phase 4, étape 1 – Questions conditionnelles** : conditions d'affichage dans l'éditeur (questions et sections),
  évaluation en direct dans l'aperçu et le formulaire public, « vue par » dans les statistiques (voir la section dédiée).

Toutes les rubriques du menu (`layout/menu-lateral/liens-navigation.ts`) mènent à leur page ; `PageAVenir` reste
disponible pour une future rubrique.
