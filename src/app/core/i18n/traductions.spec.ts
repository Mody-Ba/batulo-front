import ar from '../../../../public/i18n/ar.json';
import en from '../../../../public/i18n/en.json';
import fr from '../../../../public/i18n/fr.json';
import publicAr from '../../../../public/i18n/public/ar.json';
import publicEn from '../../../../public/i18n/public/en.json';
import publicFr from '../../../../public/i18n/public/fr.json';

/** Formes de pluriel d'Intl.PluralRules : fr et en n'utilisent que one et other, l'arabe les six. */
const FORMES = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);

type Arbre = { [cle: string]: string | Arbre };

/** Clés à plat (« a.b.c ») et leur texte. */
function aplatir(arbre: Arbre, prefixe = ''): Map<string, string> {
  const cles = new Map<string, string>();
  for (const [cle, valeur] of Object.entries(arbre)) {
    const complete = prefixe ? `${prefixe}.${cle}` : cle;
    if (typeof valeur === 'string') {
      cles.set(complete, valeur);
    } else {
      for (const [c, v] of aplatir(valeur, complete)) {
        cles.set(c, v);
      }
    }
  }
  return cles;
}

/** Un groupe de pluriel (« x.one », « x.other »…) devient une seule clé « x.# » : ses formes varient selon la langue. */
function cleLogique(cle: string, cles: Map<string, string>): string {
  const parent = cle.slice(0, cle.lastIndexOf('.'));
  const derniere = cle.slice(cle.lastIndexOf('.') + 1);
  return FORMES.has(derniere) && cles.has(`${parent}.other`) ? `${parent}.#` : cle;
}

function clesLogiques(arbre: Arbre): Set<string> {
  const cles = aplatir(arbre);
  return new Set([...cles.keys()].map((c) => cleLogique(c, cles)));
}

function parametres(texte: string): string[] {
  return [...texte.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();
}

const FICHIERS = {
  principal: { fr, en, ar } as Record<string, Arbre>,
  public: { fr: publicFr, en: publicEn, ar: publicAr } as Record<string, Arbre>,
};

describe('Fichiers de traduction (public/i18n)', () => {
  for (const [nom, langues] of Object.entries(FICHIERS)) {
    it(`${nom} : mêmes clés en français, en anglais et en arabe (formes de pluriel à part)`, () => {
      const reference = [...clesLogiques(langues['fr'])].sort();
      expect(reference.length).toBeGreaterThan(0);
      expect([...clesLogiques(langues['en'])].sort()).toEqual(reference);
      expect([...clesLogiques(langues['ar'])].sort()).toEqual(reference);
    });

    it(`${nom} : aucun texte vide, pluriels complets (forme other dans chaque langue)`, () => {
      for (const [langue, arbre] of Object.entries(langues)) {
        const cles = aplatir(arbre);
        for (const [cle, texte] of cles) {
          expect(texte.trim(), `${langue} ${cle}`).not.toBe('');
          const derniere = cle.slice(cle.lastIndexOf('.') + 1);
          if (FORMES.has(derniere)) {
            expect(cles.has(`${cle.slice(0, cle.lastIndexOf('.'))}.other`), `${langue} ${cle}`).toBe(true);
          }
        }
      }
    });

    it(`${nom} : mêmes paramètres {{ … }} dans les trois langues`, () => {
      const cles = { fr: aplatir(langues['fr']), en: aplatir(langues['en']), ar: aplatir(langues['ar']) };
      for (const [cle, texte] of cles.fr) {
        const derniere = cle.slice(cle.lastIndexOf('.') + 1);
        if (FORMES.has(derniere)) {
          // Pluriel : le nombre peut être écrit en toutes lettres (« يومان ») ; les autres paramètres restent.
          const autres = (t: string | undefined) => parametres(t ?? '').filter((p) => p !== 'n');
          const parent = cle.slice(0, cle.lastIndexOf('.'));
          expect(autres(cles.en.get(cle) ?? cles.en.get(`${parent}.other`)), `en ${cle}`).toEqual(autres(texte));
          expect(autres(cles.ar.get(`${parent}.other`)), `ar ${cle}`).toEqual(autres(texte));
        } else {
          expect(parametres(cles.en.get(cle) ?? ''), `en ${cle}`).toEqual(parametres(texte));
          expect(parametres(cles.ar.get(cle) ?? ''), `ar ${cle}`).toEqual(parametres(texte));
        }
      }
    });
  }

  it('les clés « public.* » sont toutes dans le petit fichier du formulaire public, et lui seul', () => {
    for (const cle of aplatir(fr as Arbre).keys()) {
      expect(cle.startsWith('public.'), cle).toBe(false);
    }
    for (const cle of aplatir(publicFr as Arbre).keys()) {
      expect(cle.startsWith('public.'), cle).toBe(true);
    }
  });

  it('le texte français est écrit avec l’apostrophe typographique', () => {
    for (const arbre of [fr, publicFr] as Arbre[]) {
      for (const [cle, texte] of aplatir(arbre)) {
        expect(texte.includes("'"), cle).toBe(false);
      }
    }
  });
});
