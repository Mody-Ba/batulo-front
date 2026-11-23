import { Component, computed } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ConfigurationDate } from '../../../core/models/sondage.model';
import { formaterDate } from '../reponses';
import { ChampBase } from './champ-base';
import { traduire } from '../../../core/i18n/traduire';

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
      return traduire('public.champs.duAu', { du: formaterDate(dateMin), au: formaterDate(dateMax) });
    }
    return dateMin
      ? traduire('public.champs.aPartirDu', { date: formaterDate(dateMin) })
      : dateMax
        ? traduire('public.champs.jusquau', { date: formaterDate(dateMax) })
        : null;
  });

  protected idsDescription(): string | null {
    return [this.decrit(), this.indication() ? `${this.idBase()}-format` : null].filter(Boolean).join(' ') || null;
  }
}
