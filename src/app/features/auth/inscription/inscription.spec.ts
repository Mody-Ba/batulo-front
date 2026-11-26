import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AbonnementService } from '../../../core/services/abonnement.service';
import { AuthService } from '../../../core/services/auth.service';
import { InscriptionService } from '../../../core/services/inscription.service';
import { formulesDeTest } from '../../../testing/donnees-test';
import { Inscription } from './inscription';

/** Inscription : choix de l'offre (Mensuel, Annuel, achat de sondages) et nombre de sondages avec le total. */
describe('Inscription : choix de l’offre', () => {
  let fixture: ComponentFixture<Inscription>;
  let inscrire: ReturnType<typeof vi.fn>;
  let formules: ReturnType<typeof vi.fn>;

  async function creer(offre?: string): Promise<HTMLElement> {
    fixture = TestBed.createComponent(Inscription);
    if (offre) {
      fixture.componentRef.setInput('offre', offre);
    }
    await stable();
    return fixture.nativeElement;
  }

  async function stable(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const texte = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const offres = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLLabelElement>('.choix-offre'));

  async function saisir(el: HTMLElement, selecteur: string, valeur: string): Promise<void> {
    const champ = el.querySelector<HTMLInputElement>(selecteur)!;
    champ.value = valeur;
    champ.dispatchEvent(new Event('input'));
    champ.dispatchEvent(new Event('blur'));
    await stable();
  }

  async function remplirCompte(el: HTMLElement): Promise<void> {
    await saisir(el, '[formcontrolname="prenom"]', 'Awa');
    await saisir(el, '[formcontrolname="nom"]', 'Diallo');
    await saisir(el, '[formcontrolname="courriel"]', 'awa@exemple.com');
    await saisir(el, '[formcontrolname="motDePasse"]', 'secret123');
    await saisir(el, '[formcontrolname="confirmationMotDePasse"]', 'secret123');
  }

  beforeEach(() => {
    inscrire = vi.fn(() => of({}));
    formules = vi.fn(() => of(formulesDeTest()));
    TestBed.configureTestingModule({
      imports: [Inscription],
      providers: [
        provideRouter([]),
        { provide: InscriptionService, useValue: { inscrire } },
        { provide: AbonnementService, useValue: { formules } },
        {
          provide: AuthService,
          useValue: { connexion: vi.fn(() => of({})), urlAccueil: () => '/admin/abonnement', preparerMessageConnexion: vi.fn() },
        },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  it('trois offres avec leurs prix (CAD et MRU), Mensuel par défaut ; pas de nombre de sondages', async () => {
    const el = await creer();
    expect(offres(el).map((o) => texte(o.querySelector('.libelle-offre')))).toEqual([
      'Abonnement mensuel',
      'Abonnement annuel',
      'Achat de sondages',
    ]);
    expect(texte(offres(el)[2].querySelector('.prix-offre'))).toBe('4,99 $ · 200 MRU par sondage');
    expect(offres(el)[0].querySelector<HTMLInputElement>('input')!.checked).toBe(true);
    expect(el.querySelector('app-quantite-sondages')).toBeNull();
  });

  it('achat de sondages : champ nombre (1 par défaut) et total en direct en CAD et en MRU', async () => {
    const el = await creer();
    offres(el)[2].querySelector<HTMLInputElement>('input')!.click();
    await stable();
    expect(el.querySelector<HTMLInputElement>('app-quantite-sondages input')!.value).toBe('1');
    await saisir(el, 'app-quantite-sondages input', '20');
    expect(texte(el.querySelector('.montant-carte'))).toBe('99,80 $');
    expect(texte(el.querySelector('.montant-mobile'))).toBe('4 000 MRU');
  });

  it('?offre=ACHAT_SONDAGES (vitrine) présélectionne l’achat', async () => {
    const el = await creer('ACHAT_SONDAGES');
    expect(offres(el)[2].classList).toContain('choisie');
    expect(el.querySelector('app-quantite-sondages')).not.toBeNull();
  });

  it('envoi : offre et nombre de sondages pour un achat', async () => {
    const el = await creer('ACHAT_SONDAGES');
    await remplirCompte(el);
    await saisir(el, 'app-quantite-sondages input', '15');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    expect(inscrire).toHaveBeenCalledWith(expect.objectContaining({ offre: 'ACHAT_SONDAGES', nombreSondages: 15, courriel: 'awa@exemple.com' }));
  });

  it('envoi : abonnement annuel, sans nombre de sondages', async () => {
    const el = await creer();
    offres(el)[1].querySelector<HTMLInputElement>('input')!.click();
    await stable();
    await remplirCompte(el);
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    const demande = inscrire.mock.calls[0][0];
    expect(demande.offre).toBe('ANNUEL');
    expect(demande).not.toHaveProperty('nombreSondages');
  });

  it('nombre hors bornes (0, 1001) : rien n’est envoyé, erreur affichée', async () => {
    const el = await creer('ACHAT_SONDAGES');
    await remplirCompte(el);
    for (const valeur of ['0', '1001']) {
      await saisir(el, 'app-quantite-sondages input', valeur);
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await stable();
      expect(texte(el.querySelector('app-quantite-sondages mat-error'))).toBe('De 1 à 1000 sondages');
    }
    expect(inscrire).not.toHaveBeenCalled();
  });

  it('tarifs illisibles : les trois offres restent proposées, sans prix', async () => {
    formules.mockReturnValue(throwError(() => new Error('réseau')));
    const el = await creer();
    expect(offres(el)).toHaveLength(3);
    expect(el.querySelector('.prix-offre')).toBeNull();
  });
});
