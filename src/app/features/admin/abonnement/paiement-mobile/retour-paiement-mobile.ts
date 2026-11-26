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
  messageAttenteLongue,
  messageEchecMobile,
  MESSAGE_RECONNEXION,
  suivrePaiementMobile,
} from './suivi-paiement-mobile';
import { DateLPipe, PlurielPipe } from '../../../../core/i18n/formats.pipes';
import { TranslocoPipe } from '@jsverse/transloco';

type EtatRetour = 'attente' | 'reussi' | 'echoue' | 'attente-longue' | 'introuvable' | 'erreur';

/**
 * /admin/abonnement/paiement-mobile?reference=… : URL de retour de Moosyl. Le statut est relu (et suivi tant qu'il
 * est EN_ATTENTE : le webhook peut arriver juste après le retour). Réussi : nouveau jeton (statut dans le jeton) et
 * lien vers le tableau de bord ; échoué : « Réessayer » relance un paiement mobile de la même formule.
 */
@Component({
  selector: 'app-retour-paiement-mobile',
  imports: [TranslocoPipe, DateLPipe, PlurielPipe, RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule, Encadre, EntetePage, MessageErreur],
  template: `
    <section class="conteneur-page etroit">
      <app-entete-page [titre]="'abonnement.retour.titre' | transloco" icone="smartphone" />

      @switch (etat()) {
        @case ('attente') {
          <div class="attente" role="status">
            <mat-spinner diameter="32" aria-hidden="true" />
            <h2 class="titre-etat" tabindex="-1">{{ 'abonnement.retour.enCours' | transloco }}</h2>
            <p>{{ 'abonnement.retour.attente' | transloco }}</p>
          </div>
        }

        @case ('reussi') {
          @if (statut(); as s) {
            <div class="succes">
              <span class="icone-succes" aria-hidden="true"><mat-icon fontIcon="check_circle" aria-hidden="true" /></span>
              @if (s.type === 'ACHAT_SONDAGES') {
                <h2 class="titre-etat" tabindex="-1">{{ 'achat.succes.titre' | transloco }}</h2>
                <p role="status">
                  {{ 'abonnement.retour.recu' | transloco: { montant: montant(s.montant, s.devise) } }}
                  {{ 'achat.succes.ajoutes' | pluriel: s.quantite ?? 0 }}
                  @if (s.credits; as c) {
                    {{ 'achat.disponibles' | transloco: { nombre: c.solde } }}
                  }
                </p>
              } @else {
                <h2 class="titre-etat" tabindex="-1">{{ 'abonnement.retour.active' | transloco }}</h2>
                <p role="status">
                  {{ 'abonnement.retour.recu' | transloco: { montant: montant(s.montant, s.devise) } }}
                  @if (s.formule; as formule) {
                    @if (s.abonnement?.dateExpiration; as fin) {
                      {{ 'abonnement.succes.activeJusquau' | transloco: { formule: libellesFormule[formule], date: (fin | dateL: 'longDate') } }}
                    } @else {
                      {{ 'abonnement.succes.active' | transloco: { formule: libellesFormule[formule] } }}
                    }
                  }
                </p>
              }
              <a matButton="filled" class="bouton-principal" routerLink="/admin">{{ 'abonnement.succes.allerTdb' | transloco }}</a>
            </div>
          }
        }

        @case ('echoue') {
          <h2 class="titre-etat visuellement-cache" tabindex="-1">{{ 'abonnement.retour.nonAbouti' | transloco }}</h2>
          <app-encadre type="erreur" role="alert" icone="error"><p>{{ messageEchec() }}</p></app-encadre>
          <div class="actions">
            <a matButton="filled" class="bouton-principal" routerLink="/admin/abonnement/souscrire" [queryParams]="parametresReessai()">
              {{ 'commun.reessayer' | transloco }}
            </a>
          </div>
        }

        @case ('attente-longue') {
          <h2 class="titre-etat visuellement-cache" tabindex="-1">{{ 'abonnement.retour.pasConfirme' | transloco }}</h2>
          <app-encadre type="avertissement" role="alert" icone="hourglass_top"><p>{{ messageAttente() }}</p></app-encadre>
          <div class="actions">
            <button matButton="filled" type="button" class="bouton-principal" (click)="charger()">{{ 'abonnement.verifierANouveau' | transloco }}</button>
            <a matButton routerLink="/admin/abonnement/souscrire" [queryParams]="parametresReessai()">{{ 'commun.reessayer' | transloco }}</a>
          </div>
        }

        @case ('introuvable') {
          <h2 class="titre-etat visuellement-cache" tabindex="-1">{{ 'abonnement.retour.introuvable' | transloco }}</h2>
          <app-encadre type="erreur" role="alert" icone="search_off">
            <p>{{ 'abonnement.retour.introuvableTexte' | transloco }}</p>
          </app-encadre>
          <div class="actions">
            <a matButton="filled" class="bouton-principal" routerLink="/admin/abonnement/souscrire" [queryParams]="{ moyen: 'mobile' }">
              {{ 'abonnement.retour.payer' | transloco }}
            </a>
            <a matButton routerLink="/admin/abonnement">{{ 'abonnement.mon.titre' | transloco }}</a>
          </div>
        }

        @case ('erreur') {
          <h2 class="titre-etat visuellement-cache" tabindex="-1">{{ 'abonnement.retour.statutIndisponible' | transloco }}</h2>
          <app-message-erreur [erreur]="erreur()" [parDefaut]="'abonnement.retour.erreurStatut' | transloco" />
          <div class="actions">
            <button matButton="filled" type="button" class="bouton-principal" (click)="charger()">{{ 'abonnement.verifierANouveau' | transloco }}</button>
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
  protected readonly messageEchec = messageEchecMobile;
  protected readonly messageAttente = messageAttenteLongue;

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

  /** « Réessayer » : un nouveau paiement mobile, même formule (ou même achat de sondages) si elle est connue. */
  protected parametresReessai(): Record<string, string> {
    const statut = this.statut();
    if (statut?.type === 'ACHAT_SONDAGES') {
      return { moyen: 'mobile', offre: 'ACHAT_SONDAGES', ...(statut.quantite ? { quantite: String(statut.quantite) } : {}) };
    }
    const formule = statut?.formule;
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
