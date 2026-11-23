import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

/** OUI_NON : rien à configurer, ni options ni configuration ; aperçu des deux réponses. */
@Component({
  selector: 'app-question-oui-non',
  styleUrl: '../_configuration.scss',
  imports: [TranslocoPipe, MatIconModule],
  template: `
    <div class="apercu-reponse" [attr.aria-label]="'editeur.types.apercuReponses' | transloco">
      <span><mat-icon fontIcon="radio_button_unchecked" aria-hidden="true" />{{ 'public.champs.oui' | transloco }}</span>
      <span><mat-icon fontIcon="radio_button_unchecked" aria-hidden="true" />{{ 'public.champs.non' | transloco }}</span>
    </div>
    <p class="texte-aide">{{ 'editeur.types.ouiNonAide' | transloco }}</p>
  `,
})
export class QuestionOuiNon {}
