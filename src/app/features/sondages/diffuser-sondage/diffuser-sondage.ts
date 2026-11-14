import { Clipboard } from '@angular/cdk/clipboard';
import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { LienSondageResponse } from '../../../core/models/sondage.model';
import { SondageService } from '../../../core/services/sondage.service';
import { aLeCode } from '../../../core/utils/erreur-http';
import { Encadre } from '../../../shared/components/encadre/encadre';
import { EntetePage } from '../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../shared/components/message-erreur/message-erreur';

/** Tailles proposées pour le QR code (le backend accepte de 100 à 1000 pixels). */
export const TAILLES_QR = [300, 600, 1000] as const;

/**
 * Diffuser un sondage publié : lien public (le même pour toutes les versions, il mène à la version ouverte), copie
 * en un clic, QR code affiché et téléchargeable en PNG. Le QR code est lu par HttpClient (jeton envoyé), puis
 * affiché depuis une URL locale (blob:), libérée ensuite.
 */
@Component({
  selector: 'app-diffuser-sondage',
  imports: [
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    Encadre,
    EntetePage,
    MessageErreur,
  ],
  templateUrl: './diffuser-sondage.html',
  styleUrl: './diffuser-sondage.scss',
})
export class DiffuserSondage {
  private readonly service = inject(SondageService);
  private readonly clipboard = inject(Clipboard);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly tailles = TAILLES_QR;

  /** Paramètre de route :id. */
  readonly id = input.required<string>();

  protected readonly lien = signal<LienSondageResponse | null>(null);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);
  /** Jamais publié : pas encore de lien (409 SONDAGE_BROUILLON). */
  protected readonly brouillon = signal(false);

  protected readonly taille = signal<number>(TAILLES_QR[0]);
  protected readonly urlQr = signal<string | null>(null);
  protected readonly chargementQr = signal(false);
  protected readonly erreurQr = signal<unknown>(null);

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => this.charger(id));
    });
    this.destroyRef.onDestroy(() => this.libererQr());
  }

  protected charger(id = Number(this.id())): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.brouillon.set(false);
    this.service
      .lien(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lien) => {
          this.lien.set(lien);
          this.chargement.set(false);
          this.chargerQr();
        },
        error: (erreur: unknown) => {
          this.chargement.set(false);
          if (aLeCode(erreur, 'SONDAGE_BROUILLON')) {
            this.brouillon.set(true);
          } else {
            this.erreur.set(erreur);
          }
        },
      });
  }

  protected copier(lien: LienSondageResponse): void {
    const copie = this.clipboard.copy(lien.url);
    this.snackBar.open(
      copie ? 'Lien copié.' : 'La copie a échoué : sélectionnez le lien et copiez-le.',
      'Fermer',
      { duration: 4000 },
    );
  }

  protected changerTaille(taille: number): void {
    this.taille.set(taille);
    this.chargerQr();
  }

  protected chargerQr(): void {
    this.chargementQr.set(true);
    this.erreurQr.set(null);
    this.service
      .qrCode(Number(this.id()), this.taille())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (image) => {
          this.libererQr();
          this.urlQr.set(URL.createObjectURL(image));
          this.chargementQr.set(false);
        },
        error: (erreur: unknown) => {
          this.erreurQr.set(erreur);
          this.chargementQr.set(false);
        },
      });
  }

  protected nomFichier(): string {
    return `qr-code-sondage-${this.id()}-${this.taille()}px.png`;
  }

  private libererQr(): void {
    const url = this.urlQr();
    if (url) {
      URL.revokeObjectURL(url);
      this.urlQr.set(null);
    }
  }
}
