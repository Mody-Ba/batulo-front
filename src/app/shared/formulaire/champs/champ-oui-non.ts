import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ChampBase } from './champ-base';
import { TranslocoPipe } from '@jsverse/transloco';

/** OUI_NON : deux boutons radio natifs ; la réponse est true (oui) ou false (non). */
@Component({
  selector: 'app-champ-oui-non',
  imports: [TranslocoPipe, ReactiveFormsModule],
  template: `
    <div class="liste-choix en-ligne" role="radiogroup" [attr.aria-labelledby]="idLibelle" [attr.aria-describedby]="decrit()" [attr.aria-invalid]="invalide() || null">
      <label class="choix">
        <input type="radio" [name]="idBase()" [attr.name]="idBase()" [value]="true" [formControl]="$any(controle())" />
        <span>{{ 'public.champs.oui' | transloco }}</span>
      </label>
      <label class="choix">
        <input type="radio" [name]="idBase()" [attr.name]="idBase()" [value]="false" [formControl]="$any(controle())" />
        <span>{{ 'public.champs.non' | transloco }}</span>
      </label>
    </div>
  `,
})
export class ChampOuiNon extends ChampBase {}
