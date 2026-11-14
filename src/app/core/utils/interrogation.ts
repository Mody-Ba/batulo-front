import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { EMPTY, fromEvent, map, Observable, startWith, switchMap, timer } from 'rxjs';

/** L'onglet est-il visible ? (Toujours vrai hors d'un navigateur.) */
export function ongletVisible(document: Document): boolean {
  return document.visibilityState !== 'hidden';
}

/**
 * Battements d'une interrogation périodique (pas de WebSocket) : un tout de suite, puis toutes les `intervalleMs`,
 * seulement quand l'onglet est visible ; rien pendant qu'il est caché, et un battement immédiat quand il redevient
 * visible. À appeler dans un contexte d'injection ; le résultat se désabonne avec takeUntilDestroyed.
 */
export function interrogationPeriodique(intervalleMs: number, document: Document = inject(DOCUMENT)): Observable<number> {
  return fromEvent(document, 'visibilitychange').pipe(
    map(() => ongletVisible(document)),
    startWith(ongletVisible(document)),
    switchMap((visible) => (visible ? timer(0, intervalleMs) : EMPTY)),
  );
}

