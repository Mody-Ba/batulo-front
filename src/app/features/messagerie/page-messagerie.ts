import { Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { catchError, EMPTY, filter, switchMap } from 'rxjs';
import { ConversationResponse, nomInterlocuteur } from '../../core/models/messagerie.model';
import { AuthService } from '../../core/services/auth.service';
import { MessagerieService } from '../../core/services/messagerie.service';
import { interrogationPeriodique } from '../../core/utils/interrogation';
import { messageErreur } from '../../core/utils/erreur-http';
import { EntetePage } from '../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../shared/components/message-erreur/message-erreur';
import { DialogueNouvelleConversation } from './dialogue-nouvelle-conversation';
import { EtatMessagerie } from './etat-messagerie';
import { DateLPipe } from '../../core/i18n/formats.pipes';

/** Relecture de la liste des conversations. */
export const INTERVALLE_LISTE_MS = 30_000;

/**
 * Messagerie : conversations (la plus récemment active d'abord) et fil ouvert (route enfant /messagerie/:id). Sur
 * ordinateur côte à côte ; sur téléphone, la liste puis le fil. Relue toutes les 30 s quand l'onglet est visible.
 */
@Component({
  selector: 'app-page-messagerie',
  imports: [DateLPipe,  RouterLink, RouterOutlet, MatButtonModule, MatIconModule, MatProgressBarModule, EntetePage, MessageErreur],
  providers: [EtatMessagerie],
  templateUrl: './page-messagerie.html',
  styleUrl: './page-messagerie.scss',
})
export class PageMessagerie {
  private readonly service = inject(MessagerieService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly auth = inject(AuthService);
  protected readonly etat = inject(EtatMessagerie);
  protected readonly nom = nomInterlocuteur;

  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);
  protected readonly ouvertureEnCours = signal(false);

  protected readonly titreNouvelle = computed(() =>
    this.auth.role() === 'GESTIONNAIRE' ? 'Écrire à mon admin' : 'Nouvelle conversation',
  );

  constructor() {
    interrogationPeriodique(INTERVALLE_LISTE_MS)
      .pipe(
        switchMap(() =>
          this.service.conversations().pipe(
            catchError((erreur: unknown) => {
              this.erreur.set(erreur);
              this.chargement.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((page) => this.recevoir(page.contenu));
    // Après un envoi ou une ouverture : relecture immédiate.
    effect(() => {
      if (this.etat.relecture() > 0) {
        untracked(() => this.charger());
      }
    });
  }

  protected charger(): void {
    this.service
      .conversations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => this.recevoir(page.contenu),
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
  }

  /** Gestionnaire : sa conversation avec son admin, sans choix ; sinon un dialogue des interlocuteurs autorisés. */
  protected nouvelleConversation(): void {
    if (this.auth.role() === 'GESTIONNAIRE') {
      this.ouvertureEnCours.set(true);
      this.service.ouvrir({}).subscribe({
        next: (c) => {
          this.ouvertureEnCours.set(false);
          this.ouvrir(c);
        },
        error: (erreur: unknown) => {
          this.ouvertureEnCours.set(false);
          this.snackBar.open(messageErreur(erreur), 'Fermer', { duration: 6000 });
        },
      });
      return;
    }
    this.dialog
      .open<DialogueNouvelleConversation, void, ConversationResponse>(DialogueNouvelleConversation, {
        width: '520px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      .pipe(filter((c): c is ConversationResponse => !!c))
      .subscribe((c) => this.ouvrir(c));
  }

  /** Résumé lu par les lecteurs d'écran pour une ligne de la liste. */
  protected resume(c: ConversationResponse): string {
    const parties = [this.nom(c.interlocuteur)];
    if (c.interlocuteur.entreprise && this.auth.role() === 'SUPER_ADMIN') {
      parties.push(c.interlocuteur.entreprise);
    }
    if (c.nonLus > 0) {
      parties.push(`${c.nonLus} non lu${c.nonLus > 1 ? 's' : ''}`);
    }
    if (c.dernierMessage) {
      parties.push(`${c.dernierMessage.recu ? '' : 'Vous : '}${c.dernierMessage.extrait}`);
    }
    return parties.join(', ');
  }

  private ouvrir(conversation: ConversationResponse): void {
    if (!this.etat.conversations().some((c) => c.id === conversation.id)) {
      this.etat.conversations.update((liste) => [conversation, ...liste]);
    }
    void this.router.navigate(['/messagerie', conversation.id]);
  }

  private recevoir(conversations: ConversationResponse[]): void {
    // La conversation ouverte reste lue (le fil la marque lue à l'arrivée des messages).
    const active = this.etat.conversationActive();
    this.etat.conversations.set(conversations.map((c) => (c.id === active ? { ...c, nonLus: 0 } : c)));
    this.erreur.set(null);
    this.chargement.set(false);
  }
}
