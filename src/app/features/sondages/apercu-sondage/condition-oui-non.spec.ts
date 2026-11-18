import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApercuResponse } from '../../../core/models/sondage.model';
import { SondageService } from '../../../core/services/sondage.service';
import { FormulairePublicResponse } from '../../../core/models/formulaire-public.model';
import { FormulairePublicService } from '../../../core/services/formulaire-public.service';
import { evaluerVisibilite } from '../../../shared/formulaire/conditions';
import { FormulairePublic } from '../../public/formulaire-public/formulaire-public';
import { FormulaireSondage } from '../../../shared/formulaire/formulaire-sondage';
import { ApercuSondage } from './apercu-sondage';

/**
 * Réponse RÉELLE de GET /api/sondages/{id}/apercu (backend lancé sur 8092, base batulo_test) pour « Combien d'enfants ? »
 * visible si « Avez-vous des enfants ? » = Oui : condition: null présente sur les autres, valeur booléenne true.
 */
const APERCU_REEL = {
  "id": 3,
  "titre": "Enquête malnutrition des familles – 2026",
  "description": null,
  "version": 1,
  "statut": "NON_COMMENCE",
  "objetEnquete": null,
  "texteConfidentialite": null,
  "consentementRequis": false,
  "texteConsentement": null,
  "sections": [
    {
      "id": 4,
      "titre": "Famille",
      "description": null,
      "ordre": 1,
      "condition": null,
      "questions": [
        {
          "id": 6,
          "libelle": "Avez-vous des enfants ?",
          "aide": null,
          "type": "OUI_NON",
          "obligatoire": false,
          "ordre": 1,
          "configuration": {},
          "options": [],
          "condition": null,
          "estCritere": false
        },
        {
          "id": 7,
          "libelle": "Combien d'enfants ?",
          "aide": null,
          "type": "NUMERIQUE",
          "obligatoire": false,
          "ordre": 2,
          "configuration": {
            "decimales": 0
          },
          "options": [],
          "condition": {
            "combinaison": "ET",
            "regles": [
              {
                "questionId": 6,
                "operateur": "EGAL",
                "valeur": true
              }
            ]
          },
          "estCritere": false
        }
      ]
    }
  ]
} as unknown as ApercuResponse;

describe('Bug : question conditionnelle par une question Oui/Non (réponse réelle du backend)', () => {
  let fixture: ComponentFixture<ApercuSondage>;
  let element: HTMLElement;

  const combien = () => element.querySelector('[data-question="7"]');
  function repondre(oui: boolean): void {
    element.querySelectorAll<HTMLInputElement>('[data-question="6"] input[type="radio"]')[oui ? 0 : 1].click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SondageService, useValue: { apercu: vi.fn(() => of(APERCU_REEL)) } }],
    });
    fixture = TestBed.createComponent(ApercuSondage);
    element = fixture.nativeElement;
    fixture.componentRef.setInput('id', '3');
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('évaluateur : aucune réponse -> masquée, Non -> masquée, Oui -> visible', () => {
    const visibles = (reponse: boolean | undefined) => [...evaluerVisibilite(APERCU_REEL.sections, (id) => (id === 6 ? reponse : undefined)).questions];
    expect(visibles(undefined)).toEqual([6]);
    expect(visibles(false)).toEqual([6]);
    expect(visibles(true)).toEqual([6, 7]);
  });

  it('aperçu : cachée au départ, cachée avec Non, visible avec Oui, cachée à nouveau avec Non et sa réponse effacée', () => {
    expect(element.querySelector('[data-question="6"]')).not.toBeNull();
    expect(combien()).toBeNull();
    repondre(false);
    expect(combien()).toBeNull();
    repondre(true);
    expect(combien()).not.toBeNull();
    const champ = combien()!.querySelector<HTMLInputElement>('input')!;
    champ.value = '3';
    champ.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    repondre(false);
    expect(combien()).toBeNull();
    repondre(true);
    expect(combien()!.querySelector<HTMLInputElement>('input')!.value).toBe('');
    // « Recommencer » : plus aucune réponse, de nouveau cachée.
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes('Recommencer'))!.click();
    fixture.detectChanges();
    expect(combien()).toBeNull();
  });
});

/** Réponse RÉELLE de GET /api/public/sondages/{jeton} pour le même sondage, une fois publié. */
const PUBLIC_REEL = {
  "titre": "Enquête malnutrition des familles – 2026",
  "description": null,
  "reponseUnique": false,
  "dateFermeture": null,
  "objetEnquete": null,
  "texteConfidentialite": null,
  "consentementRequis": false,
  "texteConsentement": null,
  "sections": [
    {
      "id": 4,
      "titre": "Famille",
      "description": null,
      "ordre": 1,
      "condition": null,
      "questions": [
        {
          "id": 6,
          "libelle": "Avez-vous des enfants ?",
          "aide": null,
          "type": "OUI_NON",
          "obligatoire": false,
          "ordre": 1,
          "configuration": {},
          "options": [],
          "condition": null
        },
        {
          "id": 7,
          "libelle": "Combien d'enfants ?",
          "aide": null,
          "type": "NUMERIQUE",
          "obligatoire": false,
          "ordre": 2,
          "configuration": {
            "decimales": 0
          },
          "options": [],
          "condition": {
            "combinaison": "ET",
            "regles": [
              {
                "questionId": 6,
                "operateur": "EGAL",
                "valeur": true
              }
            ]
          }
        }
      ]
    }
  ]
} as unknown as FormulairePublicResponse;

describe('Bug : même cas dans le formulaire public (/s/:jeton, réponse réelle du backend)', () => {
  it('cachée au départ, cachée avec Non, visible avec Oui, cachée avec Non ; jamais envoyée quand elle est cachée', async () => {
    localStorage.clear();
    const repondre = vi.fn(() => of({ message: 'Merci', dateSoumission: '2026-11-17T12:00:00Z' }));
    TestBed.configureTestingModule({
      providers: [{ provide: FormulairePublicService, useValue: { lire: vi.fn(() => of(PUBLIC_REEL)), repondre } }],
    });
    const fixture = TestBed.createComponent(FormulairePublic);
    const element: HTMLElement = fixture.nativeElement;
    fixture.componentRef.setInput('jeton', 'aPVkpzt8');
    await fixture.whenStable();
    fixture.detectChanges();
    const combien = () => element.querySelector('[data-question="7"]');
    const repondreOuiNon = (oui: boolean) => {
      element.querySelectorAll<HTMLInputElement>('[data-question="6"] input[type="radio"]')[oui ? 0 : 1].click();
      fixture.detectChanges();
    };

    expect(element.querySelector('[data-question="6"]')).not.toBeNull();
    expect(combien()).toBeNull();
    repondreOuiNon(false);
    expect(combien()).toBeNull();
    repondreOuiNon(true);
    expect(combien()).not.toBeNull();
    const champ = combien()!.querySelector<HTMLInputElement>('input')!;
    champ.value = '3';
    champ.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    repondreOuiNon(false);
    expect(combien()).toBeNull();

    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes('Envoyer mes réponses'))!.click();
    fixture.detectChanges();
    expect(repondre).toHaveBeenCalledWith('aPVkpzt8', expect.objectContaining({ reponses: [{ questionId: 6, valeur: false }] }));
  });
});

/**
 * JSON RÉEL de GET /api/public/sondages/{jeton} sur 8090 pour le sondage « sante » (17 novembre 2026) : en base, aucune
 * question n'a de condition_affichage, et l'API renvoie donc "condition": null partout. La question s'affiche alors
 * toujours, ce qui est correct : le front suit les données. Avec la condition telle que le backend la renvoie quand elle
 * est enregistrée, la même question est cachée sans réponse et avec Non, et visible avec Oui.
 */
const PUBLIC_SANTE = {
  "titre": "sante",
  "description": "santé des enfant",
  "reponseUnique": true,
  "dateFermeture": null,
  "objetEnquete": "bonjour",
  "texteConfidentialite": "c est juste un test",
  "consentementRequis": true,
  "texteConsentement": "pret",
  "sections": [
    {
      "id": 7,
      "titre": "famille",
      "description": null,
      "ordre": 1,
      "condition": null,
      "questions": [
        {
          "id": 22,
          "libelle": "nom",
          "aide": null,
          "type": "TEXTE_COURT",
          "obligatoire": true,
          "ordre": 1,
          "configuration": {
            "longueurMax": 255
          },
          "options": [],
          "condition": null
        },
        {
          "id": 23,
          "libelle": "avez vous des enfant",
          "aide": null,
          "type": "OUI_NON",
          "obligatoire": true,
          "ordre": 2,
          "configuration": {},
          "options": [],
          "condition": null
        },
        {
          "id": 24,
          "libelle": "combien d enfant avez vous",
          "aide": null,
          "type": "NUMERIQUE",
          "obligatoire": true,
          "ordre": 3,
          "configuration": {
            "max": 20,
            "min": 1,
            "decimales": 0
          },
          "options": [],
          "condition": null
        }
      ]
    }
  ],
  "dejaRepondu": false
} as unknown as FormulairePublicResponse;

describe('Diagnostic « sante » : JSON réel de 8090, sans condition en base', () => {
  async function afficher(contenu: FormulairePublicResponse) {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(FormulaireSondage);
    fixture.componentRef.setInput('contenu', contenu);
    fixture.componentRef.setInput('mode', 'reponse');
    await fixture.whenStable();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    return {
      combien: () => element.querySelector('[data-question="24"]'),
      repondre: (oui: boolean) => {
        element.querySelectorAll<HTMLInputElement>('[data-question="23"] input[type="radio"]')[oui ? 0 : 1].click();
        fixture.detectChanges();
      },
    };
  }

  it('JSON réel : "condition": null sur « combien d enfant avez vous » -> toujours affichée (données sans condition)', async () => {
    const question = PUBLIC_SANTE.sections[0].questions.find((q) => q.id === 24)!;
    expect(question.condition).toBeNull();
    const f = await afficher(PUBLIC_SANTE);
    expect(f.combien()).not.toBeNull();
    f.repondre(false);
    expect(f.combien()).not.toBeNull();
  });

  it('même JSON avec la condition que renvoie le backend une fois enregistrée -> cachée sans réponse et avec Non, visible avec Oui', async () => {
    const avecCondition = structuredClone(PUBLIC_SANTE);
    avecCondition.sections[0].questions.find((q) => q.id === 24)!.condition = {
      combinaison: 'ET',
      regles: [{ questionId: 23, operateur: 'EGAL', valeur: true }],
    };
    const f = await afficher(avecCondition);
    expect(f.combien()).toBeNull();
    f.repondre(false);
    expect(f.combien()).toBeNull();
    f.repondre(true);
    expect(f.combien()).not.toBeNull();
    f.repondre(false);
    expect(f.combien()).toBeNull();
  });
});
