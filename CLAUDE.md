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

## Tester depuis un téléphone (même Wi-Fi)
- `npm run start:reseau` (= `ng serve --configuration reseau-local --host 0.0.0.0 --port 4200 --proxy-config
  proxy.conf.json`), puis sur le téléphone `http://<IP du Mac>:4200` (IP : `ipconfig getifaddr en0`). Le backend tourne
  comme d'habitude sur 8090 ; `npm start` et `environment.ts` ne changent pas.
- Configuration `reseau-local` d'angular.json (build et serve) : remplace `environment.ts` par
  `environment.reseau-local.ts` (`apiUrl: ''`) : les appels partent en relatif (`/api/...`) vers le serveur de
  développement, que `proxy.conf.json` transmet à `http://localhost:8090`. Le proxy remplace l'en-tête `Origin` par
  `http://localhost:4200` : le CORS du backend (`CORS_ORIGINS`) n'accepte que cette origine.
- apiUrl vide prise en charge : l'intercepteur prend l'origine de la page comme origine de l'API (`origineApi`, le jeton
  ne part qu'à elle) ; le logo devient le chemin relatif `/api/public/logos/{jeton}` (`urlLogoSure`), servi par le
  proxy. Le pare-feu macOS doit autoriser node à recevoir des connexions.
- Liens produits par le backend (courriels, QR des sondages, retour Moosyl) : ils gardent ses propres réglages
  (`localhost:4200`), donc ne s'ouvrent pas tels quels sur le téléphone ; y remplacer `localhost` par l'IP du Mac.

## Règles techniques
- Dernière version stable d'Angular (22.x), composants **standalone**, **signals** (`signal`, `computed`,
  `input`, `output`), contrôle de flux `@if/@for/@switch`, **Reactive Forms** (`NonNullableFormBuilder`),
  **Angular Material** (Material 3, thème dans `src/styles.scss`, champs `outline` + `subscriptSizing: 'dynamic'`).
- Interface en **trois langues** (français, anglais, arabe) : **aucun texte en dur**, tout passe par une clé de
  `public/i18n/` (voir « Langues de l'interface »). Le français reste la langue de référence (apostrophe typographique ’,
  format `fr-CA`) ; dates, nombres et montants suivent la langue courante (pipes `dateL`, `nombreL`, `montantL`).
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
                   formulaire-public, statistiques, messagerie, personnalisation, traduction, invitation)
    services/      un service par domaine (auth = session en signals, inscription, mot-de-passe, notification,
                   abonnement, stripe = chargement de Stripe.js, gestionnaire, sondage, assignation, tableau-de-bord,
                   super-admin, demande-abonnement, formulaire-public, statistiques, export, messagerie, personnalisation,
                   traduction = langues et traductions du contenu d'un sondage, invitation = invitations nominatives)
    interceptors/  auth.interceptor.ts + contexte-http.ts (SANS_AUTHENTIFICATION)
    guards/        auth.guards.ts (authGuard, roleGuard, connecteGuard, inviteGuard)
    i18n/          langues.ts (fr, en, ar, dir, locales), langue.service.ts (choix, RTL), traduire.ts (traduire, pluriels,
                   libelles), formats.pipes.ts (dateL, nombreL, montantL, pourcentL, pluriel), chargeur-traductions.ts,
                   titre-traduit.ts (titres de page), fournir-i18n.ts
    utils/         couleur.ts (#RRGGBB, contraste WCAG), erreur-http.ts (messages d'erreur), validateurs.ts (règles du backend), pagination-url.ts
                   (?page&taille), recherche.ts (DELAI_RECHERCHE_MS), stockage-local.ts (localStorage en try/catch),
                   interrogation.ts (interrogation périodique arrêtée onglet caché), montant.ts (montants selon la langue,
                   MRU sans décimales), redirection.ts (?retour= : chemins internes seulement), achat-sondages.ts
                   (total, bornes, validateur, solde à afficher)
  layout/          mise-en-page (sidenav + contenu), barre-haut, bandeau-abonnement, menu-lateral (+ liens-navigation.ts),
                   cloche-notifications
  features/        auth/, super-admin/, admin/, gestionnaire/, erreurs/ (un *.routes.ts par espace de rôle),
                   public/ (formulaire du répondant, sans compte), vitrine/ (site public sur « / »),
                   apparence/ (personnalisation de l'entreprise)
  shared/components/ encadre, message-erreur, entete-page, page-a-venir, accueil-provisoire, dialogue-confirmation,
                   filtre-statut-abonnement, echeance-abonnement, dernieres-notifications, selecteur-langue,
                   quantite-sondages (nombre de sondages à acheter et total en direct)
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
- Sondages achetés : la session garde aussi `credits` (`CreditsResponse`, de `GET /api/auth/moi` et des paiements),
  gardé au rafraîchissement du jeton (même compte). `compteCredits` : `EN_ATTENTE_PAIEMENT` n'impose plus de page et
  `EXPIRE` n'est plus en lecture seule (voir « Achat de sondages à l'unité »).

## Abonnement et paiement Stripe (F2)
- Pages : `/admin/abonnement` (Mon abonnement ; redirige vers `souscrire` si EN_ATTENTE_PAIEMENT) et
  `/admin/abonnement/souscrire?formule=MENSUEL|ANNUEL` (choix -> paiement -> succès). Pas de bouton d'annulation.
- Parcours : `POST /paiement/intention { formule }` -> `StripeService.charger(clePublique)` (`@stripe/stripe-js/pure`,
  locale de l'interface (`localeStripe()` : fr-CA, en, ar), Stripe.js chargé seulement à ce moment) -> champs `cardNumber`, `cardExpiry`, `cardCvc` ->
  `stripe.confirmCardPayment(clientSecret)` -> si `succeeded` : `POST /paiement/confirmer { paymentIntentId }`
  -> `auth.rafraichir()` (le statut est dans le jeton ; échec = `terminerSession`) -> « Vous êtes bien abonné »
  -> `/admin` après 4 s.
- Les données de carte restent dans les iframes Stripe ; ne jamais journaliser `clientSecret`.
- Paiement accepté par Stripe mais non confirmé par Batulo (réseau, `PAIEMENT_NON_REUSSI`) : ne jamais reproposer
  la carte (double paiement) ; seulement « Vérifier à nouveau » (`/confirmer` est idempotent).
- Erreurs Stripe traduites dans `core/utils/stripe-erreurs.ts` (`decline_code`, puis `code`, puis message
  localisé pour les erreurs de saisie ; toujours dans la langue de l’interface, clés `stripe.*`).
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
- Montants : `montantEnClair()` (Intl, langue courante) ; MRU par son code et sans décimales inutiles (« 40 MRU »). Historique
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
- Budget initial : 500 ko (avertissement). `@angular/forms` et le champ Material ne sont plus dans le bundle initial :
  pas de `MAT_FORM_FIELD_DEFAULT_OPTIONS` dans `app.config.ts`, chaque `<mat-form-field>` porte
  `appearance="outline" subscriptSizing="dynamic"` (à reprendre sur tout nouveau champ). Bundle initial : environ 375 ko.

## Cycle de vie d'un sondage (F5b)
- États affichés (`etatSondage`, `libelleEtatSondage`) : Brouillon (jamais publié), Planifié (publié, NON_COMMENCE),
  En cours, Terminé ; pastilles `sondage-BROUILLON|PLANIFIE|EN_COURS|TERMINE`.
- Routes : `/sondages/:id/apercu` (sélecteur ordinateur / téléphone) et `/sondages/:id/diffuser` (lien, copier, QR
  code en blob via HttpClient, PNG 300/600/1000 ; 409 SONDAGE_BROUILLON = jamais publié). La fiche a une barre
  d'actions ; l'éditeur a Prévisualiser / Publier, et « Créer une nouvelle version » dans le bandeau de lecture seule.
- Partage (`diffuser-sondage/partage-message`, carte « Partager par WhatsApp ou SMS ») : message prérempli et modifiable
  (« Bonjour, merci de répondre à notre enquête « titre » : lien », titre lu par GET /api/sondages/{id}, sans titre si
  la lecture échoue ; un message modifié n'est jamais écrasé), liens `https://wa.me/?text=…` (nouvel onglet,
  `rel="noopener noreferrer"`) et `sms:?&body=…` (iPhone et Android), texte encodé par `encodeURIComponent`
  (`partage.ts`) ; message vide : liens désactivés. Absent sans lien (brouillon, 409 SONDAGE_BROUILLON) ; sondage TERMINE :
  « Ce sondage est terminé : le lien affiche qu'il est fermé » ; gardé pour un sondage planifié. Sans service payant.
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
- Éditeur (`editeur/condition/`) : bouton « Ajouter une condition » bien visible en bas de la carte d'une question
  (`.pied`) et sous l'en-tête d'une section, sur un brouillon modifiable, sans condition, et seulement s'il existe une
  question enregistrée placée avant (`peutAjouterCondition`, d'après `sourcesPossibles`) : jamais sur la toute première
  question ni sur un sondage publié ; aussi dans le menu ⋮ (« Modifier » quand elle existe). -> `dialogue-condition` (règles « Afficher si » [question] [condition] [valeur], ET /
  OU, valeur choisie dans les options pour un choix, champs nombre ou date, deux bornes pour ENTRE) -> PUT
  `.../questions/{id}/condition` ou `.../sections/{id}/condition` par la file du store ; « Retirer » -> DELETE. Sources
  (`sourcesPossibles`) : questions enregistrées placées avant (section : sections précédentes). Résumé lisible
  (`resume-condition`, icône `alt_route`, « Visible si : … = Oui ») ; en lecture seule, le résumé sans actions.
  Rien n'est enregistré sans « Enregistrer la condition » (bouton plein avec icône, toujours visible dans la barre du
  bas, pleine largeur sur téléphone) ; règles modifiées : « Pas encore enregistrée » (role=status), et Annuler, Échap
  ou un clic à côté demandent « Fermer sans enregistrer ? » (`disableClose`, `fermer()`).
  La boîte ne se ferme qu'après une réponse qui contient bien la condition de la cible (`conditionDeLaCible`) ; sinon,
  comme pour un refus, une erreur réseau, une règle incomplète ou 20 s sans réponse, l'erreur s'affiche dans la barre
  du bas, au-dessus du bouton (role=alert, focus), avec le statut HTTP, le code et l'URL appelée pour la signaler.
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

## Personnalisation de l'entreprise (phase 4, étape 2)
- Contrat lu dans les records Java du backend (`PersonnalisationResponse`, `LogoInfoResponse`, `PersonnalisationRequest`,
  `ApparenceResponse`, `apparence` du formulaire public et de l'aperçu, `personnalisation` de `AdminDetailResponse`) :
  **à revérifier dans l'OpenAPI** quand l'instance 8090 aura été relancée (elle ne les avait pas).
- Modèle `personnalisation.model.ts`, service `PersonnalisationService` : `GET /api/entreprise/personnalisation` (admin et
  gestionnaires) ; admin : `PUT /api/admin/personnalisation { nomAffiche?, couleurPrincipale? }` (absent : inchangé ;
  "" : valeur par défaut ; 400 COULEUR_INVALIDE), `PUT .../logo` (multipart, champ `fichier`), `DELETE .../logo`.
- `/apparence` (`features/apparence`, admin et gestionnaire, lien « Apparence » du menu) :
  - logo (`zone-logo`) : glisser-déposer ou « Choisir un fichier », vérifié avant envoi (`validation-logo.ts` : PNG ou
    JPEG reconnu aux premiers octets comme le backend, 1 Mo), aperçu local (URL `blob:`, libérée ensuite), « Enregistrer
    ce logo » ; erreurs du serveur (LOGO_FORMAT_INVALIDE, LOGO_DIMENSIONS, LOGO_ILLISIBLE / JPEG CMYK, 413
    FICHIER_TROP_GROS) affichées ; « Remplacer », « Supprimer » après confirmation ;
  - couleur : `<input type="color">` et champ hexadécimal synchronisés (« 1e6b52 » -> « #1E6B52 » à la sortie du champ),
    vide = couleur Batulo, « Couleur par défaut » envoie "" ; nom affiché facultatif (150 car.) ; un bouton
    « Enregistrer » ;
  - aperçu en direct (`apercu-apparence`) : bandeau, bord du titre, progression, choix sélectionné, bouton ; couleur de
    texte du backend pour la couleur enregistrée, sinon le même calcul de contraste (`core/utils/couleur.ts`, copie de
    ContrasteCouleur) ;
  - lecture seule : gestionnaire, et admin dont l'abonnement a expiré (valeurs et aperçu, aucun bouton ni champ).
- Formulaire public et aperçu : `--bt-marque` / `--bt-sur-marque` (définies sur `html` à partir du primaire Batulo dans
  `styles.scss`) remplacées sur le conteneur (`main.page-publique`, `.cadre` de l'aperçu) par `variablesApparence()`
  (`shared/formulaire/apparence/apparence.ts`) seulement si la couleur est #RRGGBB et diffère de #005CBB : sinon le
  thème garde son bleu, sombre compris. Elles ne servent qu'aux surfaces pleines (boutons principaux, progression, choix
  sélectionnés, case et bouton de l'accueil, bords décoratifs) ; textes, liens et contours de focus gardent le thème
  (une couleur claire ne rend aucun texte illisible). Vitrine et espaces connectés : inchangés.
- Bandeau (`bandeau-apparence`) seulement s'il y a un logo : image (texte alternatif = nom affiché, 56 px de haut au
  plus, 60 % de la largeur sur téléphone) et nom (caché aux lecteurs d'écran, déjà dans le texte alternatif). Logo
  affiché seulement en http(s) (ou `blob:` pour l'aperçu local) : `urlLogoSure()`. Aucun innerHTML.
- Fiche super admin (`detail-admin`) : nom affiché, couleur (pastille) et logo dans la carte « Entreprise », lecture seule.
- URL du logo : le backend la renvoie absolue, construite avec son `APP_BASE_URL`, qui peut désigner le front
  (`http://localhost:4200/api/public/logos/…` : index.html, image cassée). `urlLogoSure()` (seul passage de toute URL de
  logo : page Apparence, aperçu, formulaire public, fiche super admin) ignore donc l'hôte reçu, garde seulement le chemin
  `/api/public/logos/{jeton}` (lettres, chiffres, tirets ; ni requête, ni fragment, ni autre chemin) et le préfixe par
  `environment.apiUrl` : `http://localhost:8090` avec `npm start`, vide (proxy `/api`) avec `start:reseau`, l'API en
  production. Seule exception : l'aperçu local (`blob:` de la page). Image illisible : message dans la page Apparence,
  bandeau retiré du formulaire (pas d'icône cassée).
- Couleur : PUT avec seulement les champs modifiés (rien si rien n'a changé) ; aucune couleur enregistrée = champ vide et
  sélecteur natif sur #005cbb, réécrit après chaque rendu (sinon il retombe sur #000000) ; ouvrir et fermer le sélecteur
  sans choisir n'impose aucune couleur.

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
  `prixMobile` en MRU), formatés par `Intl.NumberFormat(localeIntl())` ; annuel mis en avant seulement s'il coûte moins que douze mois ; erreur -> « Réessayer ».
- Liens de section (`href="#id"`) gérés par la page : défilement (doux sauf `prefers-reduced-motion`), focus sur le
  titre, `scroll-margin-top` sous la barre ; un lien partagé `/#tarifs` y mène au chargement. Lien d'évitement
  « Aller au contenu ».


## Langues de l'interface (phase 4, étape 3, partie 1)
- **Transloco** (`@jsverse/transloco`, seule bibliothèque ajoutée) : changement de langue à l'exécution, sans
  rechargement. Langues dans `core/i18n/langues.ts` : `fr` (fr-CA), `en` (en-CA), `ar` (RTL, Intl `ar-u-nu-latn` :
  **chiffres occidentaux** 1 234). Le contenu saisi par les admins (titres, questions, options) a ses propres langues
  (voir « Langues du contenu des sondages ») ; il s'affiche avec `dir="auto"` pour qu'un texte français reste lisible
  dans une page arabe.
- Fichiers (hors bundle, servis depuis `public/`, chargés à la demande) : `public/i18n/{fr,en,ar}.json` (application) et
  `public/i18n/public/{fr,en,ar}.json` (clés `public.*` seulement : formulaire du répondant, sélecteur de langue, messages
  d'erreur communs, codes d'erreur vus par le répondant). `/s/:jeton` ne charge que le petit fichier ; le reste de
  l'application charge les deux, fusionnés ; en quittant `/s/`, le fichier principal est ajouté (`LangueService`).
- Choix : `LangueService` (`core/i18n/langue.service.ts`) : `localStorage` `batulo.langue` (via `stockage-local.ts`),
  sinon la langue du navigateur si fr, en ou ar (`fr-CA`, `en-US`, `ar-MR` compris), sinon le français. Appliquée avant
  le premier affichage (`provideAppInitializer`). Au changement : textes, données de format d'Angular (en-CA et ar
  chargées par `import()`, fr-CA dans le bundle), `lang` et `dir` sur `<html>`, `Directionality` du CDK (Material :
  menus, dialogues, sidenav, champs).
- Sélecteur `shared/components/selecteur-langue` (élément `<select>` natif, sans Material : utilisable dans la vitrine et
  le formulaire public) : barre du haut (classe `compact-telephone` : bouton rond de 44 px sous 600 px), barre de la
  vitrine, pages d'authentification (`.haut-auth`), formulaire public (`.barre-langue`). Noms dans leur langue
  (Français, English, العربية, `lang` sur chaque option).
- **RTL** : propriétés CSS **logiques** obligatoires (`margin-inline-start`, `padding-inline-end`,
  `border-inline-start`, `inset-inline-start`, `text-align: start|end` ; jamais left/right) ; ombres internes de côté :
  variante `:host-context([dir='rtl'])`. Icônes directionnelles en miroir par `styles.scss` (`arrow_back`,
  `arrow_forward`, `chevron_*`, `send`, `logout`, `open_in_new`, `drive_file_move`, `alt_route`) ; flèches texte (← →)
  dans `<span class="fleche">`. Ajouter à cette liste toute nouvelle icône qui indique un sens.
- Dans les gabarits : `{{ 'cle' | transloco }}`, avec paramètres `{{ 'cle' | transloco: { nom: x } }}` (texte
  `{{nom}}`), attributs `[attr.aria-label]="'cle' | transloco"`, `[titre]="'cle' | transloco"` ; pluriels
  `{{ 'cle' | pluriel: n }}` (nombre formaté passé sous `n`). Importer `TranslocoPipe` (et `PlurielPipe`).
- Dans le TypeScript (snackbars, confirmations, messages calculés) : `traduire('cle', params)`,
  `traduirePluriel('cle', n)`, `traduireSiConnu` (null si absente) ; lus dans un `computed()` ou un gabarit, ils suivent
  la langue (signal). Libellés de codes (rôles, statuts…) : `libelles('prefixe', codes)` (objet à accesseurs, même usage
  qu'un `Record`). Constantes de messages : des fonctions (`messageLectureSeule()`), jamais une chaîne figée au
  chargement. Messages laissés pour la page de connexion (`terminerSession`, `preparerMessageConnexion`) : des clés.
- Pluriels : groupe `cle.one` / `cle.other` en fr et en ; en arabe `zero`, `one`, `two`, `few`, `many`, `other`
  (Intl.PluralRules ; `other` obligatoire, repli).
- Formats : pipes `dateL` (formats nommés `long`, `court`, `longHeure`, `courtHeure`, `jourHeure`, `heure`, ou formats
  d'Angular), `nombreL`, `montantL`, `pourcentL` ; hors gabarit `dateEnClair()`, `formaterNombre()`, `montantEnClair()`,
  `localeIntl()`. Ne jamais écrire `'fr-CA'` ni utiliser les pipes `date`/`number`/`currency` d'Angular (figés sur
  `LOCALE_ID`).
- Erreurs du backend : `messageApi(code, message)` (`erreur-http.ts`, utilisé par `messageErreur`) : en français le
  message du serveur (plus précis : dates, noms) ; dans les autres langues la traduction du code (`erreursApi.CODE`, ou
  `public.erreursApi.CODE` pour les codes vus par le répondant), sinon le message du serveur en secours. Messages de
  succès fixes du serveur : `texteServeur(cle, recu)`.
- Titres de page : `title` des routes = clé (`titres.*`, `public.titres.*`), traduite par `TitreTraduit`
  (`TitleStrategy`) et réappliquée au changement de langue ; une page peut imposer le sien (`personnaliser(() => …)`).
- Tests : `src/test-providers.ts` charge les vraies traductions (françaises par défaut, aussi hors TestBed) ;
  `traductions.spec.ts` vérifie les mêmes clés et les mêmes paramètres dans les trois langues, le placement des clés
  `public.*` et l'apostrophe typographique ; `langue.service.spec.ts` (RTL, mémorisation), `selecteur-langue.spec.ts`,
  `formats.spec.ts` (dates, nombres, montants, pluriels, erreurs par code), `titre-traduit.spec.ts`.

### Ajouter un texte
1. Choisir une clé par domaine (`auth.*`, `sondages.*`, `editeur.*`, `statistiques.*`…, `commun.*` pour les textes
   partagés) ; `public.*` si le texte peut apparaître sur `/s/:jeton` ou dans `shared/formulaire/`.
2. L'ajouter **dans les trois fichiers** de la même paire (`public/i18n/*.json` ou `public/i18n/public/*.json`), au même
   endroit de l'arbre, avec les mêmes `{{paramètres}}` ; pluriel : `one` et `other` (fr, en) et les formes arabes utiles.
3. L'utiliser par le pipe `transloco` / `pluriel` ou `traduire()` ; jamais de texte en dur.
4. `npx ng test --watch=false` : `traductions.spec.ts` échoue si une langue manque.

### Ajouter une langue
1. `core/i18n/langues.ts` : `Langue`, entrée de `LANGUES` (code, nom dans la langue, `dir`, `localeAngular`,
   `localeIntl`).
2. `langue.service.ts` : données de format d'Angular dans `DONNEES_LOCALES` (`import('@angular/common/locales/xx')`) ;
   `src/test-providers.ts` : `registerLocaleData` et `TRADUCTIONS`.
3. Créer `public/i18n/xx.json` et `public/i18n/public/xx.json` (copie du français, traduite) ; ajouter le fichier dans
   `FICHIERS` de `traductions.spec.ts`, et dans `FORMATS_DATE` (`formats.pipes.ts`) ses motifs de dates.
4. Stripe : vérifier que la langue est acceptée par `localeStripe()` (`stripe.service.ts`).
5. Contenu des sondages : `LANGUES_CONTENU` (`traduction.model.ts`) et clé `langues.xx` ; seulement si le backend
   accepte la langue (énumération `Langue`).

## Langues du contenu des sondages (phase 4, étape 3, partie 3)
- Contrat vérifié dans l'OpenAPI (jar du backend lancé sur 8092) : `LanguesRequest`, `CompletudeLangueResponse`
  (`TexteNonTraduit`), `TraductionsLangueResponse` (`TexteTraduction`), `TraductionsRequest`, `LibellesMatriceResponse`,
  `SoumissionRequest.langue`, `ReponseResponse.langue`, `StatistiquesResponse.langue|languesReponse|repartitionLangues`,
  `Matrice.libellesColonnes`, `LigneMatrice.libelle`, `EnvoiStatistiqueRequest.langueReponse`, `?langue=` et
  `?langueReponse=` des routes ; langues en énumération `fr|en|ar`. Les corps d'erreur ne sont pas documentés dans
  l'OpenAPI : `ErrorResponse.manquants` ({langue, cle, source}) vient du code (`TexteManquant`). Modèle `core/models/traduction.model.ts`
  (`LangueContenu` = `Langue` de l'interface, `LIBELLES_LANGUE` clés `langues.*`, `languesDuSondage()` : principale
  d'abord), service `TraductionService`.
- Sondage : `languePrincipale` (fr par défaut) et `languesSupplementaires` (sans la principale, 2 au plus : avec trois
  langues, ce sont au plus les deux autres). Éditeur : carte « Langues du sondage » (`editeur/langues/carte-langues`, sous
  la page d'accueil) : liste de la principale, cases des supplémentaires, enregistrées tout de suite par la file du store
  (`definirLangues`, PUT .../langues ; la nouvelle principale sort des supplémentaires) ; complétude de chaque langue
  (GET .../traductions, relue 600 ms après chaque écriture : un texte principal modifié perd ses traductions) et lien
  « Traduire » ; lecture seule comme le reste (résumé + « Voir les traductions »).
- Écran `/sondages/:id/traductions/:langue[?manquants=true]` (`features/sondages/traductions`, garde
  `quitterEditeurGuard`, beforeunload) : textes de GET .../traductions/{langue} dans l'ordre du formulaire, regroupés par
  `grouperTraductions` (sondage, section, question avec ses options, lignes et colonnes) ; texte principal à gauche
  (`lang` et `dir` de la principale), champ à droite (`lang` et `dir` de la langue, `rtl` en arabe, `maxlength` =
  `longueurMax`, zone de plusieurs lignes pour les textes longs) ; une colonne sous 840 px. Barre collée en haut :
  « X / Y traduits » en direct, filtre « Seulement les textes manquants » (clés manquantes figées quand on le coche : un
  texte reste visible pendant qu'on le remplit), « Enregistrer les traductions ». PUT en une fois des **seuls textes
  modifiés** (vide -> null = effacé), réponse qui remplace l'écran, message de succès (role=status) ; erreurs
  (TRADUCTION_INVALIDE, LANGUE_INVALIDE, SONDAGE_PUBLIE) par `app-message-erreur`, saisies gardées. Lecture seule hors
  brouillon modifiable (`raisonLectureSeule`).
- Publication : 400 TRADUCTIONS_INCOMPLETES -> `cycle-de-vie/textes-manquants` dans le dialogue de publication (à la
  place du message générique) : `manquants` groupés par langue (`manquantsParLangue`), 8 textes montrés puis « et N
  autres », bouton « Compléter les traductions » -> `/sondages/:id/traductions/:langue?manquants=true` (ferme le dialogue).
- Formulaire public : **un seul sélecteur** quand le sondage a plusieurs `languesDisponibles` : `app-selecteur-langue
  [disponibles] [memoriser]="false"` ne montre que ses langues et change à la fois l'interface et le contenu, pour la
  visite seulement (`LangueService.utiliser`, sans toucher `batulo.langue`). Le GET demande `?langue=` = langue de
  l'interface ; si le serveur sert une autre langue (non proposée), l'interface s'y aligne (`alignerInterface`). Sondage en
  une seule langue : sélecteur habituel (trois langues, mémorisé), contenu inchangé. Changement de langue (`suivreLangue`,
  effet sur `LangueService.langue()`) : contenu relu, même écran, réponses, section, brouillon et case de consentement
  gardés ; échec : message `public.langueContenu.erreur` et interface ramenée à la langue affichée. Envoi : `langue` = la
  langue servie.
- `FormulaireSondage` ne reconstruit pas ses contrôles si la **structure** est la même (`structureFormulaire` : ids,
  types, obligatoire, configuration, valeurs d'options, conditions) : seuls les textes changent. `ContenuFormulaire.langue`
  et `ContenuAccueil.langue` posent `lang` et `dir` (rtl en arabe) sur le formulaire et la page d'accueil. Matrice :
  libellés de `libellesMatrice` au même rang, valeurs envoyées = `configuration.lignes/colonnes` (langue principale).
- Aperçu : sélecteur « Langue du contenu » à part (mat-select, visible si plusieurs langues) : la langue de l'interface de
  l'admin ne change pas ; premier chargement dans la langue de l'interface si proposée ; réponses gardées au changement.
  Les textes fixes du formulaire (Suivant, Envoyer…) y restent dans la langue de l'interface.
- Statistiques : `FiltresStatistiques.langue` (libellés, absente = principale, la choisir la retire de l'URL) et
  `languesReponse` (OU), dans l'URL `?langue=&langueReponse=` (répété ; codes inconnus ignorés), transmis par
  `parametresFiltres` à statistiques, textes, croisement et exports ; critères relus avec `langue` ; envoi à l'admin :
  `langueReponse`. Choix montrés seulement pour un sondage en plusieurs langues ; pastille retirable par langue de réponse ;
  « Tout effacer » garde la langue des libellés. Résumé : tuile « Réponses par langue » (`repartitionLangues`) ; matrice :
  `libellesColonnes` et `LigneMatrice.libelle`. Réponses : colonne « Langue » (`reponse.langue`, fr si absente) et ligne
  dans le détail. La liste des réponses n'a pas de filtre par langue côté backend.

## Invitations nominatives (phase 4, étape 4)
- Contrat : `invitation.model.ts` (copie des records du backend, voir la section « Invitations nominatives » de son
  CLAUDE.md), service `InvitationService` (`/api/sondages/{id}/invitations/**`, {id} = n'importe quelle version : la
  liste est celle de la lignée). Le lien personnel n'est jamais renvoyé ni affiché par le front.
- Onglet « Invitations » (`features/sondages/invitations/page-invitations`, `/sondages/:id/invitations[?statut&recherche
  &page&taille]`, 4e onglet de `onglets-sondage`) : compteurs (`/resume`) et taux de réponse (`<progress>`, « sur N
  invitations envoyées ») ; tableau Material (cartes sous 720 px) : nom, courriel, langue, statut en pastille, envoi,
  relance, réponse ; recherche (300 ms) et pastilles de statut dans l'URL ; sélection multiple gardée d'une page et d'un
  filtre à l'autre (par id). Ajout et modification (`dialogue-invite` : courriel obligatoire, 409 INVITE_EXISTANT dans la
  boîte), suppression et révocation (définitive) après confirmation `destructive` ; interdites si A_REPONDU (révoqué :
  plus modifiable). Export du suivi (CSV, nom du serveur).
- Import CSV (`dialogue-import`) : modèle téléchargeable (`modele-csv.ts` : BOM UTF-8, « ; », en-têtes
  prenom;nom;courriel;telephone;langue), zone de dépôt ou « Choisir un fichier » (.csv vérifié avant envoi), rapport
  (`rapport-import` : acceptées, refusées avec ligne, courriel et raison traduite `invitations.refus.*`, sinon message du
  serveur), « Importer un autre fichier » ; la page relit toujours la liste à la fermeture.
- Reprise (`dialogue-reprise`) : sources = `GET /api/sondages?derniereVersion=true` (toutes les pages, 10 au plus), sauf
  ce sondage et ses versions ; POST `.../reprendre { sondageSourceId }` ; rapport : « N personnes ajoutées », doublons
  (DEJA_INVITE) comptés à part comme ignorés, autres refus listés.
- Envoi et relance (`regles-envoi.ts`, affichage seulement : le serveur décide) : boutons désactivés, raison écrite sous les boutons
  (`aria-describedby`) : lecture seule, jamais publié, terminé, limite horaire après un 429 LIMITE_ENVOIS bloquée une
  heure pour la visite, rien à envoyer, sélection déjà invitée, délai de 24 h connu pour la sélection ; sélection ou
  tous ; 202 -> rapport « N en file, M ignorés : raison (n) » ; suivi par `interrogationPeriodique` toutes les 3 s tant
  qu'un invité affiché a `envoiEnCours` (10 min au plus, rien onglet caché), relancé aussi au chargement.
- Éditeur : case « Associer les réponses aux personnes invitées » (`reponsesNominatives`, sous « Une réponse par
  appareil », `aria-describedby` vers une explication qui suit le choix), dans le PUT de l'en-tête et `requeteSondage()`.
- Formulaire public avec lien personnel (`/s/:jeton?i=…`, entrée `i`) : jeton envoyé en en-tête `X-Jeton-Invitation`
  (lecture) et `jetonInvitation` (envoi), jamais de jeton d'appareil ni de drapeau « déjà répondu » local ; aucune
  `?langue=` à la première lecture (le serveur sert la langue préférée de l'invité, l'interface s'y aligne pour la visite ;
  `alignementVers` empêche l'ancienne langue de relire le contenu pendant ce changement) ; brouillon à part
  (`{jeton}.invitation`). Écrans : « Lien déjà utilisé » (`invitation.dejaRepondu` ou 409 DEJA_REPONDU), « Lien désactivé »
  (410 INVITATION_REVOQUEE), « Lien personnel invalide » (404 INVITATION_INVALIDE) ; pas de « Nouvelle réponse » ;
  mention `role="note"` sur l'accueil et le questionnaire si `invitation.reponsesNominatives`.
- Réponses : colonne « Invité » (nom et courriel, « Anonyme (lien public) » sans invité) seulement si le sondage est
  nominatif ou si une réponse affichée porte `invite` (vue toutes versions) ; invité dans le détail ; dialogue d'export :
  note sur les colonnes « Invité » et « Courriel de l'invité » si le sondage est nominatif.
- Textes : `invitations.*`, `statutsInvitation.*`, `editeur.nominatif.*`, `public.invitation.*` et
  `public.titresIndisponible.lien-*` dans les trois langues. Chunk `page-invitations` : environ 56 ko bruts.

## Achat de sondages à l'unité
- En plus des abonnements MENSUEL et ANNUEL (inchangés, illimités). Contrat vérifié dans l'OpenAPI (8090) :
  `POST /api/abonnements/achat-sondages/intention { quantite }` (Stripe, puis le `/paiement/confirmer` habituel),
  `POST .../achat-sondages/paiement-mobile { quantite }` (Moosyl, suivi par `GET .../paiement-mobile/{reference}`),
  `GET /api/abonnements/credits` ; `CreditsResponse { solde, totalAchete, totalUtilise, compteCredits }` dans
  `ProfilResponse`, `AbonnementResponse` (+ `offreChoisie`, `nombreSondagesChoisi`), `PaiementConfirmeResponse` et
  `StatutPaiementMobileResponse` (+ `type`, `quantite`, `abonnement` alors facultatif) ; `FormuleResponse.type`
  (ABONNEMENT | ACHAT_SONDAGES), 3e élément de `/formules` avec `formule` null, prix d'UN sondage, `quantiteMin|Max` ;
  `PaiementResponse.type|quantite` ; `InscriptionRequest.offre|nombreSondages` ; super admin : `AdminDetailResponse.credits`,
  `AdminLigneResponse.soldeCredits`, `GET .../admins/{id}/achats-sondages?page&taille`, `revenus { lignes[], sondagesVendus }`
  du tableau de bord. Erreurs : 402 CREDITS_EPUISES (publication), 400 QUANTITE_INVALIDE.
- `/formules` : toujours séparer `formulesAbonnement()` (formule non nulle) et `offreAchat()` (abonnement.model) ; ne jamais
  boucler sur la liste brute (`track f.formule` en double, `formule` null).
- Calculs (`core/utils/achat-sondages.ts`) : `totalAchat` (quantité × prix, en centimes pour le CAD, entiers en MRU ; null
  hors bornes) — affichage seulement, le serveur calcule le montant facturé ; `bornesAchat` (quantiteMin/Max, sinon 1 et
  1000) ; `validateurQuantite` (quantiteRequise, quantiteEntiere, quantiteMin, quantiteMax) ; `soldeAAfficher`. Import
  `type` de `@angular/forms` seulement (le fichier est lu par AuthService, bundle initial).
- `QuantiteSondages` (`shared/components/quantite-sondages`) : champ nombre (contrôle du parent) et total en direct, par
  carte (CAD) et par paiement mobile (MRU), ou seulement le moyen choisi ; `aria-live` sur le total.
- Accès : `AuthService.credits`, `compteCredits`, `abonnementIllimite` (ACTIF, EXPIRE_BIENTOT), `soldeAffiche` (null pour un
  abonné ou sans achat) ; `redirectionObligatoire` ignore EN_ATTENTE_PAIEMENT avec un compte de crédits (admin et
  gestionnaire), `lectureSeule` est faux en EXPIRE avec un compte de crédits ; DESACTIVE inchangé. `ConnexionResponse` n'a
  pas les crédits : `connexion()` lit `GET /api/auth/moi` avant de rendre la main si le statut est EN_ATTENTE_PAIEMENT
  ou EXPIRE (échec ignoré). `AbonnementService` transmet chaque solde reçu à `AuthService.mettreAJourCredits` (lu par
  l'injecteur au moment de l'appel : AuthService injecte AbonnementService). Garde `enAttenteVersSouscrire` : laisse
  « Mon abonnement » à un compte de crédits.
- Inscription : offres Mensuel, Annuel, « Achat de sondages » (cartes radio natives, prix CAD et MRU de `/formules`, sans
  prix s'ils sont illisibles), nombre et total pour l'achat ; `offre` toujours envoyée, `nombreSondages` pour l'achat ;
  `?offre=` (liens de la vitrine) présélectionne.
- Souscription (`souscrire?offre=ACHAT_SONDAGES&quantite=N[&moyen=]`) : 3e offre à côté des formules (`choix` = Formule |
  ACHAT_SONDAGES ; en attente du premier paiement, `offreChoisie` et `nombreSondagesChoisi` de l'inscription d'abord),
  nombre et total du moyen choisi ; carte : `creerIntentionAchat` puis l'écran Stripe existant ; mobile :
  `<app-paiement-mobile [quantite]>` (`acheterMobile`). Succès : « Achat confirmé », « N sondages ont été ajoutés à votre
  solde », « Sondages disponibles : X ». Retour Moosyl : même message ; « Réessayer » garde l'offre et le nombre.
- « Mon abonnement » : 3e carte « Acheter des sondages » (solde si compte de crédits, nombre, totaux CAD et MRU) ->
  souscription ; « S'abonner » quand aucune formule n'est payée. Historique : colonnes Type et Quantité (« — » pour un
  abonnement ; Formule « — » pour un achat ; `type` absent = abonnement).
- Solde : « Sondages disponibles : X » dans la carte Abonnement du tableau de bord admin et dans `bandeau-abonnement`
  (avec « Acheter des sondages » ; mis en évidence à 0), seulement si `soldeAffiche()` n'est pas null.
- Dialogue de publication (mode publier, sans abonnement en cours, compte de crédits ; solde relu par `chargerProfil()` à
  l'ouverture et après la publication) : version 1 -> « Cette publication utilisera 1 sondage (solde : X) » ; version > 1
  -> texte prudent « Gratuite si ce sondage a déjà été publié avec un sondage acheté ; sinon… » (le backend n'expose pas
  `credit_utilise_le`, voir « À venir ») ; solde à 0 en version 1 ou 402 CREDITS_EPUISES -> encadré role=alert
  « Plus aucun sondage disponible » avec « Acheter des sondages » et « S'abonner » (admin ; la boîte se ferme) ou « Demandez
  à l'admin » (gestionnaire) ; « Publier » désactivé en version 1 à 0.
- Super admin : fiche `detail-admin`, carte « Sondages achetés » (solde, total acheté, total utilisé) et historique paginé
  (5 par page) ; tableau de bord : carte « Revenus » (par type puis par devise : montant avec code, nombre de paiements ;
  sondages vendus) ; liste des admins : colonne « Sondages » (`soldeCredits`).
- Vitrine : 3e carte (prix par sondage en CAD et MRU, « de 1 à 1000 sondages, sans date limite » d'après l'API), « Commencer »
  -> `/inscription?offre=` ; étape 1 et FAQ (paiement) mentionnent l'achat à l'unité. Annuel mis en avant : comparé au
  mensuel seulement.
- Textes : `achat.*`, `typesPaiement.*`, `vitrine.tarifs.achatInclus*`, `erreursApi.CREDITS_EPUISES|QUANTITE_INVALIDE`.
  Icône `shopping_cart` retournée en arabe.

## Règles du backend utiles au front
- Erreurs toujours en JSON `{ code, message }` (+ `erreurs[]` par question pour les réponses à un sondage).
  Afficher l'erreur avec `<app-message-erreur [erreur]="…">` (message traduit par son code, voir « Langues de
  l'interface ») ; une erreur `VALIDATION`
  (« champ : message ; champ : message ») est détaillée champ par champ par `detailsErreur()`.
- Règle du mot de passe : 8 caractères au moins, une lettre et un chiffre, 72 au plus (`validateurs.ts`).
- Accès selon l'abonnement (AccesAbonnementInterceptor) : EN_ATTENTE_PAIEMENT -> seulement `/api/auth/**`,
  `/api/abonnements/**`, `/api/messagerie/**` ; EXPIRE -> lecture seule (GET) sauf ces routes et l'envoi des
  statistiques ; DESACTIVE -> rien. Donc pas d'appel aux notifications tant qu'une page est imposée. Compte de crédits
  (l'entreprise a déjà acheté des sondages) : accès complet en EN_ATTENTE_PAIEMENT et EXPIRE ; seule la publication d'un
  nouveau sondage demande un crédit (402 CREDITS_EPUISES).
- Lien de réinitialisation : `http://localhost:4200/reinitialiser-mot-de-passe?jeton=…` (valable 1 h, usage
  unique, ferme toutes les sessions). Formulaire public : `http://localhost:4200/s/{jeton}` (F6).
- Les règles métier détaillées (versions, assignations, collecte, statistiques, messagerie…) sont dans le
  `CLAUDE.md` du backend : le relire au début de chaque étape.

## À venir (backend)
- Exposer, pour un brouillon, un champ indiquant si sa publication consommera un crédit (lignée déjà payée par crédit,
  `credit_utilise_le` de la version 1, ou abonnement actif) : le dialogue de publication pourra alors afficher « gratuit »
  de façon exacte pour une nouvelle version (aujourd'hui : texte prudent « Gratuite si… ; sinon 1 sondage »).
- Envoi automatique par SMS/WhatsApp (Twilio ou fournisseur local) après la mise en ligne (aujourd'hui : liens wa.me et
  sms: ouverts par l'utilisateur, sans envoi par Batulo).
- Logo : renvoyer un chemin relatif (`/api/public/logos/{jeton}`) dans `logo.url` et `apparence.logoUrl`, plutôt qu'une
  URL construite avec `APP_BASE_URL` (qui, mal réglée, désigne le front) ; le front l'accepte déjà tel quel.
- `apparence.nomAffiche` (formulaire public, aperçu) à `null` quand l'admin n'a rien saisi : le front pourra alors montrer
  le nom affiché seul, sans logo (aujourd'hui le bandeau n'apparaît qu'avec un logo, car le nom de l'entreprise y est
  toujours renvoyé par défaut).
- Langues : envoyer un code (et ses paramètres) avec chaque texte produit par le serveur et montré tel quel, pour que le
  front le traduise : `erreurs[]` par question des réponses refusées (REPONSES_INVALIDES), titre et message des
  notifications, contenu des messages automatiques, `raisonFermeture` de la collecte, messages de succès
  (`MessageResponse`). Aujourd'hui ils restent en français dans les trois langues (sauf les messages de succès connus,
  traduits par le front : `texteServeur`). Les courriels et les textes fixes des rapports PDF/XLSX restent en français
  (le backend prévoit de les traduire).
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
- [x] **Phase 4, étape 2 – Personnalisation de l'entreprise** : page « Apparence » (logo, couleur, nom affiché, aperçu,
  lecture seule du gestionnaire), apparence appliquée au formulaire public et à l'aperçu, logo sur la fiche super admin
  (noms à revérifier dans l'OpenAPI).
- [x] **Phase 4, étape 1 – Questions conditionnelles** : conditions d'affichage dans l'éditeur (questions et sections),
  évaluation en direct dans l'aperçu et le formulaire public, « vue par » dans les statistiques (voir la section dédiée).

- [x] **Phase 4, étape 3 (partie 1) – Langues de l'interface** : français, anglais, arabe (RTL) avec Transloco, sélecteur
  (barre du haut, vitrine, pages de connexion, formulaire public), erreurs du backend par code, formats selon la langue.
  Le contenu des sondages est traduit en partie 3.
- [x] **Phase 4, étape 3 (partie 3) – Langues du contenu des sondages** : langues de l'éditeur, écran « Traductions »,
  publication refusée avec les textes manquants, sélecteur unique du formulaire public, aperçu, statistiques et réponses
  par langue (voir la section dédiée ; contrat vérifié dans l'OpenAPI).
- [x] **Phase 4, étape 4 – Invitations nominatives** : onglet « Invitations » (compteurs, tableau, ajout, import CSV,
  reprise, envoi, relance, suivi, export), option nominative de l'éditeur, lien personnel du formulaire public, colonne
  Invité des réponses (voir la section dédiée).
- [x] **Achat de sondages à l'unité** : offre à l'inscription, carte d'achat et paiement (carte ou mobile), solde
  (tableau de bord, bandeau), coût dans le dialogue de publication, historique (type, quantité), super admin (solde,
  achats, revenus), vitrine (voir la section dédiée).

Toutes les rubriques du menu (`layout/menu-lateral/liens-navigation.ts`) mènent à leur page ; `PageAVenir` reste
disponible pour une future rubrique.
