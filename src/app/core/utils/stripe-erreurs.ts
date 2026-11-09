import type { StripeError } from '@stripe/stripe-js';

export const MESSAGE_STRIPE_INDISPONIBLE =
  'Le service de paiement est injoignable. Vérifiez votre connexion (ou un bloqueur de publicité) puis réessayez.';
export const MESSAGE_PAIEMENT_INATTENDU =
  'Le paiement n’a pas pu être effectué. Aucun montant n’a été prélevé. Réessayez ou utilisez une autre carte.';

/** Raison du refus donnée par la banque (decline_code). */
const MESSAGES_REFUS: Record<string, string> = {
  insufficient_funds: 'Votre carte a été refusée : fonds insuffisants.',
  lost_card: 'Votre carte a été refusée : elle est déclarée perdue.',
  stolen_card: 'Votre carte a été refusée : elle est déclarée volée.',
  expired_card: 'Votre carte est expirée.',
  incorrect_cvc: 'Le code de sécurité de la carte est incorrect.',
  incorrect_number: 'Le numéro de carte est incorrect.',
  processing_error: 'Une erreur est survenue pendant le traitement de la carte. Réessayez.',
  card_velocity_exceeded: 'Votre carte a été refusée : la limite de dépenses est atteinte.',
  do_not_honor: 'Votre carte a été refusée par votre banque. Contactez-la ou utilisez une autre carte.',
  fraudulent: 'Votre carte a été refusée. Contactez votre banque ou utilisez une autre carte.',
  generic_decline: 'Votre carte a été refusée. Contactez votre banque ou utilisez une autre carte.',
};

/** Code de l'erreur Stripe (code). */
const MESSAGES_CODE: Record<string, string> = {
  expired_card: 'Votre carte est expirée.',
  incorrect_cvc: 'Le code de sécurité de la carte est incorrect.',
  invalid_cvc: 'Le code de sécurité de la carte n’est pas valide.',
  incorrect_number: 'Le numéro de carte est incorrect.',
  invalid_number: 'Le numéro de carte n’est pas valide.',
  invalid_expiry_month: 'Le mois d’expiration n’est pas valide.',
  invalid_expiry_year: 'L’année d’expiration n’est pas valide.',
  incomplete_number: 'Le numéro de carte est incomplet.',
  incomplete_expiry: 'La date d’expiration est incomplète.',
  incomplete_cvc: 'Le code de sécurité est incomplet.',
  processing_error: 'Une erreur est survenue pendant le traitement de la carte. Réessayez.',
  authentication_required:
    'Votre banque demande une vérification (3-D Secure). Réessayez et suivez ses instructions.',
  payment_intent_authentication_failure:
    'La vérification de votre banque (3-D Secure) a échoué ou a été annulée. Aucun montant n’a été prélevé.',
  payment_intent_payment_attempt_failed:
    'Le paiement a échoué. Aucun montant n’a été prélevé. Réessayez ou utilisez une autre carte.',
  payment_intent_unexpected_state:
    'Ce paiement a déjà été traité ou n’est plus valable. Rechargez la page pour recommencer.',
  rate_limit: 'Trop de tentatives de paiement. Patientez un instant puis réessayez.',
};

/**
 * Erreur de Stripe.js -> message français. Ordre : raison du refus bancaire, code de l'erreur,
 * puis message de Stripe (déjà en français grâce à locale fr-CA) pour les erreurs de saisie.
 */
export function messageErreurStripe(erreur: StripeError | null | undefined): string {
  if (!erreur) {
    return MESSAGE_PAIEMENT_INATTENDU;
  }
  if (erreur.type === 'api_connection_error') {
    return MESSAGE_STRIPE_INDISPONIBLE;
  }
  if (erreur.code === 'card_declined') {
    const raison = erreur.decline_code ? MESSAGES_REFUS[erreur.decline_code] : undefined;
    return raison ?? MESSAGES_REFUS['generic_decline'];
  }
  if (erreur.code && MESSAGES_CODE[erreur.code]) {
    return MESSAGES_CODE[erreur.code];
  }
  if (erreur.type === 'validation_error' && erreur.message) {
    return erreur.message;
  }
  return MESSAGE_PAIEMENT_INATTENDU;
}
