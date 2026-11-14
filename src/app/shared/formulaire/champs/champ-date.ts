import { Component, computed } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ConfigurationDate } from '../../../core/models/sondage.model';
import { formaterDate } from '../reponses';
import { ChampBase } from './champ-base';

/** DATE : sélecteur de date natif (adapté au téléphone), AAAA-MM-JJ, entre dateMin et dateMax si définies. */
@Component({
  selector: 'app-champ-date',
  imports: [ReactiveFormsModule],
  template: `
    <input
      class="champ-saisie court"
      type="date"
      [id]="idChamp"
      [formControl]="$any(controle())"
      [attr.min]="config().dateMin ?? null"
      [attr.max]="config().dateMax ?? null"
      [attr.aria-describedby]="idsDescription()"
      [attr.aria-invalid]="invalide() || null"
    />
    @if (indication(); as texte) {
      <div class="indication"><span [id]="idBase() + '-format'">{{ texte }}</span></div>
    }
  `,
})
export class ChampDate extends ChampBase {
  protected readonly config = computed(() => this.question().configuration as Partial<ConfigurationDate>);
  protected readonly indication = computed(() => {
    const { dateMin, dateMax } = this.config();
    if (dateMin && dateMax) {
      return `Du ${formaterDate(dateMin)} au ${formaterDate(dateMax)}`;
    }
    return dateMin ? `À partir du ${formaterDate(dateMin)}` : dateMax ? `Jusqu’au ${formaterDate(dateMax)}` : null;
  });

  protected idsDescription(): string | null {
    return [this.decrit(), this.indication() ? `${this.idBase()}-format` : null].filter(Boolean).join(' ') || null;
  }
}
