/** Page de résultats des listes paginées (PageResponse du backend). */
export interface PageResponse<T> {
  contenu: T[];
  page: number;
  taille: number;
  totalElements: number;
  totalPages: number;
}
