import { Component, computed, effect, input, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { lienSms, lienWhatsApp, messageParDefaut } from './partage';
import { TranslocoPipe } from '@jsverse/transloco';

/** Longueur maximale du message (un SMS long reste envoyable ; au-delà, l'adresse deviendrait démesurée). */
export const MESSAGE_PARTAGE_MAX = 1000;

/**
 * Partage par WhatsApp et SMS : message prérempli et modifiable, puis deux liens qui ouvrent l'application.
 * WhatsApp : nouvel onglet (noopener) ; SMS : même onglet (le téléphone lance Messages). Message vide : liens désactivés.
 */
@Component({
  selector: 'app-partage-message',
  imports: [TranslocoPipe, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="champ-message">
      <mat-label>{{ 'sondages.partage.aEnvoyer' | transloco }}</mat-label>
      <textarea
        matInput
        rows="3"
        [value]="message()"
        (input)="message.set($any($event.target).value)"
        [attr.maxlength]="max"
      ></textarea>
      <mat-hint>{{ 'sondages.partage.aide' | transloco }}</mat-hint>
    </mat-form-field>

    <div class="boutons-partage">
      <a
        matButton="filled"
        class="whatsapp"
        [attr.href]="vide() ? null : urlWhatsApp()"
        target="_blank"
        rel="noopener noreferrer"
        [attr.aria-disabled]="vide() || null"
        [class.desactive]="vide()"
        [attr.aria-label]="'sondages.partage.whatsapp' | transloco"
      >
        <mat-icon fontIcon="chat" aria-hidden="true" />WhatsApp
      </a>
      <a
        matButton="outlined"
        class="sms"
        [attr.href]="vide() ? null : urlSms()"
        [attr.aria-disabled]="vide() || null"
        [class.desactive]="vide()"
        [attr.aria-label]="'sondages.partage.sms' | transloco"
      >
        <mat-icon fontIcon="sms" aria-hidden="true" />SMS
      </a>
      <button matButton type="button" (click)="reinitialiser()" [disabled]="message() === parDefaut()">
        {{ 'sondages.partage.parDefaut' | transloco }}
      </button>
    </div>
    <p id="aide-partage" class="texte-aide">
      @if (vide()) {
        {{ 'sondages.partage.ecrivez' | transloco }}
      } @else {
        {{ 'sondages.partage.aideSms' | transloco }}
      }
    </p>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--bt-espace-2);
    }

    .champ-message {
      width: 100%;
    }

    .boutons-partage {
      display: flex;
      flex-wrap: wrap;
      gap: var(--bt-espace-2) var(--bt-espace-3);

      a,
      button {
        min-height: 44px;
      }

      // Téléphone : boutons pleine largeur, faciles à toucher.
      @media (max-width: 599px) {
        a {
          flex: 1 1 100%;
        }
      }
    }

    .desactive {
      pointer-events: none;
      opacity: 0.5;
    }

    .texte-aide {
      margin: 0;
    }
  `,
})
export class PartageMessage {
  protected readonly max = MESSAGE_PARTAGE_MAX;

  readonly titre = input<string | null>(null);
  readonly url = input.required<string>();

  protected readonly parDefaut = computed(() => messageParDefaut(this.titre(), this.url()));
  readonly message = signal('');
  protected readonly vide = computed(() => this.message().trim() === '');
  protected readonly urlWhatsApp = computed(() => lienWhatsApp(this.message().trim()));
  protected readonly urlSms = computed(() => lienSms(this.message().trim()));

  /** Dernier message par défaut proposé : un message déjà modifié n'est jamais écrasé. */
  private dernierParDefaut = '';

  constructor() {
    // Titre ou lien connus (ou changés, le titre arrivant après le lien) : message par défaut, sauf s'il a été modifié.
    effect(() => {
      const nouveau = this.parDefaut();
      const actuel = untracked(this.message);
      if (actuel === '' || actuel === this.dernierParDefaut) {
        this.message.set(nouveau);
      }
      this.dernierParDefaut = nouveau;
    });
  }

  protected reinitialiser(): void {
    this.message.set(this.parDefaut());
  }
}
