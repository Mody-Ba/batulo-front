import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  APPLICATIONS_MOBILES,
  FormuleAbonnement,
  formulesAbonnement,
  FormuleResponse,
  offreAchat,
} from '../../../core/models/abonnement.model';
import { bornesAchat } from '../../../core/utils/achat-sondages';
import { AbonnementService } from '../../../core/services/abonnement.service';
import { montantEnClair } from '../../../core/utils/montant';
import { localeIntl, texteServeur } from '../../../core/i18n/traduire';
import { TranslocoPipe } from '@jsverse/transloco';

/** « 1,00 $ » en français, « $1.00 » en anglais : Intl plutôt que CurrencyPipe (pas de données de locale à charger). */
export function prixEnClair(formule: Pick<FormuleResponse, 'prix' | 'devise'>): string {
  return new Intl.NumberFormat(localeIntl(), { style: 'currency', currency: formule.devise }).format(formule.prix);
}

/**
 * Tarifs de la vitrine, lus dans GET /api/abonnements/formules (route publique) : rien n'est écrit dans le front
 * (prix par carte et prix du paiement mobile en MRU). Deux abonnements et, si le serveur la propose, l'achat de
 * sondages à l'unité (prix d'un sondage, quantités minimale et maximale).
 * Pendant la lecture, des emplacements ; si l'API ne répond pas, un message et « Réessayer ».
 */
@Component({
  selector: 'app-tarifs-vitrine',
  imports: [TranslocoPipe, RouterLink],
  templateUrl: './tarifs-vitrine.html',
  styleUrl: './tarifs-vitrine.scss',
})
export class TarifsVitrine {
  private readonly service = inject(AbonnementService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly prix = prixEnClair;
  protected readonly montant = montantEnClair;
  protected readonly applications = APPLICATIONS_MOBILES;

  protected readonly formules = signal<FormuleResponse[] | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal(false);

  protected readonly abonnements = computed<FormuleAbonnement[]>(() => formulesAbonnement(this.formules() ?? []));
  protected readonly achat = computed(() => offreAchat(this.formules() ?? []) ?? null);
  protected readonly bornes = computed(() => bornesAchat(this.achat()));

  /** L'annuel est mis en avant seulement s'il coûte moins que douze mois (calculé, jamais affirmé). */
  protected readonly annuelAvantageux = computed(() => {
    const liste = this.abonnements();
    const mensuel = liste.find((f) => f.formule === 'MENSUEL');
    const annuel = liste.find((f) => f.formule === 'ANNUEL');
    return !!mensuel && !!annuel && annuel.devise === mensuel.devise && annuel.prix < mensuel.prix * 12;
  });

  constructor() {
    this.charger();
  }

  /** Libellé et durée du serveur en français, traduits dans les autres langues. */
  protected libelle(f: FormuleAbonnement): string {
    return texteServeur(`vitrine.tarifs.libelle.${f.formule}`, f.libelle);
  }

  protected duree(f: FormuleAbonnement): string {
    return texteServeur(`vitrine.tarifs.duree.${f.formule}`, f.duree);
  }

  protected charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service
      .formules()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (formules) => {
          this.formules.set(formules);
          this.chargement.set(false);
        },
        error: () => {
          this.erreur.set(true);
          this.chargement.set(false);
        },
      });
  }
}
