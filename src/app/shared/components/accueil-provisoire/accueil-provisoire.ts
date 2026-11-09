import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { LIBELLES_STATUT_ABONNEMENT } from '../../../core/models/abonnement.model';
import { LIBELLES_ROLE } from '../../../core/models/role.model';
import { AuthService } from '../../../core/services/auth.service';
import { LIENS_PAR_ROLE } from '../../../layout/menu-lateral/liens-navigation';
import { EntetePage } from '../entete-page/entete-page';

/** Tableau de bord provisoire, commun aux trois rôles, en attendant leurs étapes. */
@Component({
  selector: 'app-accueil-provisoire',
  imports: [EntetePage, MatIconModule, RouterLink],
  templateUrl: './accueil-provisoire.html',
  styleUrl: './accueil-provisoire.scss',
})
export class AccueilProvisoire {
  protected readonly auth = inject(AuthService);
  protected readonly libellesRole = LIBELLES_ROLE;
  protected readonly libellesStatut = LIBELLES_STATUT_ABONNEMENT;

  protected readonly titre = computed(() => {
    const prenom = this.auth.utilisateur()?.prenom;
    return prenom ? `Bonjour ${prenom}` : 'Bonjour';
  });

  /** Raccourcis : les entrées du menu, sans le tableau de bord lui-même. */
  protected readonly raccourcis = computed(() => {
    const role = this.auth.role();
    return role ? LIENS_PAR_ROLE[role].filter((lien) => !lien.exact) : [];
  });
}
