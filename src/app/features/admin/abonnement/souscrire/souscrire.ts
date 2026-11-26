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
import { catchError, firstValueFrom, map, of, startWith, switchMap, timer } from 'rxjs';
import {
  Formule,
  formulesAbonnement,
  FormuleResponse,
  offreAchat,
  Offre,
  IntentionPaiementResponse,
  APPLICATIONS_MOBILES,
  LIBELLES_FORMULE,
  MoyenPaiement,
  PaiementConfirmeResponse,
  StatutPaiementMobileResponse,
} from '../../../../core/models/abonnement.model';
import { AbonnementService } from '../../../../core/services/abonnement.service';
import { AuthService } from '../../../../core/services/auth.service';
import { localeStripe, StripeService } from '../../../../core/services/stripe.service';
import {
  messagePaiementInattendu,
  messageStripeIndisponible,
  messageErreurStripe,
} from '../../../../core/utils/stripe-erreurs';
import { montantEnClair } from '../../../../core/utils/montant';
import { nonVide } from '../../../../core/utils/validateurs';
import { bornesAchat, quantiteValide, totalAchat, validateurQuantite } from '../../../../core/utils/achat-sondages';
import { QuantiteSondages } from '../../../../shared/components/quantite-sondages/quantite-sondages';
import { Encadre } from '../../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';
import { PaiementMobile } from '../paiement-mobile/paiement-mobile';
import { activerAbonnement, MESSAGE_RECONNEXION } from '../paiement-mobile/suivi-paiement-mobile';
import { DateLPipe, PlurielPipe } from '../../../../core/i18n/formats.pipes';
import { MontantLPipe } from '../../../../core/i18n/formats.pipes';
import { texteServeur, traduire } from '../../../../core/i18n/traduire';
import { TranslocoPipe } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';

type Etape = 'formule' | 'paiement' | 'mobile' | 'succes';
type ChampCarte = 'numero' | 'expiration' | 'code';

const CHAMPS_VIDES: Record<ChampCarte, string | null> = { numero: null, expiration: null, code: null };
const CHAMPS_INCOMPLETS: Record<ChampCarte, boolean> = { numero: false, expiration: false, code: false };

/** Délai avant la redirection vers le tableau de bord après le paiement. */
export const DELAI_REDIRECTION_MS = 4000;
export const messageCarteIncomplete = (): string => traduire('abonnement.carte.incomplete');
export const messagePaiementEnTraitement = (): string => traduire('abonnement.carte.enTraitement');
export { MESSAGE_RECONNEXION };

/** Choix de l'étape 1 : une formule d'abonnement ou l'achat de sondages à l'unité. */
export type ChoixOffre = Offre;

/** Choix initial : ?offre= / ?formule= de l'URL, sinon l'offre choisie à l'inscription (premier paiement). */
export function choixInitial(
  offre: string | undefined,
  formule: string | undefined,
  offreChoisie: Offre | null | undefined,
): ChoixOffre {
  if (offre === 'ACHAT_SONDAGES') {
    return 'ACHAT_SONDAGES';
  }
  if (formule === 'ANNUEL' || formule === 'MENSUEL') {
    return formule;
  }
  return offreChoisie ?? 'MENSUEL';
}

/**
 * Souscription ou renouvellement :
 * 1. choix de la formule et du moyen de paiement (carte ou application mobile, ?moyen=) ;
 * 2. mobile : PaiementMobile (Moosyl, code QR et suivi du statut), puis nouveau jeton ; carte : intention de paiement (backend) puis carte saisie dans les champs
 * Stripe Elements et confirmation chez Stripe ; 3. confirmation auprès de Batulo (revérifiée chez
 * Stripe), rafraîchissement du jeton (nouveau statut) puis redirection vers le tableau de bord.
 * Les données de carte restent dans les iframes de Stripe : notre code ne les voit jamais.
 */
@Component({
  selector: 'app-souscrire',
  imports: [TranslocoPipe, MontantLPipe, DateLPipe, PlurielPipe, QuantiteSondages,
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
    PaiementMobile,
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
  /** Paramètre ?moyen=carte|mobile (bouton « Réessayer » de la page de retour Moosyl). */
  readonly moyen = input<string | undefined>(undefined);
  /** Paramètre ?offre=ACHAT_SONDAGES (carte « Acheter des sondages », dialogue de publication). */
  readonly offre = input<string | undefined>(undefined);
  /** Paramètre ?quantite= : nombre de sondages à acheter. */
  readonly quantite = input<string | undefined>(undefined);

  protected readonly libellesFormule = LIBELLES_FORMULE;
  protected readonly applications = APPLICATIONS_MOBILES;
  protected readonly montant = montantEnClair;
  protected readonly moyens: readonly { moyen: MoyenPaiement; libelle: string; detail: string; icone: string }[] = [
    { moyen: 'carte', libelle: 'abonnement.souscrire.carte', detail: 'abonnement.souscrire.carteDetail', icone: 'credit_card' },
    {
      moyen: 'mobile',
      libelle: 'abonnement.souscrire.mobile',
      detail: 'abonnement.souscrire.mobileDetail',
      icone: 'smartphone',
    },
  ];
  protected readonly abonnementActuel = this.service.abonnement;

  protected readonly etape = signal<Etape>('formule');
  protected readonly formules = signal<FormuleResponse[]>([]);
  protected readonly chargementFormules = signal(true);
  /**
   * Offre choisie (formule ou achat de sondages). En attente du premier paiement, l'offre de l'inscription est
   * proposée d'abord si l'URL n'en indique pas.
   */
  protected readonly choix = linkedSignal<ChoixOffre>(() => {
    const abonnement = this.abonnementActuel();
    const inscription = abonnement?.statut === 'EN_ATTENTE_PAIEMENT' ? abonnement.offreChoisie : null;
    return choixInitial(this.offre(), this.formule(), inscription);
  });
  protected readonly achat = computed(() => this.choix() === 'ACHAT_SONDAGES');
  /** Formule d'abonnement choisie (MENSUEL par défaut quand l'achat est choisi). */
  protected readonly formuleChoisie = computed<Formule>(() => (this.choix() === 'ANNUEL' ? 'ANNUEL' : 'MENSUEL'));
  protected readonly offreAchat = computed(() => offreAchat(this.formules()));
  protected readonly abonnements = computed(() => formulesAbonnement(this.formules()));
  /** Nombre de sondages à acheter. */
  protected readonly nombreSondages = new FormControl<number | null>(null, {
    validators: [validateurQuantite(() => bornesAchat(this.offreAchat()))],
  });
  private readonly valeurNombre = toSignal(this.nombreSondages.valueChanges.pipe(startWith(this.nombreSondages.value)), {
    initialValue: null,
  });
  protected readonly quantiteAchat = computed(() => {
    const q = this.valeurNombre();
    return quantiteValide(q, bornesAchat(this.offreAchat())) ? q : null;
  });
  /** Total de l'achat pour le moyen choisi (affichage ; le serveur calcule le montant facturé). */
  protected readonly totalAchatMoyen = computed(() => {
    const o = this.offreAchat();
    if (!o) {
      return null;
    }
    const mobile = this.moyenChoisi() === 'mobile';
    const devise = mobile ? o.deviseMobile : o.devise;
    const total = totalAchat(mobile ? o.prixMobile : o.prix, this.quantiteAchat(), devise, bornesAchat(o));
    return total === null ? null : montantEnClair(total, devise);
  });
  protected readonly moyenChoisi = linkedSignal<MoyenPaiement>(() => (this.moyen() === 'mobile' ? 'mobile' : 'carte'));

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
    return !this.achat() && !!abonnement?.formule && abonnement.statut !== 'EN_ATTENTE_PAIEMENT';
  });
  protected readonly titre = computed(() =>
    this.achat()
      ? 'achat.titre'
      : this.renouvellement()
        ? 'abonnement.souscrire.titreRenouveler'
        : 'abonnement.souscrire.titreAbonner',
  );
  /** L'étape 1 peut continuer : formule connue, ou offre d'achat et nombre valide. */
  protected readonly formuleSelectionnee = computed(() =>
    this.achat()
      ? !!this.offreAchat() && this.quantiteAchat() !== null
      : !!this.abonnements().find((f) => f.formule === this.formuleChoisie()),
  );
  /** Économie de la formule annuelle par rapport à 12 mois (0 si aucune), dans la devise du moyen choisi. */
  protected readonly economieAnnuelle = computed(() => {
    const mensuel = this.abonnements().find((f) => f.formule === 'MENSUEL');
    const annuel = this.abonnements().find((f) => f.formule === 'ANNUEL');
    if (!mensuel || !annuel) {
      return 0;
    }
    const [m, a] = this.moyenChoisi() === 'mobile' ? [mensuel.prixMobile, annuel.prixMobile] : [mensuel.prix, annuel.prix];
    return m != null && a != null ? Math.max(Math.round((m * 12 - a) * 100) / 100, 0) : 0;
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

  /** Libellé et durée du serveur en français, traduits dans les autres langues (comme la vitrine). */
  protected libelleFormule(f: FormuleResponse): string {
    return texteServeur(`vitrine.tarifs.libelle.${f.formule}`, f.libelle);
  }

  protected dureeFormule(f: FormuleResponse): string {
    return texteServeur(`vitrine.tarifs.duree.${f.formule}`, f.duree);
  }

  constructor() {
    // Nombre de sondages : ?quantite= de l'URL, sinon celui de l'inscription (premier paiement), sinon 1. Une saisie
    // n'est jamais écrasée.
    effect(() => {
      const url = Number(this.quantite());
      const abonnement = this.abonnementActuel();
      const inscription = abonnement?.statut === 'EN_ATTENTE_PAIEMENT' ? abonnement.nombreSondagesChoisi : null;
      const valeur = this.quantite() && Number.isFinite(url) ? url : (inscription ?? 1);
      if (!this.nombreSondages.dirty && this.nombreSondages.value !== valeur) {
        this.nombreSondages.setValue(valeur);
      }
    });
    // Bornes connues après la lecture de /formules : le contrôle est revalidé.
    effect(() => {
      this.offreAchat();
      this.nombreSondages.updateValueAndValidity();
    });
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

  protected choisir(choix: ChoixOffre): void {
    this.choix.set(choix);
  }

  /** Le moyen choisi est gardé dans l'URL (retour arrière, rechargement). */
  protected choisirMoyen(moyen: MoyenPaiement): void {
    this.moyenChoisi.set(moyen);
    void this.router.navigate([], {
      queryParams: { moyen: moyen === 'mobile' ? 'mobile' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Prix d'une formule pour le moyen choisi : CAD par carte, MRU par application mobile. */
  protected prix(formule: FormuleResponse): string {
    if (this.moyenChoisi() !== 'mobile') {
      return montantEnClair(formule.prix, formule.devise);
    }
    // Backend sans prix mobile (instance pas encore à jour) : pas de prix inventé.
    return formule.prixMobile != null && formule.deviseMobile ? montantEnClair(formule.prixMobile, formule.deviseMobile) : '—';
  }

  /** Devise du moyen choisi (économie annuelle). */
  protected devise(formule: FormuleResponse): string {
    return (this.moyenChoisi() === 'mobile' ? formule.deviseMobile : formule.devise) ?? '';
  }

  /** Étape 1 -> 2 : mobile, le composant PaiementMobile ; carte, intention chez Batulo puis Stripe.js. */
  protected async continuer(): Promise<void> {
    if (this.preparation()) {
      return;
    }
    const quantite = this.quantiteAchat();
    if (this.achat() && quantite === null) {
      this.nombreSondages.markAsTouched();
      return;
    }
    if (this.moyenChoisi() === 'mobile') {
      this.erreur.set(null);
      this.erreurPaiement.set(null);
      this.allerA('mobile');
      return;
    }
    this.preparation.set(true);
    this.erreur.set(null);
    this.erreurPaiement.set(null);

    let intention: IntentionPaiementResponse;
    try {
      intention = await firstValueFrom(
        quantite !== null && this.achat()
          ? this.service.creerIntentionAchat(quantite)
          : this.service.creerIntention({ formule: this.formuleChoisie() }),
      );
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
      this.erreurPaiement.set(messageStripeIndisponible());
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
      this.erreurPaiement.set(messageCarteIncomplete());
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
      this.finPaiementEchoue(messageStripeIndisponible());
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
      this.erreurPaiement.set(messagePaiementEnTraitement());
    } else {
      this.finPaiementEchoue(messagePaiementInattendu());
    }
  }

  /** Bouton « Vérifier à nouveau » (route idempotente côté backend). */
  protected verifier(): void {
    const id = this.paiementAVerifier();
    if (id && !this.paiementEnCours()) {
      this.confirmerAupresDeBatulo(id);
    }
  }

  /** Paiement mobile confirmé par Moosyl : nouveau jeton (nouveau statut), puis la confirmation. */
  protected paiementMobileReussi(statut: StatutPaiementMobileResponse): void {
    activerAbonnement(this.auth, statut)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sessionAJour) => {
        if (!sessionAJour) {
          this.auth.terminerSession(MESSAGE_RECONNEXION);
          return;
        }
        this.afficherSucces({
          message: '',
          abonnement: statut.abonnement,
          type: statut.type,
          quantite: statut.quantite,
          credits: statut.credits,
        });
      });
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
          if (reponse.abonnement) {
            this.auth.mettreAJourStatutAbonnement(reponse.abonnement.statut);
          }
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
          this.detruireChamps();
          this.afficherSucces(reponse);
        },
        error: (erreur: unknown) => {
          this.paiementEnCours.set(false);
          this.erreur.set(erreur);
        },
      });
  }

  private afficherSucces(reponse: PaiementConfirmeResponse): void {
    this.confirmation.set(reponse);
    this.allerA('succes');
    timer(DELAI_REDIRECTION_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.allerAuTableauDeBord());
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
    const elements = stripe.elements({ locale: localeStripe() });
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
    // Message de saisie déjà dans la langue de l'interface (localeStripe).
    this.erreursChamps.update((e) => ({ ...e, [champ]: evenement.error?.message ?? null }));
    this.champsComplets.update((c) => ({ ...c, [champ]: evenement.complete }));
    if (this.erreurPaiement() === messageCarteIncomplete()) {
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
