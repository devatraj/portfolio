import { load } from 'js-yaml';
import raw from '../data/profile.yaml?raw';

export const profile = load(raw);

export const factById = Object.fromEntries(profile.facts.map((f) => [f.id, f]));

const ORG_LABEL = {
  jeevansathi: 'Jeevansathi',
  '99acres': '99acres',
  personal: 'Own project',
};

// milanSathi facts read better under the product's own name.
export function orgLabel(fact) {
  return fact.id.startsWith('milansathi') ? 'milanSathi' : ORG_LABEL[fact.org];
}

export const ordinal = (n) => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
