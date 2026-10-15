// Gli sprite in pixel art degli oggetti delle Corse (#250): disegnati a lettere (una lettera = un colore della palette, '.' = trasparente),
// dalla concept degli oggetti (assets/concept/corse/corse_20_oggetti.jpg) ridotta a pixel. Diventano texture nearest.
import * as THREE from 'three';
import { P } from '../render/island_parts.ts';

const PAL: Record<string, string> = {
  g: P.giallo, a: P.arancio, b: P.ambraNeon, c: P.legnoChiaro, l: P.legno, s: P.legnoScuro, n: P.neroCaldo, h: P.sabbiaChiara,
  r: P.rosso, o: P.rossoNeon, w: P.pietraChiara, p: P.pietra, k: P.pietraScura, q: P.roccia, u: P.acquaProfonda, v: P.acqua, x: P.acquaBassa,
  e: P.erbaChiara, m: P.erba, d: P.erbaScura, t: P.bosco,
};

/** La buccia di banana (Jack, 12 ott: «la banana deve avere uno sprite a forma di banana»). */
export const BUCCIA = [
  '...................lllls................',
  '...................ssssn................',
  '...................ssssn................',
  '...................sssss................',
  '....................llsl................',
  '...................baall................',
  '..................ggaaaaaa..............',
  '.................bbggbbaaa..............',
  '.................bgggbbbbaa.............',
  '................gbgggbabaaa.............',
  '................bggggbababaa............',
  '................bgggggbbbaaa............',
  '................bgbgggbbaaaa............',
  '................angggnbbaaaa............',
  '................angggnbbaaaa............',
  '................angggnbbaaaa............',
  '...............gbgaglgbbaaaa............',
  '...............bbgggggbaaaaa............',
  '...............bbgggggbaaaaa......lls...',
  '...l..........bbbgggggbabaaaa...gbacs...',
  '..sllb.....abbbagggggabbbaaaa.ggggga....',
  '..slbbbggggabgbbggggglbbbbbbcabgggba....',
  '..slagggggggggagggggglbgbbbbacabbbaa....',
  '...laagggggggaagggggblbgbbbbblcaacc.....',
  '....aaabbgbaacgggbggalaggggggblllc......',
  '......caaaaalbggggggaslbgggggggg........',
  '............gggggggaa..abggggggggggcll..',
  '.........bggggggggaa....bbggggggggalsn..',
  '........lllabgggaaa......aabgggggaalsn..',
  '........lllaaaaaac........aaaaaaaalss...',
  '..........lllca.............aaaalc......',
];

/** La scatola degli oggetti della Spiaggia (Jack, 12 ott: «Cassa del relitto», assets/concept/corse/corse_21_scatole.jpg, ricalcata a mano
 *  16×16): i fianchi con la stella marina e la cima con la corda a croce. Le altre zone hanno la loro (SCATOLE in oggetti3d.ts). */
export const CASSA_FIANCO = [
  'qqqssssssssssqqq',
  'qkqccccccccccqkq',
  'qqqccccccccccqqq',
  'sccccccrrccccccs',
  'sccccccrrccccccs',
  'ssssssrorrssssss',
  'sllrrrroorrrrlls',
  'slllrroogorrllls',
  'sllllrrggrrlllls',
  'sllllrrrrrrlllls',
  'ssssrrrssrrrssss',
  'scccrrccccrrcccs',
  'scccrccccccrcccs',
  'qqqccccccccccqqq',
  'qkqccccccccccqkq',
  'qqqssssssssssqqq',
];
export const CASSA_CIMA = [
  'qqqssssssssssqqq',
  'qkqccsllllsccqkq',
  'qqqccsllllsccqqq',
  'schhcsllllschhcs',
  'scchhsllllshhccs',
  'sccchhllllhhcccs',
  'scccchhllhhccccs',
  'sccccshhhhsccccs',
  'sccccslhhlsccccs',
  'sccccshhhhsccccs',
  'scccchhllhhccccs',
  'sccchhllllhhcccs',
  'scchhsllllshhccs',
  'qqqhcsllllschqqq',
  'qkqccsllllsccqkq',
  'qqqssssssssssqqq',
];

/** La scatola della Giungla (Jack, 12 ott: «Blocco del tempio», assets/concept/corse/corse_22_giungla_oggetti.jpg, ricalcato a mano 16×16):
 *  pietra a mattoni col glifo d'oro, la cima a lastre col muschio. */
export const BLOCCO_FIANCO = [
  'mdmkkkmmkkkmdkkk',
  'kqqqpkwdpppkqqqm',
  'kqpqpkwppppkqpqd',
  'kqqqkkgkkgkkqqqk',
  'kwkwwwgwkgwwwwkk',
  'kpkwggggggggppkk',
  'kpkwpgbbbbgpppkm',
  'kkkgggbggbgggkmd',
  'kwwwwgbggbgkwwwk',
  'mppppgbbbbgkwppk',
  'dmppggggggggwppk',
  'kkkkkkgkkgkkkkkk',
  'kqqqwwgwkgwwqqqm',
  'kqpqppppkwppqpqk',
  'kqqqppppkwppqqqk',
  'kkkmdkkkkkkkkdmk',
];
export const BLOCCO_CIMA = [
  'kkkkkkmkkkkkkkkk',
  'kdmpkwpmdkwppdkk',
  'kmpdkwpmpkwpmmkk',
  'kpppkwpppkwpppmk',
  'kkkkkkkkkkkkkkkk',
  'kwwwkwwwwkwwwwkk',
  'kpppkdpppmmpppkk',
  'kpdmkwpppkdmppkk',
  'kppmkwpppkwpppkk',
  'kkdkkkkkkkkkkkmk',
  'kwwwkwwwwkwwwwkk',
  'kpppkwmdpkwpppkk',
  'kpppkwpmmkwpdpkk',
  'kdppkwpppkwpmmkk',
  'kmmkkkkkkkkkkkkk',
  'kkkkkkkkkkkkkkkk',
];

// Gli altri oggetti, ridotti dalla concept con tools/sprite_oggetti.py (le icone della casella e del bottone USA; la pallonata anche in pista).
// <generati> (tools/sprite_oggetti.py --scrivi: non toccare a mano)
export const LATTINA = [
  '.............................qq.......',
  '........................rrr.qqqqq.....',
  '.......................rrrrwwpppkkp...',
  '......................rrrrrwwppprrr...',
  '....................rrrrrabwwkkwkrnr..',
  '..............kqq...rrrrraarwpkpqrqrp.',
  '............kkkkk..rrrrrrrrrwwpkpprrpw',
  '...........kkkkkq.rrrrrrwrrrrpwpqqkkqp',
  '.........kkkkkkqrwrrrrrwwwrrrppwpppkqp',
  '.........qkkqqnrwrrrrrrwwwrrrrpkpppkkp',
  '..........qkqqnrrrrrwrwwwrrrrrrkkppppp',
  '............qkrrrrrwwrrwwrrrrrrrrkkkk.',
  '.........arrkkrrrrwwrrrpprrrrrrrrrrn..',
  '.......aaarrkkqrrrwwrrwprrrrrrrrrrr...',
  '.....aaaagggbkqrrwwwrwpprrrrrrrrrrr...',
  '.....argggggbkqqwwwrpppprrrrrrrrr.....',
  '..rrrrbgggggrqqqwwrrrprrrrrrrrr.......',
  '..rrraagggwwrrqqqprrrrrrrrrkr.........',
  '...rrgggggwwgaqqqnrrrnnqnppw..........',
  '..rbggggggggggaqnnnnnqqqqww...........',
  'rrrbbgaaaggggrrqnnnnqqqnn.............',
  'rrrrrraaagggrrrwwqqqqqqn..............',
  '..rrrraaarrrrrwwqqqqqqq...............',
  '..rrrrrwrrrrwwwwwqqqq.................',
  '.......wrr.wwww.qqq...................',
];
export const TRIS = [
  '..........pp.pp...............rrrr.........',
  '.........prw.ppr.............rrrrrr........',
  '.....kqrrrwrrpkrr............rrwrrrw.......',
  '...kqqqrrrwrr.nkk..........prrrwwwrrqqkk...',
  '...kqqrrrwrrrrpp...........krrrwrrrrrqqk...',
  '....qrrwrwrrrrrp............rrrrwrwrrqnq...',
  '..aaakwppprrrrrr............rrrrrpwwpaan...',
  '..agggprrrrrrr...............rrrrrrqkwbga..',
  'ragggqqrnnkr...................pkrrqaaggbr.',
  'abgggrnnqq......................kkkqrgwggr.',
  'rrabarnqqn..........rrr.qkqk.....kkqnrwagrr',
  '......qq...........rrrr.kpprr.....qq.rwrrrr',
  '..............kk..rrraa.kkkrr..............',
  '.............kkkqrrrrrrr.kpprr.............',
  '...........kkkkqwrrrrwrr.pqqkq.............',
  '...........kkkqrrrrrwwrrrkpppk.............',
  '............qqrrrwwrwrrrrrkkpp.............',
  '.........rrrrarrrwrrwrrrrrrkk..............',
  '.........rbggaawwwrwwrrrrrrrn..............',
  '.......rrbbggrqwwrwwrrrrrrr................',
  '.......rrggggrqqrrrrrrrrr..................',
  '......raagggggqnnrqqnkp....................',
  '......rrrrabbrrqqqqq.......................',
  '..........rrrwwkkkk........................',
];
export const PALLA = [
  '.........rrrxx..........',
  '......rrrrrrrxxxxu......',
  '....rrrrrrrrrrxxxuu.....',
  '...rrrrrrrrrrrrxxuuu....',
  '..rrrwwrrrrrrrrxxuuuu...',
  '..wwwwwwwwrrrrwwwwwuuu..',
  '.wwwwwwwwwwwwwwwwwwuugu.',
  '.wwwwwwwwwwwwwwwwwwwggg.',
  'wwwwwwwwwwwwwwwwwwwwggg.',
  'wwwwwwwwwwrrrwwwwwwwgggg',
  'wwwwwwwrrrrrrrwwwwwuuggg',
  'wwwwwwrrrrrrrrrpppuuuggg',
  'wwwwwrrrrrrrrrrwwwuuuugg',
  'pwwrrrrrrrrrrrwwwwuuuuur',
  'pwwrrrrrrrrrrrwwwwuuuuur',
  'pprrrrrrrrrrrwwwwwuuuuuu',
  'krrrrrrrrrrrrwwwwwwuuuu.',
  'rrrrrrrrrrrrwwwwwwwuuuu.',
  '.rrrrrrrrrrpwwwwwwwuuu..',
  '.rrrrrrrrrrwwwwwwwuuuu..',
  '..rrrrrrrrppppppppuuu...',
  '...rrrrrrpppppppppuu....',
  '....rrrrpppppppppuu.....',
  '......rkkppkkpkku.......',
];
export const RAZZO = [
  '.............................rr...........',
  '..........................wrrrrrrrrrnr....',
  '........................wwwrrrrrrnnnwwrrr.',
  '.....................wwwwwwrrrrrnnwwwwwrrr',
  '...................wwwwwwwrrrrrnnwwwrrwwrr',
  '.................wwwwwwwwwrrrrrnnwwwnnnwrr',
  '.............rrwwwwwwwnwwwrrrrrnnwwwnnnwrr',
  '...........rrrrrrwwwnqwwwwrrrrrnnwwwwnrwwr',
  '.........rrrrrrrrrwqqqwwwwrrrrrnnnwwwwrwp.',
  '.........rrrrrrrpwwqqqwwwwrrrrrrnnwwwwppn.',
  '.........wrrrrnnwwwqkkwwwwrrrrrrnnnppwnn..',
  '..........wwrnnnwwwrkkrwwwwrrrrrrnnnnnn...',
  '..........wwwqqnwwwrkkrwwwwrrrrrrrnnrr....',
  '........aaarqqqnwwwrkqnrwwwprqrrrrrrrr....',
  '.......aaaabrqqnwwwwrqqnwpppprrrrrrrr.....',
  '..aa...abbbbrrqnwwwwrqnnnpppppnrrrrr......',
  '..aa..aabbggrrnnnwwwwnnnnnpppp..rrrr......',
  '.....aaabggggrnnnwppppnnnnnww.............',
  '....aaabbgggggrnnnppppknnww...............',
  'aa..aabbbggggbrnnnnppknwww................',
  'aa..aabbaabbbbrnnnnnnnnn..................',
  '....aaaaaabbaarwwnnnnrn...................',
  '......aaaaaaaa..wrrrrrn...................',
  '..aa......aa.....rrrrr....................',
  '..aa............rrrrp.....................',
  '................rpppp.....................',
];
export const SALVAGENTE = [
  '............cc...rrr................',
  '...........crrrrrrrrrww.............',
  '.......cclrrrrrrrrrrwwwwwwlcc.......',
  '.....ccsswwcrrrrrrrrwwwwwwwslc......',
  '.....cswwwwrrrrrrrrrwwwwwwwwwlc.....',
  '...cclwwwwwwrrrrrrrrwwwwwwwrrrcc....',
  '...cswwwwwwwprrrrrrrwwwwwcrrrrrc....',
  '..cswwwwwwwpwrssssssppwwwccrrrrlw...',
  '..clwwwwwwwwpssssssspppwrrcrrrrrcc..',
  '..clwwwwwwpwpsssppppkkpprrccrrrrrcc.',
  '..clrccrrrpkkppppppppppprrrcrrrrssc.',
  '..crrccrrrrkpppppppppppprrrcrrrrrwc.',
  '..crrccrrrrsppp......pppsr.wwrrrswcc',
  '.ccrrrrrrrrrpw.........pp..wwwprswcc',
  'ccsrrrrrrrrrwww...........wwwwpwsccs',
  'ccwrrrrrrrrrwwwwwwwwwwwwwwwwwwpwscl.',
  'ccwwrrrrrrwwwwwwwwwwwrrcwwwwwpwplls.',
  '.cccrrrrrwwwwwwwwrrrrcpcrrwwwwwkl...',
  '.cccsrrrrwwwwwwwwrrrrrrrrrrpwwpsl...',
  '.llssrrrwwwwwwwwwrrrrrrrrrrwwpksc...',
  '..lccsrrwwwwwwwwwrrrrrrrrrrppppsc...',
  '....ccsswwwwwwwwwrrrrrrrrrsppppcc...',
  '....llccppppwwwwrrrrrrrrssssppccl...',
  '......llkpppppppcsssssscccspcccl....',
  '..........pkpppkccsssssccllccll.....',
  '............kkkkllcccclllllll.......',
];
export const COCCO = [
  '.......sllcclllll.....',
  '......lllsclllclll....',
  '....sslllcccclllhsls..',
  '...sllllccllllwwhhhs..',
  '..sslsllcccclhwhhhhpl.',
  '..lllllllllllwhhnshhh.',
  '.sslllccccclhwhhnshphl',
  '.ssslllcclcllhhhhhhnhl',
  '.sllllllllcclhhhhhnnps',
  'sssslllllclllhhnnhhnpl',
  'sslslllllllllhhhshhppl',
  'ssssslllllllllhhphhpps',
  '.nslllsslllllshphhppps',
  '.nsssssslsllllllpppps.',
  '.sssslsslllsslsssssss.',
  '..nnssnsssssssssssss..',
  '...ssssssssssssssnnn..',
  '....nnnssnnsssssss....',
  '.....ssnnnssnnssn.....',
  '......nnnsnnssn.......',
];
export const MASSO = [
  '...........dmmmp...........',
  '........mdmpndddpkpp.......',
  '.......ttppppppwpppppp.....',
  '.....ddmkpppppwppkppkpp....',
  '....dmdmtpwqqqkppwpmdppk...',
  'pk..tndmtpqqwwkkqppmddkkk..',
  'kq.kkpktpdqppppppqkmddkqk..',
  '...kkpkppkkppqqpppqqqppddk.',
  '..dkkkppkkppqppqppqppqqtdtd',
  '.dddkkppkkppkppqpppppppqndt',
  '.tdtpppqkpppppqpppppqpppndt',
  '.dtkkqqppqqqpppppppqpqqpqdt',
  '.qddkqkppkpppppppppqppqpntt',
  '.qqtdkkkkpppnpppqpppqqppqqq',
  '.qkqdddkqppqqqqppppkkpppqqq',
  '.qqqtttqqppqqpqqqpppqkkqkq.',
  '.qqqqnnqkkpqppppqnkkqkkqkq.',
  '..qqqdtqqnppkkkpqqkkqqndqq.',
  '..qqqtddqqqqkkkkqkkqqqttq..',
  'pk.nnnttkkkqqqkkkkkqkknqk..',
  'qq.nqqqttkqkkqqqkknqkkqq...',
  '....qqqqqqkqkkqqnqnqqqq....',
  '.....wqqqqqqqqqqtdqnqq..kp.',
  '.......qqqqqqnqqtnnnq...qk.',
  '.........qqnqqqqnnn........',
  '............nqnn...........',
];
export const LIANA = [
  '................mmtt...ee...',
  '................dmtdd..ee...',
  '................ttmmnt......',
  '.................tdmltt.....',
  '...............ddtdmclt.....',
  '..............ddtntdll......',
  '.............dddt..tclttdd..',
  '.............ddd...nlstddtt.',
  '.............dd....clnndmddd',
  '.....ee...........scsn..dddt',
  '....eeeem.........ssdt..dmdt',
  '...mmdtmd.........ddtn...ddt',
  '..mmdd.md........dmtn.....dt',
  '.mmtd...........tdnss.......',
  'mmmdd...........tlcn........',
  'mmmdd..........dllsnttt.....',
  'mmtnt.....ddd..dcsntdtt.....',
  'mmtctd....ddtdmddtn.ddd.....',
  'ddnclnt....tndmdtt..ddt.....',
  '.dtncsdd.ldtllsn.....dt.....',
  '.ttnsctmdccclsn.............',
  '...tnsldddslss..............',
  '....tnsnttnn................',
  '....dt...nn.................',
];
// </generati>

/** Le righe di lettere → icona (data URL di un PNG, `scala` px per pixel): da usare con image-rendering: pixelated. */
export function iconaPixel(righe: readonly string[], scala = 2): string {
  if (typeof document === 'undefined') return '';
  const h = righe.length, w = righe[0]!.length, cv = document.createElement('canvas');
  cv.width = w * scala; cv.height = h * scala;
  const g = cv.getContext('2d');
  if (!g) return '';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = righe[y]![x]!;
    if (ch === '.' || !PAL[ch]) continue;
    g.fillStyle = PAL[ch]; g.fillRect(x * scala, y * scala, scala, scala);
  }
  return cv.toDataURL('image/png');
}

/** Le righe di lettere → texture (nearest, senza mipmap: pixel netti). */
export function texturePixel(righe: readonly string[]): THREE.DataTexture {
  const h = righe.length, w = righe[0]!.length, d = new Uint8Array(w * h * 4), c = new THREE.Color();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = righe[y]![x]!, i = ((h - 1 - y) * w + x) * 4; // le righe vanno dall'alto, la texture dal basso
    if (ch === '.' || !PAL[ch]) continue;
    c.set(PAL[ch]).convertLinearToSRGB();
    d[i] = Math.round(c.r * 255); d[i + 1] = Math.round(c.g * 255); d[i + 2] = Math.round(c.b * 255); d[i + 3] = 255;
  }
  const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
  return t;
}
