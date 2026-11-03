import type { AbitoDef, AvatarDef } from './types.ts';

/** Il vestito si può indossare: con chr_base tutti (modelli `abt_<id>`), col protagonista a skin (chr_eroe) solo le skin. */
export const indossabile = (av: AvatarDef, a: AbitoDef): boolean => av.protagonista === 'chr_base' || !!a.skin;
/** Il vestito lo vende il Mercante: a pagamento e indossabile. */
export const venduto = (av: AvatarDef, a: AbitoDef): boolean => a.monete > 0 && indossabile(av, a);
