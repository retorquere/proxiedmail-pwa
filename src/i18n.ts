import { FluentBundle, FluentResource } from '@fluent/bundle';
import enSource from './locales/en.ftl?raw';
import esSource from './locales/es.ftl?raw';

export type Locale = 'en' | 'es';

type Values = Record<string, string | number>;
const resources: Record<Locale, string> = { en: enSource, es: esSource };
let locale: Locale = (localStorage.getItem('proxiedmail-locale') as Locale) || (navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en');

function bundleFor(selected: Locale): FluentBundle {
  const bundle = new FluentBundle(selected);
  bundle.addResource(new FluentResource(resources[selected]));
  return bundle;
}

export function getLocale(): Locale { return locale; }
export function setLocale(next: Locale): void { locale = next; localStorage.setItem('proxiedmail-locale', next); }
export function t(key: string, values: Values = {}): string {
  const id = key.replace(/\./g, '-').replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  const selected = bundleFor(locale);
  const message = selected.getMessage(id);
  const pattern = message?.value;
  if (pattern) return selected.formatPattern(pattern, values);
  if (locale !== 'en') {
    const fallback = bundleFor('en').getMessage(id)?.value;
    if (fallback) return bundleFor('en').formatPattern(fallback, values);
  }
  return key;
}

export function formatDate(date = new Date()): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date);
}
