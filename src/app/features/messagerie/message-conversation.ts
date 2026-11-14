import { DatePipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { LIBELLES_TYPE_MESSAGE, MessageInterneResponse } from '../../core/models/messagerie.model';
import { AuthService } from '../../core/services/auth.service';
import { lienMessage } from './liens-messages';

/** Un message du fil : bulle (envoyé ou reçu), ou carte distincte pour un message automatique, avec son lien. */
@Component({
  selector: 'app-message-conversation',
  imports: [DatePipe, RouterLink, MatIconModule],
  template: `
    @let m = message();
    <article
      class="message"
      [class.recu]="m.recu"
      [class.envoye]="!m.recu"
      [class.automatique]="automatique()"
      [attr.aria-label]="libelle()"
    >
      @if (automatique()) {
        <p class="type">
          <mat-icon [fontIcon]="m.type === 'STATISTIQUES' ? 'insights' : 'workspace_premium'" aria-hidden="true" />
          Message automatique · {{ libelleType() }}
        </p>
      } @else if (m.recu) {
        <p class="auteur">{{ m.expediteurNom }}</p>
      }
      <p class="contenu">{{ m.contenu }}</p>
      @if (lien(); as l) {
        <a class="lien" [routerLink]="l.commandes" [queryParams]="l.queryParams">
          {{ l.libelle }}<mat-icon fontIcon="arrow_forward" aria-hidden="true" />
        </a>
      }
      <p class="meta">
        <time [attr.datetime]="m.dateEnvoi">{{ m.dateEnvoi | date: 'd MMM y, HH:mm' }}</time>
        @if (!m.recu) {
          · {{ m.luLe ? 'Lu' : 'Envoyé' }}
        }
      </p>
    </article>
  `,
  styleUrl: './message-conversation.scss',
})
export class MessageConversation {
  private readonly auth = inject(AuthService);
  readonly message = input.required<MessageInterneResponse>();

  protected readonly automatique = computed(() => this.message().type !== 'TEXTE');
  protected readonly libelleType = computed(() => {
    const type = this.message().type;
    return type === 'TEXTE' ? '' : LIBELLES_TYPE_MESSAGE[type];
  });
  protected readonly lien = computed(() => lienMessage(this.message(), this.auth.role()));
  protected readonly libelle = computed(() => {
    const m = this.message();
    if (this.automatique()) {
      return `Message automatique, ${this.libelleType()}`;
    }
    return m.recu ? `Message de ${m.expediteurNom}` : 'Votre message';
  });
}
