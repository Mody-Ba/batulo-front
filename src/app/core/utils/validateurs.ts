import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

/** Même règle que ReglesMotDePasse côté serveur : 8 caractères au moins, une lettre et un chiffre. */
export const REGEX_MOT_DE_PASSE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
export const TAILLE_MAX_MOT_DE_PASSE = 72;
export const AIDE_MOT_DE_PASSE = 'Au moins 8 caractères, dont une lettre et un chiffre.';

/** Comme @NotBlank côté serveur : un texte fait seulement d'espaces est considéré comme vide. */
export const nonVide: ValidatorFn = (controle: AbstractControl): ValidationErrors | null =>
  typeof controle.value === 'string' && controle.value.length && !controle.value.trim()
    ? { required: true }
    : null;

/** Règle du mot de passe (erreur « motDePasseFaible »), sans contrôler la longueur maximale. */
export const motDePasseRobuste: ValidatorFn = (
  controle: AbstractControl,
): ValidationErrors | null =>
  typeof controle.value === 'string' && controle.value && !REGEX_MOT_DE_PASSE.test(controle.value)
    ? { motDePasseFaible: true }
    : null;

/** Validateurs complets d'un nouveau mot de passe. */
export const VALIDATEURS_NOUVEAU_MOT_DE_PASSE: ValidatorFn[] = [
  Validators.required,
  Validators.maxLength(TAILLE_MAX_MOT_DE_PASSE),
  motDePasseRobuste,
];

/**
 * À poser sur le champ de confirmation : erreur « confirmationDifferente » si sa valeur
 * diffère du champ frère `nomSource`. L'erreur s'affiche ainsi sous le champ (mat-error).
 */
export function identiqueA(nomSource: string): ValidatorFn {
  return (controle: AbstractControl): ValidationErrors | null => {
    const source = controle.parent?.get(nomSource);
    return controle.value && source && controle.value !== source.value
      ? { confirmationDifferente: true }
      : null;
  };
}

/**
 * Revalide la confirmation quand le mot de passe change (sinon l'erreur ne suit pas).
 * À appeler dans un contexte d'injection (constructeur ou initialiseur de champ).
 */
export function revaliderConfirmation(source: AbstractControl, confirmation: AbstractControl): void {
  source.valueChanges
    .pipe(takeUntilDestroyed(inject(DestroyRef)))
    .subscribe(() => confirmation.updateValueAndValidity({ emitEvent: false }));
}
