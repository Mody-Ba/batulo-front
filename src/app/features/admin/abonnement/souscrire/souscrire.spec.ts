import { HttpErrorResponse } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { LOCALE_ID, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import {
  AbonnementResponse,
  FormuleResponse,
  IntentionPaiementResponse,
} from '../../../../core/models/abonnement.model';
import { AbonnementService } from '../../../../core/services/abonnement.service';
import { abonnementDeTest } from '../../../../testing/donnees-test';
import { AuthService } from '../../../../core/services/auth.service';
import { StripeService } from '../../../../core/services/stripe.service';
import { DELAI_REDIRECTION_MS, MESSAGE_CARTE_INCOMPLETE, MESSAGE_RECONNEXION, Souscrire } from './souscrire';

registerLocaleData(localeFrCa);

const FORMULES: FormuleResponse[] = [
  { formule: 'MENSUEL', libelle: 'Abonnement mensuel', prix: 1, devise: 'CAD', duree: '1 mois' },
  { formule: 'ANNUEL', libelle: 'Abonnement annuel', prix: 2, devise: 'CAD', duree: '1 an' },
];
const INTENTION: IntentionPaiementResponse = {
  paymentIntentId: 'pi_123',
  clientSecret: 'pi_123_secret_abc',
  clePublique: 'pk_test_123',
  formule: 'ANNUEL',
  montant: 2,
  devise: 'CAD',
};

/** Faux élément Stripe : garde les gestionnaires d'événements pour simuler la saisie. */
function fauxElement() {
  const gestionnaires: Record<string, (evenement?: unknown) => void> = {};
  const element = {
    gestionnaires,
    on: vi.fn((nom: string, gestionnaire: (evenement?: unknown) => void) => {
      gestionnaires[nom] = gestionnaire;
      return element;
    }),
    mount: vi.fn(),
    update: vi.fn(),
    destroy: vi.fn(),
  };
  return element;
}

describe('Souscrire (parcours de paiement)', () => {
  let fixture: ComponentFixture<Souscrire>;
  let element: HTMLElement;
  let abonnementService: {
    abonnement: ReturnType<typeof signal<AbonnementResponse | null>>;
    formules: ReturnType<typeof vi.fn>;
    actualiser: ReturnType<typeof vi.fn>;
    creerIntention: ReturnType<typeof vi.fn>;
    confirmer: ReturnType<typeof vi.fn>;
  };
  let auth: {
    utilisateur: ReturnType<typeof signal>;
    mettreAJourStatutAbonnement: ReturnType<typeof vi.fn>;
    rafraichir: ReturnType<typeof vi.fn>;
    terminerSession: ReturnType<typeof vi.fn>;
  };
  let elementsCrees: Record<string, ReturnType<typeof fauxElement>>;
  let stripe: { elements: ReturnType<typeof vi.fn>; confirmCardPayment: ReturnType<typeof vi.fn> };
  let stripeService: { charger: ReturnType<typeof vi.fn> };
  let router: Router;

  /** Laisse finir les promesses (Stripe, intention) puis le rendu. */
  const stable = async () => {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const bouton = (texte: string) =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(texte));
  // Espaces insécables du format fr-CA (« 1,00 $ ») ramenées à des espaces simples.
  const texte = () => (element.textContent ?? '').replace(/\s+/g, ' ');

  async function allerAuPaiement(): Promise<void> {
    fixture.componentRef.setInput('formule', 'ANNUEL');
    await stable();
    bouton('Continuer vers le paiement')!.click();
    await stable();
    await stable();
  }

  async function remplirCarte(): Promise<void> {
    (element.querySelector('input[autocomplete="cc-name"]') as HTMLInputElement).value = 'Awa Diallo';
    element.querySelector('input[autocomplete="cc-name"]')!.dispatchEvent(new Event('input'));
    for (const type of ['cardNumber', 'cardExpiry', 'cardCvc']) {
      elementsCrees[type].gestionnaires['change']({ complete: true });
    }
    await stable();
  }

  async function payer(): Promise<void> {
    bouton('Payer')!.click();
    await stable();
    await stable();
  }

  beforeEach(async () => {
    abonnementService = {
      abonnement: signal<AbonnementResponse | null>(null),
      formules: vi.fn(() => of(FORMULES)),
      actualiser: vi.fn(),
      creerIntention: vi.fn(() => of(INTENTION)),
      confirmer: vi.fn(() =>
        of({ message: 'ok', abonnement: abonnementDeTest({ formule: 'ANNUEL', dateExpiration: '2027-11-09T12:00:00Z' }) }),
      ),
    };
    auth = {
      utilisateur: signal({ courriel: 'awa@test.local' }),
      mettreAJourStatutAbonnement: vi.fn(),
      rafraichir: vi.fn(() => of('nouveau-jeton')),
      terminerSession: vi.fn(),
    };
    elementsCrees = {};
    stripe = {
      elements: vi.fn(() => ({
        create: vi.fn((type: string) => (elementsCrees[type] = fauxElement())),
      })),
      confirmCardPayment: vi.fn(),
    };
    stripeService = { charger: vi.fn(() => Promise.resolve(stripe)) };

    await TestBed.configureTestingModule({
      imports: [Souscrire],
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'fr-CA' },
        { provide: AbonnementService, useValue: abonnementService },
        { provide: AuthService, useValue: auth },
        { provide: StripeService, useValue: stripeService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(Souscrire);
    element = fixture.nativeElement;
  });

  afterEach(() => vi.useRealTimers());

  it('affiche les formules en CAD et présélectionne celle du lien', async () => {
    fixture.componentRef.setInput('formule', 'ANNUEL');
    await stable();
    expect(texte()).toContain('1,00 $');
    expect(texte()).toContain('2,00 $');
    expect(texte()).toContain('Économisez 10,00 $');
    const choisie = element.querySelector('.formule.choisie');
    expect(choisie?.textContent).toContain('Abonnement annuel');
  });

  it('crée l’intention, charge Stripe avec la clé publique et monte les 3 champs de carte', async () => {
    await allerAuPaiement();
    expect(abonnementService.creerIntention).toHaveBeenCalledWith({ formule: 'ANNUEL' });
    expect(stripeService.charger).toHaveBeenCalledWith('pk_test_123');
    expect(Object.keys(elementsCrees).sort()).toEqual(['cardCvc', 'cardExpiry', 'cardNumber']);
    for (const champ of Object.values(elementsCrees)) {
      expect(champ.mount).toHaveBeenCalledTimes(1);
    }
    expect(texte()).toContain('Payer 2,00 $');
  });

  it('refuse de payer tant que la carte est incomplète', async () => {
    await allerAuPaiement();
    await payer();
    expect(stripe.confirmCardPayment).not.toHaveBeenCalled();
    expect(texte()).toContain(MESSAGE_CARTE_INCOMPLETE);
  });

  it('succès : confirmation Stripe, puis Batulo, rafraîchissement du jeton et redirection', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stripe.confirmCardPayment.mockResolvedValue({ paymentIntent: { id: 'pi_123', status: 'succeeded' } });
    await allerAuPaiement();
    await remplirCarte();
    await payer();

    expect(stripe.confirmCardPayment).toHaveBeenCalledWith('pi_123_secret_abc', {
      payment_method: {
        card: elementsCrees['cardNumber'],
        billing_details: { name: 'Awa Diallo', email: 'awa@test.local' },
      },
    });
    expect(abonnementService.confirmer).toHaveBeenCalledWith('pi_123');
    expect(auth.mettreAJourStatutAbonnement).toHaveBeenCalledWith('ACTIF');
    expect(auth.rafraichir).toHaveBeenCalled();
    expect(texte()).toContain('Vous êtes bien abonné');
    expect(texte()).toContain('9 novembre 2027');

    vi.advanceTimersByTime(DELAI_REDIRECTION_MS);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
  });

  it('carte refusée : message en français, Batulo n’est pas appelé', async () => {
    stripe.confirmCardPayment.mockResolvedValue({
      error: { type: 'card_error', code: 'card_declined', decline_code: 'insufficient_funds', message: 'Your card has insufficient funds.' },
    });
    await allerAuPaiement();
    await remplirCarte();
    await payer();

    expect(abonnementService.confirmer).not.toHaveBeenCalled();
    expect(texte()).toContain('Votre carte a été refusée : fonds insuffisants.');
    expect(texte()).not.toContain('insufficient funds');
    expect(bouton('Payer')).toBeTruthy();
  });

  it('payé chez Stripe mais non confirmé par Batulo : pas de second paiement, « Vérifier à nouveau »', async () => {
    stripe.confirmCardPayment.mockResolvedValue({ paymentIntent: { id: 'pi_123', status: 'succeeded' } });
    abonnementService.confirmer.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { code: 'PAIEMENT_NON_REUSSI', message: 'Le paiement n’est pas encore validé par Stripe.' },
          }),
      ),
    );
    await allerAuPaiement();
    await remplirCarte();
    await payer();

    expect(texte()).toContain('Le paiement n’est pas encore validé par Stripe.');
    expect(bouton('Payer')).toBeUndefined();
    expect(texte()).not.toContain('Changer de formule');

    bouton('Vérifier à nouveau')!.click();
    await stable();
    expect(abonnementService.confirmer).toHaveBeenCalledTimes(2);
    expect(stripe.confirmCardPayment).toHaveBeenCalledTimes(1);
    expect(texte()).toContain('Vous êtes bien abonné');
  });

  it('jeton non rafraîchi après le paiement : reconnexion demandée', async () => {
    stripe.confirmCardPayment.mockResolvedValue({ paymentIntent: { id: 'pi_123', status: 'succeeded' } });
    auth.rafraichir.mockReturnValue(throwError(() => new Error('refus')));
    await allerAuPaiement();
    await remplirCarte();
    await payer();

    expect(auth.terminerSession).toHaveBeenCalledWith(MESSAGE_RECONNEXION);
  });

  it('Stripe.js injoignable : message clair, on reste au choix de la formule', async () => {
    stripeService.charger.mockResolvedValue(null);
    await allerAuPaiement();
    expect(texte()).toContain('Le service de paiement est injoignable');
    expect(bouton('Continuer vers le paiement')).toBeTruthy();
  });
});
