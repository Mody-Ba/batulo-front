import { Component, computed, DestroyRef, effect, inject, Injector, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  ConfigurationCritere,
  ConfigurationNumerique,
  CritereRequest,
  GranulariteCritere,
  QuestionResponse,
} from '../../../../core/models/sondage.model';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';
import { EditeurSondageStore } from '../editeur-sondage.store';
import { EnregistrementAuto } from '../enregistrement-auto';
import { EtatEnregistrementIndicateur } from '../etat-enregistrement/etat-enregistrement';

/** Nombre de bornes de tranches accepté par le backend (1 à 19, soit 2 à 20 tranches). */
export const TRANCHES_MAX = 19;

type ModeTranches = 'egales' | 'personnalisees';

/** Bornes strictement croissantes, de 1 à 19. Erreurs : « nombreBornes », « bornesNonCroissantes ». */
function bornesValides(controle: AbstractControl): ValidationErrors | null {
  const valeurs = (controle as FormArray<FormControl<number | null>>).controls.map((c) => c.value);
  if (valeurs.length < 1 || valeurs.length > TRANCHES_MAX) {
    return { nombreBornes: true };
  }
  for (let i = 1; i < valeurs.length; i++) {
    const avant = valeurs[i - 1];
    const borne = valeurs[i];
    if (avant !== null && borne !== null && borne <= avant) {
      return { bornesNonCroissantes: true };
    }
  }
  return null;
}

/**
 * Critère d'analyse d'une question CHOIX_UNIQUE, OUI_NON, NUMERIQUE ou DATE (segmentation des statistiques) :
 * interrupteur, tranches pour NUMERIQUE (5 tranches égales entre min et max, ou bornes personnalisées), granularité
 * pour DATE. Enregistré à part du contenu (PUT .../critere), donc modifiable même après publication ; jamais montré
 * au répondant.
 */
@Component({
  selector: 'app-critere-question',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    MessageErreur,
    EtatEnregistrementIndicateur,
  ],
  templateUrl: './critere-question.html',
  styleUrl: './critere-question.scss',
})
export class CritereQuestion implements OnInit {
  protected readonly store = inject(EditeurSondageStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  protected readonly tranchesMax = TRANCHES_MAX;

  /** Question telle qu'enregistrée (type et critère actuels). */
  readonly question = input.required<QuestionResponse>();

  protected readonly formulaire = new FormGroup({
    estCritere: new FormControl(false, { nonNullable: true }),
    modeTranches: new FormControl<ModeTranches>('egales', { nonNullable: true }),
    bornes: new FormArray<FormControl<number | null>>([], bornesValides),
    granularite: new FormControl<GranulariteCritere>('MOIS', { nonNullable: true }),
  });
  protected auto!: EnregistrementAuto<CritereRequest>;
  /** Valeurs du formulaire, pour l'affichage (mises à jour à l'initialisation puis à chaque changement). */
  private readonly valeurs = signal(this.formulaire.getRawValue());
  protected readonly actif = computed(() => !!this.valeurs().estCritere);
  protected readonly personnalisees = computed(() => this.valeurs().modeTranches === 'personnalisees');
  /** Tranches égales impossibles sans min et max (le backend refuse). */
  protected readonly sansBornesQuestion = computed(() => {
    const c = this.question().configuration as Partial<ConfigurationNumerique>;
    return c.min === undefined || c.max === undefined;
  });

  ngOnInit(): void {
    const question = this.question();
    const config = (question.critereConfig ?? {}) as ConfigurationCritere;
    const bornes = config.tranches ?? [];
    bornes.forEach((b) => this.formulaire.controls.bornes.push(this.creerBorne(b), { emitEvent: false }));
    this.formulaire.patchValue(
      {
        estCritere: question.estCritere,
        modeTranches: bornes.length ? 'personnalisees' : 'egales',
        granularite: config.granularite ?? 'MOIS',
      },
      { emitEvent: false },
    );
    this.majValidation();
    this.valeurs.set(this.formulaire.getRawValue());
    this.formulaire.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.valeurs.set(this.formulaire.getRawValue()));
    this.auto = new EnregistrementAuto<CritereRequest>({
      formulaire: this.formulaire,
      requete: () => this.requete(),
      envoyer: (requete) => this.store.definirCritere(this.question().id, requete),
      enregistree: this.requete(),
      destroyRef: this.destroyRef,
    });
    effect(
      () => {
        if (this.store.criteresModifiables()) {
          this.formulaire.enable({ emitEvent: false });
        } else {
          this.formulaire.disable({ emitEvent: false });
        }
        this.majValidation();
      },
      { injector: this.injector },
    );
    const cle = `critere-${question.id}`;
    effect(() => this.store.signalerEtat(cle, this.auto.etat()), { injector: this.injector });
    this.destroyRef.onDestroy(() => this.store.oublierEtat(cle));
  }

  /** Interrupteur, mode, granularité : enregistrés tout de suite. */
  protected changementImmediat(): void {
    this.majValidation();
    this.auto.maintenant();
  }

  protected passerAuxBornes(mode: ModeTranches): void {
    if (mode === 'personnalisees' && this.formulaire.controls.bornes.length === 0) {
      this.proposerBornes();
    }
    this.formulaire.controls.modeTranches.setValue(mode);
    this.changementImmediat();
  }

  protected ajouterBorne(): void {
    const bornes = this.formulaire.controls.bornes;
    if (bornes.length < TRANCHES_MAX) {
      const derniere = bornes.at(bornes.length - 1)?.value;
      bornes.push(this.creerBorne(derniere !== null && derniere !== undefined ? derniere + 10 : null));
    }
  }

  protected supprimerBorne(index: number): void {
    this.formulaire.controls.bornes.removeAt(index);
  }

  protected erreurBornes(): string | null {
    const bornes = this.formulaire.controls.bornes;
    if (bornes.hasError('nombreBornes')) {
      return `De 1 à ${TRANCHES_MAX} bornes.`;
    }
    if (bornes.hasError('bornesNonCroissantes')) {
      return 'Les bornes doivent être strictement croissantes.';
    }
    return null;
  }

  /** Libellé des tranches obtenues, ex. « moins de 18 · 18 à 30 · 30 et plus ». */
  protected apercuTranches(): string {
    const bornes = this.formulaire.controls.bornes.controls.map((c) => c.value).filter((b): b is number => b !== null);
    if (!bornes.length) {
      return '';
    }
    const tranches = [`moins de ${bornes[0]}`];
    for (let i = 1; i < bornes.length; i++) {
      tranches.push(`${bornes[i - 1]} à ${bornes[i]}`);
    }
    tranches.push(`${bornes[bornes.length - 1]} et plus`);
    return tranches.join(' · ');
  }

  private creerBorne(valeur: number | null): FormControl<number | null> {
    return new FormControl<number | null>(valeur, Validators.required);
  }

  /** Bornes proposées : celles des 5 tranches égales si min et max sont connus, sinon une seule à remplir. */
  private proposerBornes(): void {
    const c = this.question().configuration as Partial<ConfigurationNumerique>;
    const bornes = this.formulaire.controls.bornes;
    if (c.min !== undefined && c.max !== undefined && c.max > c.min) {
      const pas = (c.max - c.min) / 5;
      for (let i = 1; i < 5; i++) {
        bornes.push(this.creerBorne(Math.round((c.min + pas * i) * 100) / 100), { emitEvent: false });
      }
    } else {
      bornes.push(this.creerBorne(null), { emitEvent: false });
    }
  }

  /** Les bornes ne comptent (et ne se valident) que pour un critère NUMERIQUE en tranches personnalisées. */
  private majValidation(): void {
    const bornes = this.formulaire.controls.bornes;
    const utiles =
      this.formulaire.controls.estCritere.value &&
      this.question().type === 'NUMERIQUE' &&
      this.formulaire.controls.modeTranches.value === 'personnalisees';
    if (utiles && this.formulaire.enabled) {
      bornes.enable({ emitEvent: false });
    } else {
      bornes.disable({ emitEvent: false });
    }
  }

  private requete(): CritereRequest {
    const v = this.formulaire.getRawValue();
    if (!v.estCritere) {
      return { estCritere: false, critereConfig: null };
    }
    switch (this.question().type) {
      case 'NUMERIQUE':
        return {
          estCritere: true,
          critereConfig:
            v.modeTranches === 'personnalisees' ? { tranches: v.bornes.filter((b): b is number => b !== null) } : null,
        };
      case 'DATE':
        return { estCritere: true, critereConfig: { granularite: v.granularite } };
      default:
        return { estCritere: true, critereConfig: null };
    }
  }
}
