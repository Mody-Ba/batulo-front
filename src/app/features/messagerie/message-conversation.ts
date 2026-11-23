import { Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { LIBELLES_TYPE_MESSAGE, MessageInterneResponse } from '../../core/models/messagerie.model';
import { AuthService } from '../../core/services/auth.service';
import { lienMessage } from './liens-messages';
import { DateLPipe } from '../../core/i18n/formats.pipes';
import { traduire } from '../../core/i18n/traduire';
import { TranslocoPipe } from '@jsverse/transloco';

/** Un message du fil : bulle (envoyé ou reçu), ou carte distincte pour un message automatique, avec son lien. */
@Component({
  selector: 'app-message-conversation',
  imports: [TranslocoPipe, DateLPipe,  RouterLink, MatIconModule],
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
          {{ 'messagerie.automatique' | transloco }} · {{ libelleType() }}
        </p>
      } @else if (m.recu) {
        <p class="auteur" dir="auto">{{ m.expediteurNom }}</p>
      }
      <p class="contenu" dir="auto">{{ m.contenu }}</p>
      @if (lien(); as l) {
        <a class="lien" [routerLink]="l.commandes" [queryParams]="l.queryParams">
          {{ l.libelle }}<mat-icon fontIcon="arrow_forward" aria-hidden="true" />
        </a>
      }
      <p class="meta">
        <time [attr.datetime]="m.dateEnvoi">{{ m.dateEnvoi | dateL: 'courtHeure' }}</time>
        @if (!m.recu) {
          · {{ (m.luLe ? 'messagerie.lu' : 'messagerie.envoye') | transloco }}
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
      return `${traduire('messagerie.automatique')}, ${this.libelleType()}`;
    }
    return m.recu ? traduire('messagerie.messageDe', { nom: m.expediteurNom }) : traduire('demandes.votreMessage');
  });
}
