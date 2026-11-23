import { localeIntl } from '../i18n/traduire';

/**
 * Montant lisible dans la langue courante (fr-CA, en-CA, arabe en chiffres occidentaux), par Intl (pas de données de locale à charger) : « 1,00 $ » pour le CAD,
 * « 40 MRU » pour l'ouguiya (prix entiers du paiement mobile : sans décimales quand il n'y en a pas).
 * `avecCode` : toujours le code de la devise (« 1,00 CAD »), quand des devises différentes se côtoient.
 */
export function montantEnClair(montant: number, devise: string, avecCode = false): string {
  const code = devise.toUpperCase();
  const entier = Number.isInteger(montant);
  try {
    return new Intl.NumberFormat(localeIntl(), {
      style: 'currency',
      currency: code,
      ...(avecCode || code === 'MRU' ? { currencyDisplay: 'code' } : {}),
      ...(code === 'MRU' ? { minimumFractionDigits: entier ? 0 : 2 } : {}),
    }).format(montant);
  } catch {
    // Code de devise inconnu d'Intl : nombre et code.
    return `${new Intl.NumberFormat(localeIntl()).format(montant)} ${code}`;
  }
}
