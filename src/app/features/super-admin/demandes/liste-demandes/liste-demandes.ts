import { BreakpointObserver } from '@angular/cdk/layout';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatChipListbox, MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { Formule, LIBELLES_FORMULE } from '../../../../core/models/abonnement.model';
import {
  DemandeAbonnementResponse,
  LIBELLES_STATUT_DEMANDE,
  StatutDemande,
  STATUTS_DEMANDE,
  statutDemandeValide,
} from '../../../../core/models/demande-abonnement.model';
import { DemandeAbonnementService } from '../../../../core/services/demande-abonnement.service';
import {
  numeroPageUrl,
  parametresPage,
  taillePageUrl,
  TAILLES_PAGE,
} from '../../../../core/utils/pagination-url';
import { EntetePage } from '../../../../shared/components/entete-page/entete-page';
import { MessageErreur } from '../../../../shared/components/message-erreur/message-erreur';
import {
  DialogueDemande,
  DonneesDialogueDemande,
  ResultatDialogueDemande,
} from '../dialogue-demande/dialogue-demande';

/** Pastilles de filtre (« Toutes » + les statuts), au pluriel. */
const LIBELLES_FILTRE: Record<StatutDemande, string> = {
  EN_ATTENTE: 'En attente',
  TRAITEE: 'Acceptées',
  REFUSEE: 'Refusées',
};

/**
 * Demandes d'augmentation d'abonnement reçues (SA-07), les plus récentes d'abord. Filtre de statut et page dans
 * l'URL (?statut=&page=&taille=). Le détail et la réponse s'ouvrent dans une boîte de dialogue.
 */
@Component({
  selector: 'app-liste-demandes',
  imports: [
    DatePipe,
    NgTemplateOutlet,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTableModule,
    EntetePage,
    MessageErreur,
  ],
  templateUrl: './liste-demandes.html',
  styleUrl: './liste-demandes.scss',
})
export class ListeDemandes {
  private readonly service = inject(DemandeAbonnementService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly statuts = STATUTS_DEMANDE;
  protected readonly libellesFiltre = LIBELLES_FILTRE;
  protected readonly tailles = [...TAILLES_PAGE];
  /** Garde les lignes (et le focus) quand une demande est mise à jour. */
  protected readonly parId = (_index: number, element: DemandeAbonnementResponse) => element.id;
  protected readonly colonnes = ['entreprise', 'formule', 'date', 'statut', 'actions'];

  /** Paramètres d'URL ?statut=&page=&taille= (liaison des entrées par le routeur). */
  readonly statut = input<string | undefined>(undefined);
  readonly page = input<string | undefined>(undefined);
  readonly taille = input<string | undefined>(undefined);

  protected readonly filtreStatut = computed(() => statutDemandeValide(this.statut()));
  protected readonly numeroPage = computed(() => numeroPageUrl(this.page()));
  protected readonly taillePage = computed(() => taillePageUrl(this.taille()));

  private readonly pastilles = viewChild.required(MatChipListbox);

  protected readonly demandes = signal<DemandeAbonnementResponse[]>([]);
  protected readonly total = signal(0);
  protected readonly chargement = signal(true);
  protected readonly erreur = signal<unknown>(null);

  protected readonly petitEcran = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 719.98px)')
      .pipe(map((etat) => etat.matches)),
    { initialValue: false },
  );

  constructor() {
    effect(() => {
      const statut = this.filtreStatut();
      const page = this.numeroPage();
      const taille = this.taillePage();
      untracked(() => this.charger(statut, page, taille));
    });
  }

  protected recharger(): void {
    this.charger(this.filtreStatut(), this.numeroPage(), this.taillePage());
  }

  protected filtrer(valeur: unknown): void {
    // Un clic sur la pastille déjà choisie la désélectionne : on revient à « Toutes ».
    const statut = statutDemandeValide(typeof valeur === 'string' ? valeur : null);
    if (statut === this.filtreStatut()) {
      // Clic sur « Toutes » déjà choisie : la pastille reste sélectionnée.
      this.pastilles().value = statut ?? 'toutes';
      return;
    }
    void this.router.navigate([], { queryParams: { statut, page: null }, queryParamsHandling: 'merge' });
  }

  protected changerPage(evenement: PageEvent): void {
    void this.router.navigate([], {
      queryParams: parametresPage(evenement.pageIndex, evenement.pageSize),
      queryParamsHandling: 'merge',
    });
  }

  protected libelleStatut(demande: DemandeAbonnementResponse): string {
    return LIBELLES_STATUT_DEMANDE[demande.statut];
  }

  /** Formule actuelle null : jamais payé. */
  protected libelleFormule(formule: Formule | null): string {
    return formule ? LIBELLES_FORMULE[formule] : 'aucune';
  }

  protected ouvrir(demande: DemandeAbonnementResponse): void {
    this.dialog
      .open<DialogueDemande, DonneesDialogueDemande, ResultatDialogueDemande>(DialogueDemande, {
        data: { demande },
        width: '600px',
        maxWidth: 'calc(100vw - 32px)',
      })
      .afterClosed()
      .subscribe((resultat) => {
        if (!resultat) {
          return;
        }
        if (resultat === 'recharger') {
          this.recharger();
          return;
        }
        this.snackBar.open(
          resultat.statut === 'TRAITEE'
            ? `Demande de ${resultat.entreprise} acceptée ; l’admin en est notifié.`
            : `Demande de ${resultat.entreprise} refusée ; l’admin en est notifié.`,
          'Fermer',
          { duration: 6000 },
        );
        // Filtrée sur « En attente », la demande sort de la liste : on relit la page.
        if (this.filtreStatut() === 'EN_ATTENTE') {
          this.apresSortie();
        } else {
          this.demandes.update((liste) => liste.map((d) => (d.id === resultat.id ? resultat : d)));
        }
      });
  }

  /** Dernier élément d'une page : on revient à la précédente. */
  private apresSortie(): void {
    if (this.demandes().length === 1 && this.numeroPage() > 0) {
      void this.router.navigate([], {
        queryParams: { page: this.numeroPage() - 1 || null },
        queryParamsHandling: 'merge',
      });
    } else {
      this.recharger();
    }
  }

  private charger(statut: StatutDemande | null, page: number, taille: number): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service
      .lister({ statut, page, taille })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultat) => {
          this.demandes.set(resultat.contenu);
          this.total.set(resultat.totalElements);
          this.chargement.set(false);
        },
        error: (erreur: unknown) => {
          this.erreur.set(erreur);
          this.chargement.set(false);
        },
      });
  }
}
