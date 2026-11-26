import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { startWith, Subscription } from 'rxjs';
import { FormuleResponse, MoyenPaiement } from '../../../core/models/abonnement.model';
import { bornesAchat, totalAchat } from '../../../core/utils/achat-sondages';
import { montantEnClair } from '../../../core/utils/montant';

/** Compteur des identifiants : plusieurs champs peuvent coexister (aide et total reliés par aria-describedby). */
let suivant = 0;

/**
 * Nombre de sondages à acheter (1 à 1000, bornes lues dans /formules) et total calculé en direct : par carte (CAD) et
 * par paiement mobile (MRU), ou seulement le moyen choisi. Le serveur calcule le montant facturé ; ici, un affichage.
 * Le contrôle (validateurQuantite) appartient au parent.
 */
@Component({
  selector: 'app-quantite-sondages',
  imports: [TranslocoPipe, ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="quantite">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="champ-quantite">
        <mat-label>{{ 'achat.nombre' | transloco }}</mat-label>
        <input
          matInput
          type="number"
          inputmode="numeric"
          [formControl]="controle()"
          [min]="bornes().min"
          [max]="bornes().max"
          step="1"
          required
          [attr.aria-describedby]="id + '-total'"
        />
        <mat-hint>{{ 'achat.bornes' | transloco: { min: bornes().min, max: bornes().max } }}</mat-hint>
        @if (controle().hasError('quantiteRequise')) {
          <mat-error>{{ 'achat.erreurs.requise' | transloco }}</mat-error>
        } @else if (controle().hasError('quantiteEntiere')) {
          <mat-error>{{ 'achat.erreurs.entiere' | transloco }}</mat-error>
        } @else if (controle().hasError('quantiteMin') || controle().hasError('quantiteMax')) {
          <mat-error>{{ 'achat.bornes' | transloco: { min: bornes().min, max: bornes().max } }}</mat-error>
        }
      </mat-form-field>

      <div class="total" [id]="id + '-total'" aria-live="polite">
        @if (offre(); as o) {
          <p class="unitaire">{{ 'achat.prixUnitaire' | transloco: { prix: unitaire() } }}</p>
          @if (totalCarte() !== null || totalMobile() !== null) {
            <p class="montants">
              <span class="libelle">{{ 'achat.total' | transloco }}</span>
              @if (totalCarte(); as t) {
                <strong class="montant-carte">{{ montant(t, o.devise) }}</strong>
                @if (moyen() === null) {
                  <span class="moyen">{{ 'achat.parCarte' | transloco }}</span>
                }
              }
              @if (totalCarte() !== null && totalMobile() !== null) {
                <span class="separateur" aria-hidden="true">·</span>
                <span class="visuellement-cache">{{ 'vitrine.tarifs.ou' | transloco }}</span>
              }
              @if (totalMobile(); as t) {
                <strong class="montant-mobile">{{ montant(t, o.deviseMobile) }}</strong>
                @if (moyen() === null) {
                  <span class="moyen">{{ 'vitrine.tarifs.parMobile' | transloco }}</span>
                }
              }
            </p>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .quantite {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: var(--bt-espace-2) var(--bt-espace-4);
    }

    .champ-quantite {
      flex: 0 1 220px;
      min-width: 160px;
    }

    .total {
      flex: 1 1 220px;

      p {
        margin: 0 0 var(--bt-espace-1);
      }
    }

    .unitaire {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    .montants {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--bt-espace-1) var(--bt-espace-2);
    }

    strong {
      font: var(--mat-sys-title-medium);
    }

    .moyen,
    .separateur {
      color: var(--mat-sys-on-surface-variant);
    }

    @media (max-width: 599.98px) {
      .champ-quantite {
        flex-basis: 100%;
      }
    }
  `,
})
export class QuantiteSondages {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly id = `quantite-sondages-${++suivant}`;
  protected readonly montant = montantEnClair;

  /** Offre ACHAT_SONDAGES de /formules (prix d'un sondage) ; null tant qu'elle n'est pas lue. */
  readonly offre = input<FormuleResponse | null | undefined>(null);
  readonly controle = input.required<FormControl<number | null>>();
  /** Moyen choisi : seulement son total ; null : les deux (carte et paiement mobile). */
  readonly moyen = input<MoyenPaiement | null>(null);

  private readonly valeur = signal<number | null>(null);
  protected readonly bornes = computed(() => bornesAchat(this.offre()));
  protected readonly unitaire = computed(() => {
    const o = this.offre();
    if (!o) {
      return '';
    }
    const carte = montantEnClair(o.prix, o.devise);
    const mobile = o.prixMobile != null && o.deviseMobile ? montantEnClair(o.prixMobile, o.deviseMobile) : null;
    const choix = this.moyen();
    return choix === 'carte' || !mobile ? carte : choix === 'mobile' ? mobile : `${carte} · ${mobile}`;
  });
  protected readonly totalCarte = computed(() => {
    const o = this.offre();
    return o && this.moyen() !== 'mobile' ? totalAchat(o.prix, this.valeur(), o.devise, this.bornes()) : null;
  });
  protected readonly totalMobile = computed(() => {
    const o = this.offre();
    return o && this.moyen() !== 'carte' ? totalAchat(o.prixMobile, this.valeur(), o.deviseMobile, this.bornes()) : null;
  });

  constructor() {
    let abonnement: Subscription | null = null;
    effect(() => {
      const controle = this.controle();
      abonnement?.unsubscribe();
      abonnement = controle.valueChanges.pipe(startWith(controle.value)).subscribe((v) => this.valeur.set(v));
    });
    this.destroyRef.onDestroy(() => abonnement?.unsubscribe());
  }
}
