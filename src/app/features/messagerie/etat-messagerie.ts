import { computed, Injectable, signal } from '@angular/core';
import { ConversationResponse } from '../../core/models/messagerie.model';

/**
 * État partagé par la liste des conversations et le fil ouvert (fourni par la page de la messagerie) : la
 * conversation active (pour la disposition sur téléphone et la mise en évidence) et les conversations connues.
 */
@Injectable()
export class EtatMessagerie {
  readonly conversations = signal<ConversationResponse[]>([]);
  readonly conversationActive = signal<number | null>(null);
  /** Demande de relecture de la liste (après un envoi, une ouverture). */
  readonly relecture = signal(0);

  readonly active = computed(() => this.conversations().find((c) => c.id === this.conversationActive()) ?? null);

  relire(): void {
    this.relecture.update((n) => n + 1);
  }

  /** Conversation lue : plus de pastille dans la liste. */
  marquerLue(id: number): void {
    this.conversations.update((liste) => liste.map((c) => (c.id === id ? { ...c, nonLus: 0 } : c)));
  }
}
