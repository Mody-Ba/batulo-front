import { DatePipe } from '@angular/common';
import { afterNextRender, Component, DOCUMENT, DestroyRef, effect, ElementRef, inject, Injector, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { LIBELLES_FORMULE, StatutPaiementMobileResponse } from '../../../../core/models/abonnement.model';
import { AbonnementService } from '../../../../core/services/abonnement.service';
import { AuthService } from '../../../../core/services/auth.service';
import { aLeCode } from '../../../../core/utils/erreur-http';
import { montantEnClair } from '../../../../core/utils/montant';
import { Encadre } from '../../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';
import {
  activerAbonnement,
  finDuSuivi,
  MESSAGE_ATTENTE_LONGUE,
  MESSAGE_ECHEC_MOBILE,
  MESSAGE_RECONNEXION,
  suivrePaiementMobile,
} from './suivi-paiement-mobile';

type EtatRetour = 'attente' | 'reussi' | 'echoue' | 'attente-longue' | 'introuvable' | 'erreur';

/**
 * /admin/abonnement/paiement-mobile?reference=… : URL de retour de Moosyl. Le statut est relu (et suivi tant qu'il
 * est EN_ATTENTE : le webhook peut arriver juste après le retour). Réussi : nouveau jeton (statut dans le jeton) et
 * lien vers le tableau de bord ; échoué : « Réessayer » relance un paiement mobile de la même formule.
 */
@Component({
  selector: 'app-retour-paiement-mobile',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule, Encadre, EntetePage, MessageErreur],
  template: `
    <section class="conteneur-page etroit">
      <app-entete-page titre="Paiement mobile" icone="smartphone" />

      @switch (etat()) {
        @case ('attente') {
          <div class="attente" role="status">
            <mat-spinner diameter="32" aria-hidden="true" />
            <h2 class="titre-etat" tabindex="-1">Paiement en cours…</h2>
            <p>Nous attendons la confirmation de votre paiement. Cette page se met à jour automatiquement.</p>
          </div>
        }

        @case ('reussi') {
          @if (statut(); as s) {
            <div class="succes">
              <span class="icone-succes" aria-hidden="true"><mat-icon fontIcon="check_circle" aria-hidden="true" /></span>
              <h2 class="titre-etat" tabindex="-1">Abonnement activé</h2>
              <p role="status">
                Paiement de {{ montant(s.montant, s.devise) }} reçu : {{ libellesFormule[s.formule] }}
                @if (s.abonnement.dateExpiration; as fin) {
                  active jusqu’au {{ fin | date: 'longDate' }}.
                } @else {
                  active.
                }
              </p>
              <a matButton="filled" class="bouton-principal" routerLink="/admin">Aller au tableau de bord</a>
            </div>
          }
        }

        @case ('echoue') {
          <h2 class="titre-etat visuellement-cache" tabindex="-1">Paiement non abouti</h2>
          <app-encadre type="erreur" role="alert" icone="error"><p>{{ messageEchec }}</p></app-encadre>
          <div class="actions">
            <a matButton="filled" class="bouton-principal" routerLink="/admin/abonnement/souscrire" [queryParams]="parametresReessai()">
              Réessayer
            </a>
          </div>
        }

        @case ('attente-longue') {
          <h2 class="titre-etat visuellement-cache" tabindex="-1">Paiement pas encore confirmé</h2>
          <app-encadre type="avertissement" role="alert" icone="hourglass_top"><p>{{ messageAttente }}</p></app-encadre>
          <div class="actions">
            <button matButton="filled" type="button" class="bouton-principal" (click)="charger()">Vérifier à nouveau</button>
            <a matButton routerLink="/admin/abonnement/souscrire" [queryParams]="parametresReessai()">Réessayer</a>
          </div>
        }

        @case ('introuvable') {
          <h2 class="titre-etat visuellement-cache" tabindex="-1">Paiement introuvable</h2>
          <app-encadre type="erreur" role="alert" icone="search_off">
            <p>
              Ce paiement est introuvable pour votre entreprise. Si vous avez payé, vérifiez votre abonnement ; sinon,
              relancez un paiement.
            </p>
          </app-encadre>
          <div class="actions">
            <a matButton="filled" class="bouton-principal" routerLink="/admin/abonnement/souscrire" [queryParams]="{ moyen: 'mobile' }">
              Payer mon abonnement
            </a>
            <a matButton routerLink="/admin/abonnement">Mon abonnement</a>
          </div>
        }

        @case ('erreur') {
          <h2 class="titre-etat visuellement-cache" tabindex="-1">Statut du paiement indisponible</h2>
          <app-message-erreur [erreur]="erreur()" parDefaut="Le statut du paiement n’a pas pu être lu." />
          <div class="actions">
            <button matButton="filled" type="button" class="bouton-principal" (click)="charger()">Vérifier à nouveau</button>
          </div>
        }
      }
    </section>
  `,
  styles: `
    .attente,
    .succes {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--bt-espace-3);
      padding: var(--bt-espace-6) var(--bt-espace-4);
      text-align: center;

      p {
        margin: 0;
      }
    }

    .titre-etat {
      margin: 0;
      font: var(--mat-sys-headline-small);
    }

    .icone-succes mat-icon {
      width: 56px;
      height: 56px;
      color: var(--bt-succes-texte);
      font-size: 56px;
    }
  `,
})
export class RetourPaiementMobile {
  private readonly service = inject(AbonnementService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly libellesFormule = LIBELLES_FORMULE;
  protected readonly montant = montantEnClair;
  protected readonly messageEchec = MESSAGE_ECHEC_MOBILE;
  protected readonly messageAttente = MESSAGE_ATTENTE_LONGUE;

  /** ?reference= ajouté par Moosyl. */
  readonly reference = input<string | undefined>(undefined);

  protected readonly etat = signal<EtatRetour>('attente');
  protected readonly statut = signal<StatutPaiementMobileResponse | null>(null);
  protected readonly erreur = signal<unknown>(null);

  private suivi: Subscription | null = null;

  constructor() {
    effect(() => {
      this.reference();
      untracked(() => this.charger());
    });
  }

  /** « Réessayer » : un nouveau paiement mobile, même formule si elle est connue. */
  protected parametresReessai(): Record<string, string> {
    const formule = this.statut()?.formule;
    return formule ? { moyen: 'mobile', formule } : { moyen: 'mobile' };
  }

  protected charger(): void {
    this.suivi?.unsubscribe();
    const reference = this.reference()?.trim();
    if (!reference) {
      this.afficher('introuvable');
      return;
    }
    this.etat.set('attente');
    this.erreur.set(null);
    this.suivi = suivrePaiementMobile(this.service, reference, finDuSuivi(null), this.document)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (evenement) => {
          if (evenement.type === 'expire') {
            this.afficher('attente-longue');
            return;
          }
          this.statut.set(evenement.statut);
          if (evenement.statut.statut === 'REUSSI') {
            this.activer(evenement.statut);
          } else if (evenement.statut.statut === 'ECHOUE') {
            this.afficher('echoue');
          }
        },
        error: (erreur: unknown) => {
          if (aLeCode(erreur, 'PAIEMENT_INTROUVABLE')) {
            this.afficher('introuvable');
            return;
          }
          this.erreur.set(erreur);
          this.afficher('erreur');
        },
      });
  }

  private activer(statut: StatutPaiementMobileResponse): void {
    activerAbonnement(this.auth, statut)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sessionAJour) => {
        if (sessionAJour) {
          this.afficher('reussi');
        } else {
          this.auth.terminerSession(MESSAGE_RECONNEXION);
        }
      });
  }

  /** Changement d'état : le focus va sur son titre (lecteurs d'écran, clavier). */
  private afficher(etat: EtatRetour): void {
    this.etat.set(etat);
    afterNextRender(() => this.hote.nativeElement.querySelector<HTMLElement>('.titre-etat')?.focus(), {
      injector: this.injector,
    });
  }
}
