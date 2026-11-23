import { effect, Injectable, Provider } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { formaterNombre, traduire } from '../i18n/traduire';

/**
 * Libellés du paginateur Material dans la langue courante (relus au changement de langue). Fourni par les routes
 * chargées à la demande (fournirPaginateurFrancais) : le paginateur n'entre pas dans le bundle initial.
 */
@Injectable()
export class PaginateurFrancais extends MatPaginatorIntl {
  constructor() {
    super();
    effect(() => {
      this.itemsPerPageLabel = traduire('commun.paginateur.parPage');
      this.nextPageLabel = traduire('commun.paginateur.suivante');
      this.previousPageLabel = traduire('commun.paginateur.precedente');
      this.firstPageLabel = traduire('commun.paginateur.premiere');
      this.lastPageLabel = traduire('commun.paginateur.derniere');
      this.changes.next();
    });
  }

  override getRangeLabel = (page: number, taille: number, total: number): string => {
    if (total === 0 || taille === 0) {
      return traduire('commun.paginateur.vide', { total: formaterNombre(total) });
    }
    const debut = page * taille;
    const fin = Math.min(debut + taille, total);
    return traduire('commun.paginateur.intervalle', {
      debut: formaterNombre(debut + 1),
      fin: formaterNombre(fin),
      total: formaterNombre(total),
    });
  };
}

export function fournirPaginateurFrancais(): Provider {
  return { provide: MatPaginatorIntl, useClass: PaginateurFrancais };
}
