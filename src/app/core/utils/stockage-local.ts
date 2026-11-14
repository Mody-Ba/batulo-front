/**
 * localStorage toujours protégé (navigation privée, stockage plein, désactivé ou interdit) : en cas d'échec, on lit
 * null et on n'écrit rien, la page marche quand même. Réservé à ce qui peut se perdre sans dommage (brouillon,
 * préférences) : jamais de jeton de session (sessionStorage, voir AuthService).
 */
export function lireLocal<T>(cle: string): T | null {
  try {
    const texte = localStorage.getItem(cle);
    return texte === null ? null : (JSON.parse(texte) as T);
  } catch {
    return null;
  }
}

/** Écrit ; renvoie false si le navigateur refuse. */
export function ecrireLocal(cle: string, valeur: unknown): boolean {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
    return true;
  } catch {
    return false;
  }
}

export function effacerLocal(cle: string): void {
  try {
    localStorage.removeItem(cle);
  } catch {
    // Rien à faire : sans stockage, il n'y a rien à effacer.
  }
}

/** UUID v4 : crypto.randomUUID si disponible (contexte sécurisé), sinon à partir de crypto.getRandomValues. */
export function nouvelUuid(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const octets = crypto.getRandomValues(new Uint8Array(16));
  octets[6] = (octets[6] & 0x0f) | 0x40;
  octets[8] = (octets[8] & 0x3f) | 0x80;
  const hex = Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
