import { Component, DestroyRef, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter } from 'rxjs';
import { LogoInfoResponse, PersonnalisationResponse } from '../../core/models/personnalisation.model';
import { PersonnalisationService } from '../../core/services/personnalisation.service';
import { confirmer } from '../../shared/components/dialogue-confirmation/dialogue-confirmation';
import { MessageErreur } from '../../shared/components/message-erreur/message-erreur';
import { urlLogoSure } from '../../shared/formulaire/apparence/apparence';
import { tailleEnClair, verifierLogo } from './validation-logo';

/**
 * Logo de l'entreprise : zone de dépôt (glisser-déposer ou « Choisir un fichier »), vérification avant envoi (PNG ou
 * JPEG, 1 Mo), aperçu local, puis PUT .../logo ; « Remplacer » et « Supprimer » (après confirmation). Erreurs du
 * serveur (format, taille, dimensions, image illisible ou JPEG CMYK) affichées telles quelles. En lecture seule : le
 * logo, sans aucune action.
 */
@Component({
  selector: 'app-zone-logo',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, MessageErreur],
  templateUrl: './zone-logo.html',
  styleUrl: './zone-logo.scss',
})
export class ZoneLogo {
  private readonly service = inject(PersonnalisationService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly taille = tailleEnClair;
  protected readonly urlSure = urlLogoSure;

  readonly logo = input<LogoInfoResponse | null | undefined>(null);
  /** Texte alternatif du logo (nom affiché). */
  readonly nom = input('');
  readonly modifiable = input(false);
  /** Personnalisation à jour après un envoi ou une suppression. */
  readonly misAJour = output<PersonnalisationResponse>();
  /** Image choisie, pas encore envoyée (URL locale blob:) : l'aperçu de l'en-tête la montre ; null sinon. */
  readonly apercuChange = output<string | null>();

  protected readonly fichier = signal<File | null>(null);
  protected readonly apercuLocal = signal<string | null>(null);
  protected readonly erreurLocale = signal<string | null>(null);
  protected readonly erreurServeur = signal<unknown>(null);
  protected readonly envoi = signal(false);
  protected readonly survol = signal(false);
  /** URL du logo enregistré qui n'a pas pu être affichée (introuvable, ou pas une image). */
  protected readonly logoIllisible = signal<string | null>(null);

  private readonly choix = viewChild<ElementRef<HTMLInputElement>>('choix');

  constructor() {
    this.destroyRef.onDestroy(() => this.libererApercu());
  }

  protected ouvrirChoix(): void {
    this.choix()?.nativeElement.click();
  }

  protected choisi(evenement: Event): void {
    const champ = evenement.target as HTMLInputElement;
    const fichier = champ.files?.[0];
    champ.value = '';
    if (fichier) {
      void this.prendre(fichier);
    }
  }

  protected survoler(evenement: DragEvent, actif: boolean): void {
    if (!this.modifiable()) {
      return;
    }
    evenement.preventDefault();
    this.survol.set(actif);
  }

  protected deposer(evenement: DragEvent): void {
    evenement.preventDefault();
    this.survol.set(false);
    const fichier = evenement.dataTransfer?.files?.[0];
    if (fichier && this.modifiable()) {
      void this.prendre(fichier);
    }
  }

  /** Vérifie le fichier ; valide, il est montré en aperçu en attendant « Enregistrer ce logo ». */
  async prendre(fichier: File): Promise<void> {
    this.erreurServeur.set(null);
    const message = await verifierLogo(fichier);
    if (message) {
      this.erreurLocale.set(message);
      this.annuler();
      return;
    }
    this.erreurLocale.set(null);
    this.libererApercu();
    const url = URL.createObjectURL(fichier);
    this.fichier.set(fichier);
    this.apercuLocal.set(url);
    this.apercuChange.emit(url);
  }

  protected annuler(): void {
    this.libererApercu();
    this.fichier.set(null);
    this.apercuChange.emit(null);
  }

  protected envoyer(): void {
    const fichier = this.fichier();
    if (!fichier || this.envoi()) {
      return;
    }
    this.envoi.set(true);
    this.erreurServeur.set(null);
    this.service
      .remplacerLogo(fichier)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (personnalisation) => {
          this.envoi.set(false);
          this.annuler();
          this.misAJour.emit(personnalisation);
          this.snackBar.open('Logo enregistré.', 'Fermer', { duration: 4000 });
        },
        error: (erreur: unknown) => {
          this.envoi.set(false);
          this.erreurServeur.set(erreur);
        },
      });
  }

  protected supprimer(): void {
    confirmer(this.dialog, {
      titre: 'Supprimer le logo ?',
      message: 'Il disparaîtra des formulaires et des rapports. Vous pourrez en ajouter un autre ensuite.',
      action: 'Supprimer le logo',
      destructive: true,
    })
      .pipe(filter(Boolean))
      .subscribe(() =>
        this.service
          .supprimerLogo()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (personnalisation) => {
              this.misAJour.emit(personnalisation);
              this.snackBar.open('Logo supprimé.', 'Fermer', { duration: 4000 });
            },
            error: (erreur: unknown) => this.erreurServeur.set(erreur),
          }),
      );
  }

  private libererApercu(): void {
    const url = this.apercuLocal();
    if (url) {
      URL.revokeObjectURL(url);
      this.apercuLocal.set(null);
    }
  }
}
