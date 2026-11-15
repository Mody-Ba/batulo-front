import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormuleResponse } from '../../../core/models/abonnement.model';
import { AbonnementService } from '../../../core/services/abonnement.service';

/** « 1,00 $ » (fr-CA) : Intl plutôt que CurrencyPipe (pas de données de locale à charger). */
export function prixEnClair(formule: Pick<FormuleResponse, 'prix' | 'devise'>): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: formule.devise }).format(formule.prix);
}

/**
 * Tarifs de la vitrine, lus dans GET /api/abonnements/formules (route publique) : rien n'est écrit dans le front.
 * Pendant la lecture, des emplacements ; si l'API ne répond pas, un message et « Réessayer ».
 */
@Component({
  selector: 'app-tarifs-vitrine',
  imports: [RouterLink],
  templateUrl: './tarifs-vitrine.html',
  styleUrl: './tarifs-vitrine.scss',
})
export class TarifsVitrine {
  private readonly service = inject(AbonnementService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly prix = prixEnClair;

  protected readonly formules = signal<FormuleResponse[] | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal(false);

  /** L'annuel est mis en avant seulement s'il coûte moins que douze mois (calculé, jamais affirmé). */
  protected readonly annuelAvantageux = computed(() => {
    const liste = this.formules() ?? [];
    const mensuel = liste.find((f) => f.formule === 'MENSUEL');
    const annuel = liste.find((f) => f.formule === 'ANNUEL');
    return !!mensuel && !!annuel && annuel.devise === mensuel.devise && annuel.prix < mensuel.prix * 12;
  });

  constructor() {
    this.charger();
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
