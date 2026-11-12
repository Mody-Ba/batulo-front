import { HttpClient, HttpContext } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  catchError,
  EMPTY,
  finalize,
  firstValueFrom,
  map,
  Observable,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { SANS_AUTHENTIFICATION } from '../interceptors/contexte-http';
import { StatutAbonnement } from '../models/abonnement.model';
import {
  ChangementMotDePasseRequest,
  ConnexionRequest,
  ConnexionResponse,
  ProfilResponse,
} from '../models/auth.model';
import { ACCUEIL_PAR_ROLE, Role } from '../models/role.model';
import { UtilisateurResponse } from '../models/utilisateur.model';
import { AbonnementService } from './abonnement.service';

/** Ce qui est gardé dans sessionStorage : propre à l'onglet, effacé à sa fermeture. */
interface Session {
  jeton: string;
  /** Usage unique : un seul rafraîchissement à la fois (voir rafraichir()). */
  jetonRafraichissement: string;
  /** Instant d'expiration du jeton d'accès (ms epoch), pour information. */
  expireLe: number;
  role: Role;
  statutAbonnement: StatutAbonnement | null;
  motDePasseTemporaire: boolean;
  utilisateur: UtilisateurResponse;
}

const CLE_SESSION = 'batulo.session';
export const MESSAGE_LECTURE_SEULE = 'Abonnement expiré : lecture seule.';
export const MESSAGE_SESSION_EXPIREE = 'Votre session a expiré. Veuillez vous reconnecter.';

/**
 * État de connexion de l'application (signals).
 * Le rôle et le statut connus ici servent seulement à l'affichage : le serveur protège les données.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly abonnementService = inject(AbonnementService);
  private readonly urlAuth = `${environment.apiUrl}/api/auth`;

  private readonly session = signal<Session | null>(null);
  private readonly _messageConnexion = signal<string | null>(null);
  /** Rafraîchissement en cours, partagé par toutes les requêtes qui ont reçu un 401. */
  private rafraichissement: Observable<string> | null = null;

  readonly estConnecte = computed(() => this.session() !== null);
  readonly jeton = computed(() => this.session()?.jeton ?? null);
  readonly role = computed(() => this.session()?.role ?? null);
  readonly utilisateur = computed(() => this.session()?.utilisateur ?? null);
  readonly statutAbonnement = computed(() => this.session()?.statutAbonnement ?? null);
  readonly motDePasseTemporaire = computed(() => this.session()?.motDePasseTemporaire ?? false);
  /**
   * Abonnement expiré : le backend n'accepte plus que la lecture (GET). Les boutons d'écriture sont
   * désactivés avec l'infobulle MESSAGE_LECTURE_SEULE.
   */
  readonly lectureSeule = computed(
    () => this.role() !== 'SUPER_ADMIN' && this.statutAbonnement() === 'EXPIRE',
  );
  readonly nomAffiche = computed(() => {
    const utilisateur = this.utilisateur();
    return utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}`.trim() : '';
  });

  /**
   * Page imposée par l'état du compte, ou null si l'accès est normal :
   * mot de passe temporaire, puis abonnement désactivé ou en attente de paiement.
   * Le SUPER_ADMIN n'est pas concerné par l'abonnement.
   */
  readonly redirectionObligatoire = computed<string | null>(() => {
    const session = this.session();
    if (!session) {
      return null;
    }
    if (session.motDePasseTemporaire) {
      return '/changer-mot-de-passe';
    }
    if (session.role === 'SUPER_ADMIN') {
      return null;
    }
    switch (session.statutAbonnement) {
      case 'DESACTIVE':
        return '/compte-suspendu';
      case 'EN_ATTENTE_PAIEMENT':
        // Seul l'admin peut payer ; ses gestionnaires n'ont rien à faire en attendant.
        return session.role === 'ADMIN' ? '/admin/abonnement' : '/compte-suspendu';
      default:
        return null;
    }
  });

  /** Message à afficher sur la page de connexion (session expirée, mot de passe réinitialisé...). */
  readonly messageConnexion = this._messageConnexion.asReadonly();

  constructor() {
    this.restaurerSession();
  }

  connexion(identifiants: ConnexionRequest): Observable<ConnexionResponse> {
    return this.http.post<ConnexionResponse>(`${this.urlAuth}/connexion`, identifiants).pipe(
      tap((reponse) => {
        this._messageConnexion.set(null);
        this.ouvrirSession(reponse);
      }),
    );
  }

  /**
   * Échange le jeton de rafraîchissement contre une nouvelle paire et renvoie le nouveau jeton
   * d'accès. Les appels simultanés partagent la même requête : le jeton de rafraîchissement est à
   * usage unique et le réutiliser fermerait toutes les sessions du compte.
   */
  rafraichir(): Observable<string> {
    const session = this.session();
    if (!session) {
      return throwError(() => new Error('Aucune session à rafraîchir.'));
    }
    if (!this.rafraichissement) {
      this.rafraichissement = this.http
        .post<ConnexionResponse>(
          `${this.urlAuth}/rafraichir`,
          { jetonRafraichissement: session.jetonRafraichissement },
          { context: new HttpContext().set(SANS_AUTHENTIFICATION, true) },
        )
        .pipe(
          tap((reponse) => this.ouvrirSession(reponse)),
          map((reponse) => reponse.jeton),
          finalize(() => (this.rafraichissement = null)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.rafraichissement;
  }

  /** Recharge le compte et le statut d'abonnement (GET /moi). */
  chargerProfil(): Observable<ProfilResponse> {
    return this.http.get<ProfilResponse>(`${this.urlAuth}/moi`).pipe(
      tap((profil) =>
        this.mettreAJourSession({
          utilisateur: profil.utilisateur,
          role: profil.utilisateur.role,
          motDePasseTemporaire: profil.utilisateur.motDePasseTemporaire,
          statutAbonnement: profil.statutAbonnement,
        }),
      ),
    );
  }

  /** Au démarrage : recharge le profil d'une session restaurée. Ne bloque jamais l'application. */
  initialiser(): Promise<void> {
    if (!this.estConnecte()) {
      return Promise.resolve();
    }
    return firstValueFrom(this.chargerProfil().pipe(map(() => undefined))).catch(() => undefined);
  }

  /** Le backend ferme les autres sessions et renvoie de nouveaux jetons (motDePasseTemporaire: false). */
  changerMotDePasse(demande: ChangementMotDePasseRequest): Observable<ConnexionResponse> {
    return this.http
      .post<ConnexionResponse>(`${this.urlAuth}/changer-mot-de-passe`, demande)
      .pipe(tap((reponse) => this.ouvrirSession(reponse)));
  }

  /**
   * Déconnexion volontaire : révoque le jeton de rafraîchissement côté serveur (sans attendre
   * la réponse ni en tenir compte), efface la session et renvoie vers /connexion.
   */
  deconnexion(message: string | null = null): void {
    const session = this.session();
    if (session) {
      this.http
        .post<void>(
          `${this.urlAuth}/deconnexion`,
          { jetonRafraichissement: session.jetonRafraichissement },
          {
            headers: { Authorization: `Bearer ${session.jeton}` },
            context: new HttpContext().set(SANS_AUTHENTIFICATION, true),
          },
        )
        .pipe(catchError(() => EMPTY))
        .subscribe();
    }
    this.terminerSession(message);
  }

  /** Fin de session sans appel au serveur (rafraîchissement refusé, jetons révoqués). */
  terminerSession(message: string | null = MESSAGE_SESSION_EXPIREE): void {
    if (!this.session()) {
      return;
    }
    this.fermerSession();
    this._messageConnexion.set(message);
    void this.router.navigateByUrl('/connexion');
  }

  /** Statut appris d'une réponse 403 (ABONNEMENT_...), ou du paiement (étape F2). */
  mettreAJourStatutAbonnement(statut: StatutAbonnement): void {
    this.mettreAJourSession({ statutAbonnement: statut });
  }

  /** Le serveur a répondu 403 MOT_DE_PASSE_TEMPORAIRE. */
  signalerMotDePasseTemporaire(): void {
    this.mettreAJourSession({ motDePasseTemporaire: true });
  }

  /** Message à afficher à la prochaine ouverture de /connexion. */
  preparerMessageConnexion(message: string): void {
    this._messageConnexion.set(message);
  }

  /** Lu une fois par la page de connexion. */
  consommerMessageConnexion(): string | null {
    const message = this._messageConnexion();
    this._messageConnexion.set(null);
    return message;
  }

  /** Page d'accueil du compte connecté, compte tenu de son état, ou /connexion. */
  urlAccueil(): string {
    const session = this.session();
    if (!session) {
      return '/connexion';
    }
    return this.redirectionObligatoire() ?? ACCUEIL_PAR_ROLE[session.role];
  }

  private ouvrirSession(reponse: ConnexionResponse): void {
    const session: Session = {
      jeton: reponse.jeton,
      jetonRafraichissement: reponse.jetonRafraichissement,
      expireLe: Date.now() + reponse.expireDans * 1000,
      role: reponse.role,
      statutAbonnement: reponse.statutAbonnement,
      motDePasseTemporaire: reponse.motDePasseTemporaire,
      utilisateur: reponse.utilisateur,
    };
    this.session.set(session);
    this.ecrireStockage(session);
  }

  private mettreAJourSession(modifications: Partial<Session>): void {
    const session = this.session();
    if (!session) {
      return;
    }
    const nouvelle = { ...session, ...modifications };
    this.session.set(nouvelle);
    this.ecrireStockage(nouvelle);
  }

  private fermerSession(): void {
    this.session.set(null);
    // Le prochain compte connecté ne doit pas voir l'abonnement de celui-ci.
    this.abonnementService.oublier();
    this.rafraichissement = null;
    try {
      sessionStorage.removeItem(CLE_SESSION);
    } catch {
      // Stockage indisponible : rien à effacer.
    }
  }

  /** Un jeton d'accès expiré est gardé : le premier 401 le fera rafraîchir. */
  private restaurerSession(): void {
    let session: Session | null = null;
    try {
      const brut = sessionStorage.getItem(CLE_SESSION);
      session = brut ? (JSON.parse(brut) as Session) : null;
    } catch {
      session = null;
    }
    if (!session?.jeton || !session.jetonRafraichissement || !session.role || !session.utilisateur) {
      this.fermerSession();
      return;
    }
    this.session.set(session);
  }

  private ecrireStockage(session: Session): void {
    try {
      sessionStorage.setItem(CLE_SESSION, JSON.stringify(session));
    } catch {
      // Stockage indisponible (navigation privée stricte) : la session reste en mémoire.
    }
  }
}
