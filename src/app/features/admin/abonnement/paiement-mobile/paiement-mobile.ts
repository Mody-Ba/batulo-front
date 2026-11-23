import { Component, DOCUMENT, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';
import {
  APPLICATIONS_MOBILES,
  Formule,
  LIBELLES_FORMULE,
  PaiementMobileResponse,
  StatutPaiementMobileResponse,
} from '../../../../core/models/abonnement.model';
import { AbonnementService } from '../../../../core/services/abonnement.service';
import { montantEnClair } from '../../../../core/utils/montant';
import { Encadre } from '../../../../shared/components/encadre/encadre';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';
import { CodeQr } from './code-qr';
import { finDuSuivi, MESSAGE_ECHEC_MOBILE, MESSAGE_EXPIRE_MOBILE, suivrePaiementMobile } from './suivi-paiement-mobile';
import { DateLPipe } from '../../../../core/i18n/formats.pipes';

type EtatPaiementMobile = 'creation' | 'attente' | 'echoue' | 'expire' | 'erreur';

/**
 * Paiement d'une formule par application mobile (Moosyl : Bankily, Masrvi, Sedad…), en MRU :
 * POST /api/abonnements/paiement-mobile, puis code QR de la page de paiement Moosyl et bouton pour l'ouvrir sur ce
 * téléphone, et suivi du statut toutes les 3 s jusqu'au succès, à l'échec ou à l'expiration de la session.
 * Le succès est remis au parent (`reussi`), qui active l'abonnement (nouveau jeton) et affiche la confirmation.
 */
@Component({
  selector: 'app-paiement-mobile',
  imports: [DateLPipe,  MatButtonModule, MatIconModule, MatProgressBarModule, MatProgressSpinnerModule, Encadre, MessageErreur, CodeQr],
  templateUrl: './paiement-mobile.html',
  styleUrl: './paiement-mobile.scss',
})
export class PaiementMobile {
  private readonly service = inject(AbonnementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  protected readonly libellesFormule = LIBELLES_FORMULE;
  protected readonly applications = APPLICATIONS_MOBILES;
  protected readonly montant = montantEnClair;

  readonly formule = input.required<Formule>();
  /** Le paiement a réussi : abonnement activé côté backend. */
  readonly reussi = output<StatutPaiementMobileResponse>();
  readonly changerFormule = output<void>();

  protected readonly etat = signal<EtatPaiementMobile>('creation');
  protected readonly session = signal<PaiementMobileResponse | null>(null);
  protected readonly erreur = signal<unknown>(null);
  protected readonly messageEchec = MESSAGE_ECHEC_MOBILE;
  protected readonly messageExpire = MESSAGE_EXPIRE_MOBILE;

  private suivi: Subscription | null = null;

  constructor() {
    effect(() => {
      const formule = this.formule();
      untracked(() => this.demarrer(formule));
    });
  }

  /** Nouveau paiement (premier essai ou « Réessayer » : une nouvelle session Moosyl). */
  protected demarrer(formule = this.formule()): void {
    this.arreterSuivi();
    this.etat.set('creation');
    this.session.set(null);
    this.erreur.set(null);
    this.service
      .payerMobile(formule)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => {
          this.session.set(session);
          this.etat.set('attente');
          this.suivre(session);
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.etat.set('erreur');
        },
      });
  }

  private suivre(session: PaiementMobileResponse): void {
    this.suivi = suivrePaiementMobile(this.service, session.reference, finDuSuivi(session.expireLe), this.document)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (evenement) => {
          if (evenement.type === 'expire') {
            this.etat.set('expire');
          } else if (evenement.statut.statut === 'REUSSI') {
            this.reussi.emit(evenement.statut);
          } else if (evenement.statut.statut === 'ECHOUE') {
            this.etat.set('echoue');
          }
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.etat.set('erreur');
        },
      });
  }

  private arreterSuivi(): void {
    this.suivi?.unsubscribe();
    this.suivi = null;
  }
}
