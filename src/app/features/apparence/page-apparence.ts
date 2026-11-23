import { afterEveryRender, Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { map, startWith } from 'rxjs';
import {
  COULEUR_DEFAUT,
  NOM_AFFICHE_MAX,
  PersonnalisationRequest,
  PersonnalisationResponse,
} from '../../core/models/personnalisation.model';
import { AuthService, messageLectureSeule } from '../../core/services/auth.service';
import { PersonnalisationService } from '../../core/services/personnalisation.service';
import { couleurTexte, couleurValide, normaliserCouleur } from '../../core/utils/couleur';
import { Encadre } from '../../shared/components/encadre/encadre';
import { EntetePage } from '../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../shared/components/message-erreur/message-erreur';
import { ApercuApparence } from './apercu-apparence';
import { ZoneLogo } from './zone-logo';
import { traduire } from '../../core/i18n/traduire';
import { TranslocoPipe } from '@jsverse/transloco';
import { PlurielPipe } from '../../core/i18n/formats.pipes';

export const messageGestionnaire = (): string => traduire('apparence.gestionnaire');

/** Champ hexadécimal : vide (couleur par défaut) ou #RRGGBB. */
const formatCouleur = Validators.pattern(/^(#[0-9A-Fa-f]{6})?$/);

/**
 * /apparence : apparence des formulaires de l'entreprise (logo, couleur principale, nom affiché) et aperçu en direct de
 * l'en-tête. L'admin modifie (PUT /api/admin/personnalisation, .../logo) ; ses gestionnaires, et l'admin dont
 * l'abonnement a expiré, voient les réglages et l'aperçu sans aucun bouton de modification.
 */
@Component({
  selector: 'app-page-apparence',
  imports: [PlurielPipe, TranslocoPipe, ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    Encadre,
    EntetePage,
    MessageErreur,
    ApercuApparence,
    ZoneLogo,
  ],
  templateUrl: './page-apparence.html',
  styleUrl: './page-apparence.scss',
})
export class PageApparence {
  private readonly service = inject(PersonnalisationService);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly nomMax = NOM_AFFICHE_MAX;
  protected readonly couleurDefaut = COULEUR_DEFAUT;

  protected readonly personnalisation = signal<PersonnalisationResponse | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);
  protected readonly erreurEnregistrement = signal<unknown>(null);
  protected readonly enregistrement = signal(false);
  /** Logo choisi, pas encore envoyé (aperçu). */
  protected readonly logoLocal = signal<string | null>(null);

  /** Admin dont l'abonnement n'a pas expiré : seul à pouvoir modifier. */
  protected readonly modifiable = computed(() => this.auth.role() === 'ADMIN' && !this.auth.lectureSeule());
  protected readonly raisonLectureSeule = computed(() =>
    this.auth.role() !== 'ADMIN' ? messageGestionnaire() : this.auth.lectureSeule() ? messageLectureSeule() : null,
  );

  readonly nomAffiche = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(NOM_AFFICHE_MAX)] });
  readonly couleur = new FormControl('', { nonNullable: true, validators: [formatCouleur] });

  private readonly couleurSaisie = toSignal(this.couleur.valueChanges.pipe(startWith(this.couleur.value)), {
    initialValue: '',
  });
  private readonly nomSaisi = toSignal(
    this.nomAffiche.valueChanges.pipe(
      startWith(this.nomAffiche.value),
      map((v) => v.trim()),
    ),
    { initialValue: '' },
  );

  /** Couleur montrée dans l'aperçu : la saisie si elle est valide, la couleur par défaut si le champ est vide. */
  protected readonly couleurApercu = computed(() => {
    const saisie = this.couleurSaisie().trim();
    if (saisie === '') {
      return COULEUR_DEFAUT;
    }
    return couleurValide(saisie) ? normaliserCouleur(saisie) : (this.personnalisation()?.couleurEffective ?? COULEUR_DEFAUT);
  });
  /** Couleur de texte : celle du backend pour la couleur enregistrée, sinon le même calcul de contraste. */
  protected readonly couleurTexteApercu = computed(() => {
    const p = this.personnalisation();
    const couleur = this.couleurApercu();
    return p && normaliserCouleur(p.couleurEffective) === couleur ? p.couleurTexte : couleurTexte(couleur);
  });
  /** Valeur du sélecteur natif (#rrggbb, toujours valide ; #005cbb tant qu'aucune couleur n'est choisie). */
  protected readonly couleurSelecteur = computed(() => this.couleurApercu().toLowerCase());
  private readonly selecteur = viewChild<ElementRef<HTMLInputElement>>('selecteur');
  protected readonly nomApercu = computed(() => this.nomSaisi() || this.personnalisation()?.nomEntreprise || '');
  protected readonly logoApercu = computed(() => this.logoLocal() ?? this.personnalisation()?.logo?.url ?? null);

  constructor() {
    this.charger();
    // Le sélecteur natif vaut #000000 tant qu'on ne lui a rien donné : sa valeur est vérifiée après chaque rendu,
    // une fois l'élément dans la page (une valeur posée à la création peut être perdue par le navigateur). Sans cela,
    // l'ouvrir et le fermer recopiait ce noir dans le champ.
    afterEveryRender({
      write: () => {
        const champ = this.selecteur()?.nativeElement;
        const valeur = this.couleurSelecteur();
        if (champ && champ.value !== valeur) {
          champ.value = valeur;
        }
      },
    });
  }

  protected charger(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .lire()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (personnalisation) => {
          this.appliquer(personnalisation);
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
  }

  /**
   * Sélecteur natif -> champ hexadécimal (en majuscules, comme le backend). Une valeur égale à celle déjà montrée
   * n'est pas une couleur choisie (ouvrir puis fermer le sélecteur) : le champ reste vide, la couleur Batulo s'applique.
   */
  protected couleurChoisie(evenement: Event): void {
    const valeur = (evenement.target as HTMLInputElement).value;
    if (!couleurValide(valeur) || valeur.toLowerCase() === this.couleurSelecteur()) {
      return;
    }
    this.couleur.setValue(normaliserCouleur(valeur));
    this.couleur.markAsDirty();
  }

  /** Champ hexadécimal : « 1e6b52 » est complété en « #1E6B52 » à la sortie du champ. */
  protected normaliserSaisie(): void {
    const saisie = this.couleur.value.trim();
    const avecDiese = saisie && !saisie.startsWith('#') ? `#${saisie}` : saisie;
    if (couleurValide(avecDiese)) {
      this.couleur.setValue(normaliserCouleur(avecDiese));
    }
  }

  protected couleurParDefaut(): void {
    this.couleur.setValue('');
    this.couleur.markAsDirty();
  }

  protected enregistrer(): void {
    this.normaliserSaisie();
    this.couleur.markAsTouched();
    this.nomAffiche.markAsTouched();
    if (this.couleur.invalid || this.nomAffiche.invalid || this.enregistrement()) {
      return;
    }
    const demande = this.modifications();
    if (Object.keys(demande).length === 0) {
      this.snackBar.open(traduire('apparence.aucuneModification'), traduire('commun.fermer'), { duration: 4000 });
      return;
    }
    this.enregistrement.set(true);
    this.erreurEnregistrement.set(null);
    this.service
      .modifier(demande)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (personnalisation) => {
          this.enregistrement.set(false);
          this.appliquer(personnalisation);
          this.snackBar.open(traduire('apparence.enregistree'), traduire('commun.fermer'), { duration: 4000 });
        },
        error: (erreur: unknown) => {
          this.enregistrement.set(false);
          this.erreurEnregistrement.set(erreur);
        },
      });
  }

  /**
   * Corps du PUT : seulement ce qui a changé par rapport à l'enregistré (absent : inchangé côté backend). Aucune couleur
   * choisie et aucune enregistrée : rien n'est envoyé pour la couleur.
   */
  modifications(): PersonnalisationRequest {
    const p = this.personnalisation();
    const demande: PersonnalisationRequest = {};
    const nom = this.nomAffiche.value.trim();
    const couleur = this.couleur.value.trim();
    if (nom !== (p?.nomAffiche ?? '')) {
      demande.nomAffiche = nom;
    }
    if (couleur !== (p?.couleurPrincipale ?? '')) {
      demande.couleurPrincipale = couleur;
    }
    return demande;
  }

  /** Après un envoi ou une suppression du logo : le reste de la saisie est gardé. */
  protected logoMisAJour(personnalisation: PersonnalisationResponse): void {
    this.personnalisation.set(personnalisation);
  }

  private appliquer(personnalisation: PersonnalisationResponse): void {
    this.personnalisation.set(personnalisation);
    this.nomAffiche.reset(personnalisation.nomAffiche ?? '');
    this.couleur.reset(personnalisation.couleurPrincipale ?? '');
  }
}
