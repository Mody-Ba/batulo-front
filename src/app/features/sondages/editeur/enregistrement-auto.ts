import { DestroyRef, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { debounceTime, Observable } from 'rxjs';

/** Délai après la dernière frappe avant l'enregistrement automatique. */
export const DELAI_ENREGISTREMENT_MS = 800;

/**
 * - enregistre : rien à envoyer ;
 * - modifie : saisie pas encore envoyée ;
 * - invalide : saisie à corriger, rien n'est envoyé ;
 * - enregistrement : envoi en cours ;
 * - erreur : le serveur a refusé (message dans `erreur`).
 */
export type EtatEnregistrement = 'enregistre' | 'modifie' | 'invalide' | 'enregistrement' | 'erreur';

export interface OptionsEnregistrementAuto<T> {
  formulaire: AbstractControl;
  /** Requête construite depuis le formulaire (appelée seulement s'il est valide). */
  requete: () => T;
  envoyer: (requete: T) => Observable<unknown>;
  /** Ce qui est déjà enregistré (null : rien encore, par exemple une nouvelle question). */
  enregistree: T | null;
  destroyRef: DestroyRef;
  delaiMs?: number;
}

/**
 * Enregistrement automatique d'un formulaire : DELAI_ENREGISTREMENT_MS après la dernière modification, ou tout de
 * suite avec `maintenant()` (sortie du champ). Une saisie invalide n'est pas envoyée (ses erreurs s'affichent) ;
 * l'enregistrement reprend dès qu'elle est corrigée. Une requête identique à la dernière enregistrée n'est pas
 * renvoyée ; une modification pendant un envoi est envoyée juste après.
 */
export class EnregistrementAuto<T> {
  readonly etat = signal<EtatEnregistrement>('enregistre');
  /** Dernier refus du serveur ; effacé au prochain envoi. */
  readonly erreur = signal<unknown>(null);

  private derniere: string | null;
  private enVol = false;
  private aRenvoyer = false;
  /** Modifié depuis le dernier envoi. */
  private modifie = false;

  constructor(private readonly options: OptionsEnregistrementAuto<T>) {
    this.derniere = options.enregistree === null ? null : JSON.stringify(options.enregistree);
    if (options.enregistree === null) {
      this.modifie = true;
      this.etat.set('modifie');
    }
    options.formulaire.valueChanges.pipe(takeUntilDestroyed(options.destroyRef)).subscribe(() => {
      this.modifie = true;
      if (!this.enVol) {
        this.etat.set('modifie');
      }
    });
    options.formulaire.valueChanges
      .pipe(debounceTime(options.delaiMs ?? DELAI_ENREGISTREMENT_MS), takeUntilDestroyed(options.destroyRef))
      .subscribe(() => this.enregistrer());
  }

  /** Enregistre tout de suite ce qui ne l'est pas (sortie du champ, « Réessayer »). */
  maintenant(): void {
    if (this.modifie || this.etat() === 'erreur' || this.etat() === 'invalide') {
      this.enregistrer();
    }
  }

  private enregistrer(): void {
    const formulaire = this.options.formulaire;
    if (formulaire.disabled) {
      return;
    }
    if (formulaire.invalid) {
      formulaire.markAllAsTouched();
      if (!this.enVol) {
        this.etat.set('invalide');
      }
      return;
    }
    const requete = this.options.requete();
    const cle = JSON.stringify(requete);
    if (cle === this.derniere && !this.enVol) {
      this.modifie = false;
      this.erreur.set(null);
      this.etat.set('enregistre');
      return;
    }
    if (this.enVol) {
      this.aRenvoyer = true;
      return;
    }
    this.enVol = true;
    this.modifie = false;
    this.erreur.set(null);
    this.etat.set('enregistrement');
    this.options
      .envoyer(requete)
      .pipe(takeUntilDestroyed(this.options.destroyRef))
      .subscribe({
        next: () => {
          // `envoyer` a pu reporter dans le formulaire ce que le serveur a ajouté (ids des options créées) : sans
          // modification entre-temps, la requête actuelle devient la référence (pas de renvoi inutile).
          this.derniere =
            this.modifie || this.options.formulaire.invalid ? cle : JSON.stringify(this.options.requete());
        },
        error: (erreur: unknown) => {
          this.enVol = false;
          this.aRenvoyer = false;
          this.modifie = true;
          this.erreur.set(erreur);
          this.etat.set('erreur');
        },
        complete: () => {
          if (!this.enVol) {
            return;
          }
          this.enVol = false;
          if (this.aRenvoyer) {
            this.aRenvoyer = false;
            this.enregistrer();
          } else {
            this.etat.set(this.modifie ? 'modifie' : 'enregistre');
          }
        },
      });
  }
}
