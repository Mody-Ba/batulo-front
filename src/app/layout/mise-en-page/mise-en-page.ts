import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatSidenavModule } from '@angular/material/sidenav';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AbonnementService } from '../../core/services/abonnement.service';
import { AuthService } from '../../core/services/auth.service';
import { Encadre } from '../../shared/components/encadre/encadre';
import { BandeauAbonnement } from '../bandeau-abonnement/bandeau-abonnement';
import { BarreHaut } from '../barre-haut/barre-haut';
import { LIENS_PAR_ROLE } from '../menu-lateral/liens-navigation';
import { MenuLateral } from '../menu-lateral/menu-lateral';

/** En dessous de cette largeur, le menu latéral devient un tiroir (mode « over »). */
const REQUETE_PETIT_ECRAN = '(max-width: 959.98px)';

/** Cadre des pages connectées : barre du haut, menu latéral selon le rôle, contenu. */
@Component({
  selector: 'app-mise-en-page',
  imports: [
    RouterOutlet,
    MatSidenavModule,
    BarreHaut,
    BandeauAbonnement,
    MenuLateral,
    Encadre,
  ],
  templateUrl: './mise-en-page.html',
  styleUrl: './mise-en-page.scss',
})
export class MiseEnPage {
  protected readonly auth = inject(AuthService);

  protected readonly petitEcran = toSignal(
    inject(BreakpointObserver)
      .observe(REQUETE_PETIT_ECRAN)
      .pipe(map((etat) => etat.matches)),
    { initialValue: false },
  );

  /** Tiroir ouvert (petit écran seulement ; sur grand écran le menu est toujours visible). */
  protected readonly tiroirOuvert = signal(false);

  /**
   * Liens du rôle. Si l'état du compte impose une page (abonnement en attente...), seuls les
   * liens vers cette page restent : les autres seraient refusés.
   */
  protected readonly liens = computed(() => {
    const role = this.auth.role();
    if (!role) {
      return [];
    }
    const redirection = this.auth.redirectionObligatoire();
    const liens = LIENS_PAR_ROLE[role];
    return redirection ? liens.filter((lien) => lien.lien.startsWith(redirection)) : liens;
  });

  constructor() {
    // Abonnement de l'admin (bandeau). Rechargé si le statut change (paiement, 403 du serveur).
    const abonnementService = inject(AbonnementService);
    effect(() => {
      if (this.auth.role() === 'ADMIN') {
        this.auth.statutAbonnement();
        abonnementService.actualiser();
      }
    });
    // Retour en grand écran : le tiroir se ferme. Changement de page : idem sur petit écran.
    effect(() => {
      if (!this.petitEcran()) {
        this.tiroirOuvert.set(false);
      }
    });
    inject(Router)
      .events.pipe(
        filter((evenement) => evenement instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.tiroirOuvert.set(false));
  }
}
