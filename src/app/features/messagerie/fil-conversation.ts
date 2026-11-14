import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { catchError, EMPTY, skip, switchMap } from 'rxjs';
import {
  estConversationBatulo,
  MESSAGE_MAX,
  MessageInterneResponse,
  nomInterlocuteur,
} from '../../core/models/messagerie.model';
import { AuthService, MESSAGE_LECTURE_SEULE } from '../../core/services/auth.service';
import { MessagerieService } from '../../core/services/messagerie.service';
import { aLeCode } from '../../core/utils/erreur-http';
import { interrogationPeriodique } from '../../core/utils/interrogation';
import { MessageErreur } from '../../shared/components/message-erreur/message-erreur';
import { EtatMessagerie } from './etat-messagerie';
import { MessageConversation } from './message-conversation';

/** Relecture des derniers messages du fil ouvert. */
export const INTERVALLE_FIL_MS = 10_000;
/** Messages lus par page (les plus récents d'abord côté serveur). */
export const TAILLE_FIL = 30;

/**
 * Fil d'une conversation (/messagerie/:id) : du plus ancien au plus récent ; « Messages plus anciens » charge la page
 * suivante sans perdre la position de lecture. Les derniers messages sont relus toutes les 10 s quand l'onglet est
 * visible (fusionnés par id) et la conversation est marquée lue dès qu'un message reçu non lu est affiché.
 */
@Component({
  selector: 'app-fil-conversation',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MessageConversation,
    MessageErreur,
  ],
  templateUrl: './fil-conversation.html',
  styleUrl: './fil-conversation.scss',
})
export class FilConversation {
  private readonly service = inject(MessagerieService);
  private readonly auth = inject(AuthService);
  private readonly etat = inject(EtatMessagerie);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly max = MESSAGE_MAX;

  /** Paramètre de route :id. */
  readonly id = input.required<string>();
  protected readonly conversationId = computed(() => Number(this.id()));
  protected readonly conversation = computed(
    () => this.etat.conversations().find((c) => c.id === this.conversationId()) ?? null,
  );
  protected readonly titre = computed(() => {
    const c = this.conversation();
    return c ? nomInterlocuteur(c.interlocuteur) : 'Conversation';
  });

  protected readonly messages = signal<MessageInterneResponse[]>([]);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);
  protected readonly plusAnciens = signal(false);
  protected readonly chargementAnciens = signal(false);
  protected readonly envoiEnCours = signal(false);
  protected readonly erreurEnvoi = signal<unknown>(null);
  /** Le serveur a refusé l'écriture (abonnement expiré) : saisie verrouillée. */
  private readonly refusServeur = signal(false);
  private pagesLues = 0;

  /**
   * Abonnement expiré (ou refus du serveur) : la conversation admin ↔ gestionnaire est en lecture seule ; celle avec
   * Batulo reste ouverte (règles du backend).
   */
  protected readonly lectureSeule = computed(() => {
    const c = this.conversation();
    const batulo = c !== null && estConversationBatulo(c);
    return !batulo && (this.refusServeur() || this.auth.lectureSeule());
  });
  protected readonly messageLectureSeule = `${MESSAGE_LECTURE_SEULE} Vous pouvez toujours écrire à Batulo.`;

  private readonly zone = viewChild<ElementRef<HTMLElement>>('zone');

  protected readonly formulaire = inject(NonNullableFormBuilder).group({
    contenu: ['', [Validators.required, Validators.maxLength(MESSAGE_MAX), Validators.pattern(/\S/)]],
  });

  constructor() {
    effect(() => {
      const id = this.conversationId();
      untracked(() => this.ouvrir(id));
    });
    // Le premier battement est le chargement de l'effet ci-dessus.
    interrogationPeriodique(INTERVALLE_FIL_MS)
      .pipe(
        skip(1),
        switchMap(() =>
          this.service.messages(this.conversationId(), 0, TAILLE_FIL).pipe(catchError(() => EMPTY)),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((page) => this.fusionner(page.contenu, 'nouveaux'));
    this.destroyRef.onDestroy(() => this.etat.conversationActive.set(null));
  }

  protected charger(): void {
    this.ouvrir(this.conversationId());
  }

  protected chargerPlusAnciens(): void {
    const zone = this.zone()?.nativeElement;
    const depuisLeBas = zone ? zone.scrollHeight - zone.scrollTop : 0;
    this.chargementAnciens.set(true);
    this.service
      .messages(this.conversationId(), this.pagesLues, TAILLE_FIL)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.pagesLues++;
          this.plusAnciens.set(this.pagesLues < page.totalPages);
          this.fusionner(page.contenu, 'anciens');
          this.chargementAnciens.set(false);
          // Même message en vue après l'ajout au-dessus.
          afterNextRender(() => zone && (zone.scrollTop = zone.scrollHeight - depuisLeBas), { injector: this.injector });
        },
        error: (erreur: unknown) => {
          this.chargementAnciens.set(false);
          this.erreur.set(erreur);
        },
      });
  }

  /** Ctrl + Entrée ou Cmd + Entrée : envoyer ; Entrée seule : retour à la ligne. */
  protected toucheSaisie(evenement: KeyboardEvent): void {
    if (evenement.key === 'Enter' && (evenement.ctrlKey || evenement.metaKey)) {
      evenement.preventDefault();
      this.envoyer();
    }
  }

  protected envoyer(): void {
    if (this.envoiEnCours() || this.lectureSeule()) {
      return;
    }
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }
    const contenu = this.formulaire.controls.contenu.value.trim();
    this.envoiEnCours.set(true);
    this.erreurEnvoi.set(null);
    this.service.envoyer(this.conversationId(), contenu).subscribe({
      next: (message) => {
        this.envoiEnCours.set(false);
        this.formulaire.reset();
        this.fusionner([message], 'nouveaux');
        this.etat.relire();
      },
      error: (erreur: unknown) => {
        this.envoiEnCours.set(false);
        this.erreurEnvoi.set(erreur);
        if (aLeCode(erreur, 'ABONNEMENT_EXPIRE')) {
          this.refusServeur.set(true);
        }
      },
    });
  }

  private ouvrir(id: number): void {
    this.etat.conversationActive.set(id);
    this.messages.set([]);
    this.pagesLues = 0;
    this.refusServeur.set(false);
    this.erreurEnvoi.set(null);
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .messages(id, 0, TAILLE_FIL)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.pagesLues = 1;
          this.plusAnciens.set(page.totalPages > 1);
          this.chargement.set(false);
          this.fusionner(page.contenu, 'nouveaux', true);
        },
        error: (erreur: unknown) => {
          this.chargement.set(false);
          this.erreur.set(erreur);
        },
      });
  }

  /**
   * Ajoute des messages reçus du serveur (plus récents d'abord) sans doublon et garde l'ordre chronologique.
   * De nouveaux messages font défiler en bas si on y était déjà (ou au premier affichage).
   */
  private fusionner(recus: MessageInterneResponse[], sens: 'nouveaux' | 'anciens', premier = false): void {
    const connus = new Map(this.messages().map((m) => [m.id, m]));
    const ajoutes = recus.filter((m) => !connus.has(m.id));
    for (const m of recus) {
      connus.set(m.id, m);
    }
    const zone = this.zone()?.nativeElement;
    const enBas = !zone || zone.scrollHeight - zone.scrollTop - zone.clientHeight < 80;
    this.messages.set([...connus.values()].sort((a, b) => a.dateEnvoi.localeCompare(b.dateEnvoi) || a.id - b.id));
    if (sens === 'nouveaux' && (premier || (ajoutes.length && enBas))) {
      afterNextRender(() => this.defilerEnBas(), { injector: this.injector });
    }
    if (recus.some((m) => m.recu && !m.luLe)) {
      this.marquerLue();
    }
  }

  private marquerLue(): void {
    const id = this.conversationId();
    this.etat.marquerLue(id);
    this.service.marquerLue(id).pipe(catchError(() => EMPTY)).subscribe();
    // Localement : plus aucun reçu non lu (évite de remarquer au prochain battement).
    this.messages.update((liste) => liste.map((m) => (m.recu && !m.luLe ? { ...m, luLe: new Date().toISOString() } : m)));
  }

  private defilerEnBas(): void {
    const zone = this.zone()?.nativeElement;
    if (zone) {
      zone.scrollTop = zone.scrollHeight;
    }
  }
}
