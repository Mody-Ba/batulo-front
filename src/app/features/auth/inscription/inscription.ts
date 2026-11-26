import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import {
  FormuleAbonnement,
  formulesAbonnement,
  FormuleResponse,
  Offre,
  offreAchat,
} from '../../../core/models/abonnement.model';
import { InscriptionRequest } from '../../../core/models/inscription.model';
import { AbonnementService } from '../../../core/services/abonnement.service';
import { AuthService } from '../../../core/services/auth.service';
import { bornesAchat, validateurQuantite } from '../../../core/utils/achat-sondages';
import { montantEnClair } from '../../../core/utils/montant';
import { QuantiteSondages } from '../../../shared/components/quantite-sondages/quantite-sondages';
import { InscriptionService } from '../../../core/services/inscription.service';
import {
  AIDE_MOT_DE_PASSE,
  identiqueA,
  nonVide,
  revaliderConfirmation,
  VALIDATEURS_NOUVEAU_MOT_DE_PASSE,
} from '../../../core/utils/validateurs';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';
import { SelecteurLangue } from '../../../shared/components/selecteur-langue/selecteur-langue';
import { TranslocoPipe } from '@jsverse/transloco';
import { texteServeur, traduire } from '../../../core/i18n/traduire';

/** Offres proposées à l'inscription, dans l'ordre d'affichage. */
export const OFFRES: readonly Offre[] = ['MENSUEL', 'ANNUEL', 'ACHAT_SONDAGES'];

/**
 * Inscription de l'admin d'une entreprise, avec le choix de l'offre (Mensuel, Annuel ou achat de sondages, nombre et
 * total en direct). Le backend crée l'entreprise, le compte et un abonnement en attente de paiement, et retient l'offre
 * (aucun paiement) ; on connecte ensuite le compte automatiquement, ce qui mène à la souscription préremplie.
 * ?offre=MENSUEL|ANNUEL|ACHAT_SONDAGES (liens de la vitrine) présélectionne l'offre.
 */
@Component({
  selector: 'app-inscription',
  imports: [TranslocoPipe, SelecteurLangue, ReactiveFormsModule, QuantiteSondages,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MessageErreur,
  ],
  templateUrl: './inscription.html',
  styleUrls: ['../auth-formulaire.scss', './inscription.scss'],
  host: { class: 'page-auth' },
})
export class Inscription {
  private readonly auth = inject(AuthService);
  private readonly inscriptionService = inject(InscriptionService);
  private readonly router = inject(Router);
  private readonly abonnements = inject(AbonnementService);

  protected readonly aideMotDePasse = AIDE_MOT_DE_PASSE;
  protected readonly offres = OFFRES;

  /** ?offre= de la vitrine. */
  readonly offre = input<string | undefined>(undefined);

  /** Tarifs de /formules (route publique) ; sans eux, le choix reste possible, sans prix. */
  protected readonly formules = signal<FormuleResponse[]>([]);
  protected readonly offreAchat = computed(() => offreAchat(this.formules()) ?? null);
  private readonly parFormule = computed(
    () => new Map<Offre, FormuleAbonnement>(formulesAbonnement(this.formules()).map((f) => [f.formule, f])),
  );
  protected readonly offreChoisie = signal<Offre>('MENSUEL');
  protected readonly nombreSondages = new FormControl<number | null>(1, {
    validators: [validateurQuantite(() => bornesAchat(this.offreAchat()))],
  });

  protected readonly formulaire = inject(NonNullableFormBuilder).group({
    prenom: ['', [Validators.required, nonVide, Validators.maxLength(100)]],
    nom: ['', [Validators.required, nonVide, Validators.maxLength(100)]],
    courriel: ['', [Validators.required, nonVide, Validators.email, Validators.maxLength(255)]],
    nomEntreprise: ['', [Validators.maxLength(150)]],
    motDePasse: ['', VALIDATEURS_NOUVEAU_MOT_DE_PASSE],
    confirmationMotDePasse: ['', [Validators.required, identiqueA('motDePasse')]],
  });

  protected readonly enCours = signal(false);
  protected readonly erreur = signal<unknown>(null);
  protected readonly motDePasseVisible = signal(false);

  constructor() {
    effect(() => {
      const offre = this.offre();
      if (offre === 'MENSUEL' || offre === 'ANNUEL' || offre === 'ACHAT_SONDAGES') {
        this.offreChoisie.set(offre);
      }
    });
    this.abonnements
      .formules()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (formules) => {
          this.formules.set(formules);
          this.nombreSondages.updateValueAndValidity();
        },
        error: () => this.formules.set([]),
      });
    revaliderConfirmation(
      this.formulaire.controls.motDePasse,
      this.formulaire.controls.confirmationMotDePasse,
    );
  }

  /** Libellé d'une offre (abonnement : celui du serveur, traduit ; achat : texte du front). */
  protected libelleOffre(offre: Offre): string {
    if (offre === 'ACHAT_SONDAGES') {
      return traduire('achat.libelle');
    }
    const formule = this.parFormule().get(offre);
    return formule ? texteServeur(`vitrine.tarifs.libelle.${offre}`, formule.libelle) : traduire(`vitrine.tarifs.libelle.${offre}`);
  }

  /** « 9,99 $ · 400 MRU / 1 mois » ; vide si les tarifs ne sont pas connus. */
  protected prixOffre(offre: Offre): string {
    const f = offre === 'ACHAT_SONDAGES' ? this.offreAchat() : this.parFormule().get(offre);
    if (!f) {
      return '';
    }
    const prix = [montantEnClair(f.prix, f.devise)];
    if (f.prixMobile != null && f.deviseMobile) {
      prix.push(montantEnClair(f.prixMobile, f.deviseMobile));
    }
    return offre === 'ACHAT_SONDAGES'
      ? `${prix.join(' · ')} ${traduire('achat.parSondage')}`
      : `${prix.join(' · ')} / ${texteServeur(`vitrine.tarifs.duree.${offre}`, f.duree)}`;
  }

  protected inscrire(): void {
    const achat = this.offreChoisie() === 'ACHAT_SONDAGES';
    if (this.formulaire.invalid || (achat && this.nombreSondages.invalid) || this.enCours()) {
      this.formulaire.markAllAsTouched();
      this.nombreSondages.markAsTouched();
      return;
    }
    this.enCours.set(true);
    this.erreur.set(null);

    const valeurs = this.formulaire.getRawValue();
    const nomEntreprise = valeurs.nomEntreprise.trim();
    const demande: InscriptionRequest = {
      prenom: valeurs.prenom.trim(),
      nom: valeurs.nom.trim(),
      courriel: valeurs.courriel.trim(),
      motDePasse: valeurs.motDePasse,
      confirmationMotDePasse: valeurs.confirmationMotDePasse,
      ...(nomEntreprise ? { nomEntreprise } : {}),
      offre: this.offreChoisie(),
      ...(achat && this.nombreSondages.value !== null ? { nombreSondages: this.nombreSondages.value } : {}),
    };

    let compteCree = false;
    this.inscriptionService
      .inscrire(demande)
      .pipe(
        switchMap(() => {
          compteCree = true;
          return this.auth.connexion({ courriel: demande.courriel, motDePasse: demande.motDePasse });
        }),
      )
      .subscribe({
        next: () => {
          this.enCours.set(false);
          void this.router.navigateByUrl(this.auth.urlAccueil());
        },
        error: (erreur: unknown) => {
          this.enCours.set(false);
          if (compteCree) {
            // Compte créé, connexion automatique impossible : on laisse l'utilisateur se connecter.
            this.auth.preparerMessageConnexion(
              'auth.inscription.compteCree',
            );
            void this.router.navigateByUrl('/connexion');
            return;
          }
          this.erreur.set(erreur);
        },
      });
  }
}
