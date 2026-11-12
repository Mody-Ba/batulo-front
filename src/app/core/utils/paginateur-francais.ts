import { Injectable, Provider } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';

/**
 * Libellés du paginateur Material en français. Fourni par les routes chargées à la demande
 * (fournirPaginateurFrancais) : le paginateur n'entre pas dans le bundle initial.
 */
@Injectable()
export class PaginateurFrancais extends MatPaginatorIntl {
  override itemsPerPageLabel = 'Éléments par page';
  override nextPageLabel = 'Page suivante';
  override previousPageLabel = 'Page précédente';
  override firstPageLabel = 'Première page';
  override lastPageLabel = 'Dernière page';

  override getRangeLabel = (page: number, taille: number, total: number): string => {
    if (total === 0 || taille === 0) {
      return `0 sur ${total}`;
    }
    const debut = page * taille;
    const fin = Math.min(debut + taille, total);
    return `${debut + 1} – ${fin} sur ${total}`;
  };
}

export function fournirPaginateurFrancais(): Provider {
  return { provide: MatPaginatorIntl, useClass: PaginateurFrancais };
}
