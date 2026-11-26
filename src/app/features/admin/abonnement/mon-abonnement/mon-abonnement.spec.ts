import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CreditsResponse, FormuleResponse, PaiementResponse } from '../../../../core/models/abonnement.model';
import { PageResponse } from '../../../../core/models/page.model';
import { AbonnementService } from '../../../../core/services/abonnement.service';
import { AuthService } from '../../../../core/services/auth.service';
import { abonnementDeTest, formulesDeTest } from '../../../../testing/donnees-test';
import { MonAbonnement } from './mon-abonnement';

function page(contenu: PaiementResponse[], totalElements = contenu.length): PageResponse<PaiementResponse> {
  return { contenu, page: 0, taille: 5, totalElements, totalPages: Math.ceil(totalElements / 5) };
}

const RECENT: PaiementResponse = {
  id: 3,
  datePaiement: '2026-11-01T15:00:00Z',
  formule: 'ANNUEL',
  montant: 80,
  devise: 'MRU',
  fournisseur: 'MOOSYL',
  type: 'ABONNEMENT',
  quantite: null,
};
const ANCIEN: PaiementResponse = {
  id: 1,
  datePaiement: '2026-09-01T15:00:00Z',
  formule: 'MENSUEL',
  montant: 12.5,
  devise: 'cad',
  fournisseur: 'STRIPE',
};
const ACHAT: PaiementResponse = {
  id: 4,
  datePaiement: '2026-11-20T15:00:00Z',
  formule: null,
  montant: 24.95,
  devise: 'CAD',
  fournisseur: 'STRIPE',
  type: 'ACHAT_SONDAGES',
  quantite: 5,
};

describe('MonAbonnement', () => {
  let paiements: ReturnType<typeof vi.fn>;
  let formules: ReturnType<typeof vi.fn>;
  const credits = signal<CreditsResponse | null>(null);

  let fixture: ComponentFixture<MonAbonnement>;

  async function creer(): Promise<HTMLElement> {
    fixture = TestBed.createComponent(MonAbonnement);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const texte = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const lignes = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.historique tbody tr')).map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => texte(td)));

  beforeEach(() => {
    credits.set(null);
    paiements = vi.fn(() => of(page([RECENT, ANCIEN])));
    formules = vi.fn(() => of(formulesDeTest()));
    const abonnement = signal(abonnementDeTest());
    TestBed.configureTestingModule({
      imports: [MonAbonnement],
      providers: [
        provideRouter([]),
        {
          provide: AbonnementService,
          useValue: { abonnement, monAbonnement: () => of(abonnement()), paiements, formules },
        },
        { provide: AuthService, useValue: { credits } },
      ],
    });
  });

  it('affiche l’historique des paiements, du plus récent au plus ancien : type, formule, quantité, moyen, montant', async () => {
    const element = await creer();
    expect(paiements).toHaveBeenCalledWith(0, 5);
    const l = lignes(element);
    expect(l).toHaveLength(2);
    expect(l[0]).toEqual(['1 nov. 2026', 'Abonnement', 'Formule annuelle', '—', 'Mobile', '80 MRU']);
    // Backend plus ancien (sans type) : abonnement.
    expect(l[1].slice(1)).toEqual(['Abonnement', 'Formule mensuelle', '—', 'Carte', '12,50 CAD']);
    expect(element.textContent).not.toContain('bientôt disponible');
    // Une seule page : pas de paginateur.
    expect(element.querySelector('mat-paginator')).toBeNull();
  });

  it('achat de sondages dans l’historique : type, quantité, pas de formule', async () => {
    paiements.mockReturnValue(of(page([ACHAT])));
    const element = await creer();
    expect(lignes(element)[0].slice(1)).toEqual(['Achat de sondages', '—', '5', 'Carte', '24,95 CAD']);
  });

  it('plus de paiements qu’une page : paginateur', async () => {
    paiements.mockReturnValue(of(page([RECENT, ANCIEN], 12)));
    const element = await creer();
    expect(element.querySelector('mat-paginator')).not.toBeNull();
  });

  it('aucun paiement : message', async () => {
    paiements.mockReturnValue(of(page([])));
    const element = await creer();
    expect(element.querySelector('.historique')).toBeNull();
    expect(element.textContent).toContain('Aucun paiement pour le moment.');
  });

  describe('carte « Acheter des sondages »', () => {
    const carte = (el: HTMLElement) => el.querySelector<HTMLElement>('.carte-achat')!;
    const champ = (el: HTMLElement) => carte(el).querySelector<HTMLInputElement>('input[type="number"]')!;

    async function saisir(el: HTMLElement, valeur: string): Promise<void> {
      champ(el).value = valeur;
      champ(el).dispatchEvent(new Event('input'));
      champ(el).dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('total en direct par carte (CAD) et par paiement mobile (MRU)', async () => {
      const element = await creer();
      expect(texte(carte(element).querySelector('h2'))).toBe('Acheter des sondages');
      // 1 par défaut.
      expect(texte(carte(element).querySelector('.montant-carte'))).toBe('4,99 $');
      expect(texte(carte(element).querySelector('.montant-mobile'))).toBe('200 MRU');
      await saisir(element, '1000');
      expect(texte(carte(element).querySelector('.montant-carte'))).toBe('4 990,00 $');
      expect(texte(carte(element).querySelector('.montant-mobile'))).toBe('200 000 MRU');
    });

    it('bornes 1 et 1000 : 0 et 1001 refusés, sans total ni navigation', async () => {
      const element = await creer();
      const naviguer = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      for (const valeur of ['0', '1001']) {
        await saisir(element, valeur);
        expect(carte(element).querySelector('.montant-carte')).toBeNull();
        expect(texte(carte(element).querySelector('mat-error'))).toBe('De 1 à 1000 sondages');
        carte(element).querySelector<HTMLButtonElement>('.bouton-acheter')!.click();
      }
      expect(naviguer).not.toHaveBeenCalled();
      await saisir(element, '1');
      expect(carte(element).querySelector('mat-error')).toBeNull();
    });

    it('« Continuer vers le paiement » ouvre la souscription en mode achat, avec le nombre', async () => {
      const element = await creer();
      const naviguer = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      await saisir(element, '12');
      carte(element).querySelector<HTMLButtonElement>('.bouton-acheter')!.click();
      expect(naviguer).toHaveBeenCalledWith(['/admin/abonnement/souscrire'], {
        queryParams: { offre: 'ACHAT_SONDAGES', quantite: 12 },
      });
    });

    it('solde affiché pour une entreprise qui a déjà acheté ; rien sinon', async () => {
      let element = await creer();
      expect(carte(element).querySelector('.solde')).toBeNull();
      credits.set({ solde: 7, totalAchete: 10, totalUtilise: 3, compteCredits: true });
      element = await creer();
      expect(texte(carte(element).querySelector('.solde'))).toBe('Sondages disponibles : 7');
    });

    it('sans offre d’achat dans /formules (ou tarifs illisibles) : pas de carte', async () => {
      formules.mockReturnValue(of(formulesDeTest().filter((f: FormuleResponse) => f.type !== 'ACHAT_SONDAGES')));
      expect((await creer()).querySelector('.carte-achat')).toBeNull();
      formules.mockReturnValue(throwError(() => new Error('réseau')));
      expect((await creer()).querySelector('.carte-achat')).toBeNull();
    });
  });
});
