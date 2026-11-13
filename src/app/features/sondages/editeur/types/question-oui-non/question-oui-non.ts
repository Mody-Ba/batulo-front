import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** OUI_NON : rien à configurer, ni options ni configuration ; aperçu des deux réponses. */
@Component({
  selector: 'app-question-oui-non',
  styleUrl: '../_configuration.scss',
  imports: [MatIconModule],
  template: `
    <div class="apercu-reponse" aria-label="Aperçu des réponses">
      <span><mat-icon fontIcon="radio_button_unchecked" aria-hidden="true" />Oui</span>
      <span><mat-icon fontIcon="radio_button_unchecked" aria-hidden="true" />Non</span>
    </div>
    <p class="texte-aide">Rien à configurer : le répondant choisit Oui ou Non.</p>
  `,
})
export class QuestionOuiNon {}
