// Internacionalização: a chave é o texto em português; EN e ES vêm do dicionário.
import { DICT } from './i18n-dict.js';

let lang = 'pt';
export const LANGS = { pt: 'Português', en: 'English', es: 'Español' };
export const LOCALES = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
export function setLang(l) { lang = LANGS[l] ? l : 'pt'; if (typeof document !== 'undefined') document.documentElement.lang = LOCALES[lang]; }
export const getLang = () => lang;
export const locale = () => LOCALES[lang];

/** t('Olá, {nome}', {nome:'Karina'}) */
export function t(key, vars) {
  let s = lang === 'pt' ? key : (DICT[key]?.[lang] ?? key);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}
