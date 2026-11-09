import { CurrencyPipe, DatePipe, UpperCasePipe } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import type {
  Stripe,
  StripeCardCvcElement,
  StripeCardExpiryElement,
  StripeCardNumberElement,
  StripeElementChangeEvent,
  StripeElementStyle,
} from '@stripe/stripe-js';
import { catchError, firstValueFrom, map, of, switchMap, timer } from 'rxjs';
import {
  Formule,
  FormuleResponse,
  IntentionPaiementResponse,
  LIBELLES_FORMULE,
  PaiementConfirmeResponse,
} from '../../../../core/models/abonnement.model';
import { AbonnementService } from '../../../../core/services/abonnement.service';
import { AuthService } from '../../../../core/services/auth.service';
import { StripeService } from '../../../../core/services/stripe.service';
import {
  MESSAGE_PAIEMENT_INATTENDU,
  MESSAGE_STRIPE_INDISPONIBLE,
  messageErreurStripe,
} from '../../../../core/utils/stripe-erreurs';
import { nonVide } from '../../../../core/utils/validateurs';
import { Encadre } from '../../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';

type Etape = 'formule' | 'paiement' | 'succes';
type ChampCarte = 'numero' | 'expiration' | 'code';

const CHAMPS_VIDES: Record<ChampCarte, string | null> = { numero: null, expiration: null, code: null };
const CHAMPS_INCOMPLETS: Record<ChampCarte, boolean> = { numero: false, expiration: false, code: false };

/** Délai avant la redirection vers le tableau de bord après le paiement. */
export const DELAI_REDIRECTION_MS = 4000;
export const MESSAGE_CARTE_INCOMPLETE = 'Complétez les informations de la carte.';
export const MESSAGE_PAIEMENT_EN_TRAITEMENT =
  'Votre banque traite encore le paiement. Vérifiez à nouveau dans quelques instants.';
export const MESSAGE_RECONNEXION =
  'Votre paiement est enregistré. Reconnectez-vous pour accéder à Batulo.';

/**
 * Souscription ou renouvellement :
 * 1. choix de la formule ; 2. intention de paiement (backend) puis carte saisie dans les champs
 * Stripe Elements et confirmation chez Stripe ; 3. confirmation auprès de Batulo (revérifiée chez
 * Stripe), rafraîchissement du jeton (nouveau statut) puis redirection vers le tableau de bord.
 * Les données de carte restent dans les iframes de Stripe : notre code ne les voit jamais.
 */
@Component({
  selector: 'app-souscrire',
  imports: [
    CurrencyPipe,
    DatePipe,
    UpperCasePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    EntetePage,
    Encadre,
    MessageErreur,
  ],
  templateUrl: './souscrire.html',
  styleUrl: './souscrire.scss',
})
export class Souscrire {
  private readonly service = inject(AbonnementService);
  private readonly stripeService = inject(StripeService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Paramètre ?formule= (bouton « Renouveler »). */
  readonly formule = input<string | undefined>(undefined);

  protected readonly libellesFormule = LIBELLES_FORMULE;
  protected readonly abonnementActuel = this.service.abonnement;

  protected readonly etape = signal<Etape>('formule');
  protected readonly formules = signal<FormuleResponse[]>([]);
  protected readonly chargementFormules = signal(true);
  protected readonly formuleChoisie = linkedSignal<Formule>(() =>
    this.formule() === 'ANNUEL' ? 'ANNUEL' : 'MENSUEL',
  );

  protected readonly intention = signal<IntentionPaiementResponse | null>(null);
  protected readonly preparation = signal(false);
  protected readonly paiementEnCours = signal(false);
  /** Erreur du backend (formules, intention, confirmation). */
  protected readonly erreur = signal<unknown>(null);
  /** Erreur de Stripe ou de saisie, déjà en français. */
  protected readonly erreurPaiement = signal<string | null>(null);
  /**
   * Paiement réussi chez Stripe mais pas encore confirmé par Batulo : on ne repropose pas la carte
   * (pas de double paiement), seulement « Vérifier à nouveau ».
   */
  protected readonly paiementAVerifier = signal<string | null>(null);
  protected readonly confirmation = signal<PaiementConfirmeResponse | null>(null);

  protected readonly erreursChamps = signal({ ...CHAMPS_VIDES });
  protected readonly champsComplets = signal({ ...CHAMPS_INCOMPLETS });
  protected readonly champActif = signal<ChampCarte | null>(null);
  protected readonly nomTitulaire = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, nonVide, Validators.maxLength(100)],
  });

  protected readonly renouvellement = computed(() => {
    const abonnement = this.abonnementActuel();
    return !!abonnement?.formule && abonnement.statut !== 'EN_ATTENTE_PAIEMENT';
  });
  protected readonly formuleSelectionnee = computed(() =>
    this.formules().find((f) => f.formule === this.formuleChoisie()),
  );
  /** Économie de la formule annuelle par rapport à 12 mois (0 si aucune). */
  protected readonly economieAnnuelle = computed(() => {
    const mensuel = this.formules().find((f) => f.formule === 'MENSUEL');
    const annuel = this.formules().find((f) => f.formule === 'ANNUEL');
    return mensuel && annuel ? Math.max(Math.round((mensuel.prix * 12 - annuel.prix) * 100) / 100, 0) : 0;
  });
  protected readonly modeTest = computed(
    () => this.intention()?.clePublique.startsWith('pk_test_') ?? false,
  );

  private readonly stripe = signal<Stripe | null>(null);
  private numero: StripeCardNumberElement | null = null;
  private expiration: StripeCardExpiryElement | null = null;
  private code: StripeCardCvcElement | null = null;

  private readonly conteneurNumero = viewChild<ElementRef<HTMLElement>>('conteneurNumero');
  private readonly conteneurExpiration = viewChild<ElementRef<HTMLElement>>('conteneurExpiration');
  private readonly conteneurCode = viewChild<ElementRef<HTMLElement>>('conteneurCode');
  private readonly teinteErreur = viewChild<ElementRef<HTMLElement>>('teinteErreur');
  private readonly teinteAttenuee = viewChild<ElementRef<HTMLElement>>('teinteAttenuee');

  constructor() {
    this.chargerFormules();
    // Pour le texte du renouvellement (date à partir de laquelle la période est prolongée).
    this.service.actualiser();

    // Montage des champs Stripe dès que l'étape « paiement » est affichée.
    effect(() => {
      const stripe = this.stripe();
      const numero = this.conteneurNumero();
      const expiration = this.conteneurExpiration();
      const code = this.conteneurCode();
      if (this.etape() === 'paiement' && stripe && numero && expiration && code && !this.numero) {
        this.monterChamps(stripe, numero.nativeElement, expiration.nativeElement, code.nativeElement);
      }
    });

    this.destroyRef.onDestroy(() => this.detruireChamps());
  }

  protected chargerFormules(): void {
    this.chargementFormules.set(true);
    this.erreur.set(null);
    this.service
      .formules()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (formules) => {
          this.formules.set(formules);
          this.chargementFormules.set(false);
        },
        error: (erreur: unknown) => {
          this.chargementFormules.set(false);
          this.erreur.set(erreur);
        },
      });
  }

  protected choisir(formule: Formule): void {
    this.formuleChoisie.set(formule);
  }

  /** Étape 1 -> 2 : intention de paiement chez Batulo, puis chargement de Stripe.js. */
  protected async continuer(): Promise<void> {
    if (this.preparation()) {
      return;
    }
    this.preparation.set(true);
    this.erreur.set(null);
    this.erreurPaiement.set(null);

    let intention: IntentionPaiementResponse;
    try {
      intention = await firstValueFrom(this.service.creerIntention({ formule: this.formuleChoisie() }));
    } catch (erreur) {
      this.preparation.set(false);
      this.erreur.set(erreur);
      return;
    }

    let stripe: Stripe | null = null;
    try {
      stripe = await this.stripeService.charger(intention.clePublique);
    } catch {
      stripe = null;
    }
    this.preparation.set(false);
    if (!stripe) {
      this.erreurPaiement.set(MESSAGE_STRIPE_INDISPONIBLE);
      return;
    }
    this.intention.set(intention);
    this.stripe.set(stripe);
    this.allerA('paiement');
  }

  /** Retour au choix de la formule : une nouvelle intention sera créée. */
  protected changerFormule(): void {
    this.detruireChamps();
    this.intention.set(null);
    this.erreur.set(null);
    this.erreurPaiement.set(null);
    this.allerA('formule');
  }

  /** Confirmation chez Stripe (3-D Secure compris), puis chez Batulo. */
  protected async payer(): Promise<void> {
    const stripe = this.stripe();
    const intention = this.intention();
    if (!stripe || !intention || !this.numero || this.paiementEnCours() || this.paiementAVerifier()) {
      return;
    }
    this.nomTitulaire.markAsTouched();
    const complets = this.champsComplets();
    if (this.nomTitulaire.invalid || !complets.numero || !complets.expiration || !complets.code) {
      this.erreurPaiement.set(MESSAGE_CARTE_INCOMPLETE);
      return;
    }

    this.paiementEnCours.set(true);
    this.erreur.set(null);
    this.erreurPaiement.set(null);
    this.activerChamps(false);

    let resultat: Awaited<ReturnType<Stripe['confirmCardPayment']>>;
    try {
      resultat = await stripe.confirmCardPayment(intention.clientSecret, {
        payment_method: {
          card: this.numero,
          billing_details: {
            name: this.nomTitulaire.value.trim(),
            email: this.auth.utilisateur()?.courriel,
          },
        },
      });
    } catch {
      this.finPaiementEchoue(MESSAGE_STRIPE_INDISPONIBLE);
      return;
    }

    const paymentIntent = resultat.paymentIntent ?? resultat.error?.payment_intent;
    if (paymentIntent?.status === 'succeeded') {
      this.confirmerAupresDeBatulo(paymentIntent.id);
      return;
    }
    if (resultat.error) {
      this.finPaiementEchoue(messageErreurStripe(resultat.error));
    } else if (paymentIntent?.status === 'processing') {
      this.paiementEnCours.set(false);
      this.paiementAVerifier.set(paymentIntent.id);
      this.erreurPaiement.set(MESSAGE_PAIEMENT_EN_TRAITEMENT);
    } else {
      this.finPaiementEchoue(MESSAGE_PAIEMENT_INATTENDU);
    }
  }

  /** Bouton « Vérifier à nouveau » (route idempotente côté backend). */
  protected verifier(): void {
    const id = this.paiementAVerifier();
    if (id && !this.paiementEnCours()) {
      this.confirmerAupresDeBatulo(id);
    }
  }

  protected allerAuTableauDeBord(): void {
    void this.router.navigateByUrl('/admin');
  }

  private confirmerAupresDeBatulo(paymentIntentId: string): void {
    this.paiementEnCours.set(true);
    this.paiementAVerifier.set(paymentIntentId);
    this.erreur.set(null);
    this.erreurPaiement.set(null);

    let reconnexionNecessaire = false;
    this.service
      .confirmer(paymentIntentId)
      .pipe(
        switchMap((reponse) => {
          this.auth.mettreAJourStatutAbonnement(reponse.abonnement.statut);
          // Le statut est écrit dans le jeton : sans nouveau jeton, le backend refuserait encore l'accès.
          return this.auth.rafraichir().pipe(
            map(() => reponse),
            catchError(() => {
              reconnexionNecessaire = true;
              return of(reponse);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (reponse) => {
          this.paiementEnCours.set(false);
          this.paiementAVerifier.set(null);
          if (reconnexionNecessaire) {
            this.auth.terminerSession(MESSAGE_RECONNEXION);
            return;
          }
          this.confirmation.set(reponse);
          this.detruireChamps();
          this.allerA('succes');
          timer(DELAI_REDIRECTION_MS)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.allerAuTableauDeBord());
        },
        error: (erreur: unknown) => {
          this.paiementEnCours.set(false);
          this.erreur.set(erreur);
        },
      });
  }

  private finPaiementEchoue(message: string): void {
    this.paiementEnCours.set(false);
    this.erreurPaiement.set(message);
    this.activerChamps(true);
  }

  private allerA(etape: Etape): void {
    this.etape.set(etape);
    // Lecteurs d'écran et clavier : le focus suit le changement d'étape.
    afterNextRender(
      () => this.hote.nativeElement.querySelector<HTMLElement>('.titre-etape')?.focus(),
      { injector: this.injector },
    );
  }

  private monterChamps(
    stripe: Stripe,
    conteneurNumero: HTMLElement,
    conteneurExpiration: HTMLElement,
    conteneurCode: HTMLElement,
  ): void {
    const style = this.styleStripe();
    const elements = stripe.elements({ locale: 'fr-CA' });
    this.numero = elements.create('cardNumber', { style, showIcon: true });
    this.expiration = elements.create('cardExpiry', { style });
    this.code = elements.create('cardCvc', { style });

    this.numero
      .on('change', (evenement) => this.majChamp('numero', evenement))
      .on('focus', () => this.champActif.set('numero'))
      .on('blur', () => this.champActif.set(null))
      .mount(conteneurNumero);
    this.expiration
      .on('change', (evenement) => this.majChamp('expiration', evenement))
      .on('focus', () => this.champActif.set('expiration'))
      .on('blur', () => this.champActif.set(null))
      .mount(conteneurExpiration);
    this.code
      .on('change', (evenement) => this.majChamp('code', evenement))
      .on('focus', () => this.champActif.set('code'))
      .on('blur', () => this.champActif.set(null))
      .mount(conteneurCode);
  }

  private majChamp(champ: ChampCarte, evenement: StripeElementChangeEvent): void {
    // Message de saisie déjà en français (locale fr-CA).
    this.erreursChamps.update((e) => ({ ...e, [champ]: evenement.error?.message ?? null }));
    this.champsComplets.update((c) => ({ ...c, [champ]: evenement.complete }));
    if (this.erreurPaiement() === MESSAGE_CARTE_INCOMPLETE) {
      this.erreurPaiement.set(null);
    }
  }

  private activerChamps(actifs: boolean): void {
    this.numero?.update({ disabled: !actifs });
    this.expiration?.update({ disabled: !actifs });
    this.code?.update({ disabled: !actifs });
    if (actifs) {
      this.nomTitulaire.enable();
    } else {
      this.nomTitulaire.disable();
    }
  }

  private detruireChamps(): void {
    for (const element of [this.numero, this.expiration, this.code]) {
      element?.destroy();
    }
    this.numero = this.expiration = this.code = null;
    this.erreursChamps.set({ ...CHAMPS_VIDES });
    this.champsComplets.set({ ...CHAMPS_INCOMPLETS });
    this.champActif.set(null);
    this.nomTitulaire.enable();
  }

  /**
   * Les champs Stripe sont dans des iframes : ils ne voient pas nos variables CSS. On leur passe les
   * couleurs calculées du thème (clair ou sombre).
   */
  private styleStripe(): StripeElementStyle {
    const couleur = (element: HTMLElement | undefined) =>
      element ? getComputedStyle(element).color : undefined;
    return {
      base: {
        color: couleur(this.hote.nativeElement),
        fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
        fontSize: '16px',
        fontSmoothing: 'antialiased',
        iconColor: couleur(this.teinteAttenuee()?.nativeElement),
        '::placeholder': { color: couleur(this.teinteAttenuee()?.nativeElement) },
      },
      invalid: {
        color: couleur(this.teinteErreur()?.nativeElement),
        iconColor: couleur(this.teinteErreur()?.nativeElement),
      },
    };
  }
}
