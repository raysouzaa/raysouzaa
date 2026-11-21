// Classificação das tarifas, estatísticas e controle do que já foi enviado.
import { weekday, WEEKDAYS_PT } from './dates.js';

export const fareKey = (f) => `${f.entry}-${f.exit}-${f.depart}-${f.back}`;
const routeKey = (f) => `${f.entry}-${f.exit}`;
const longestLeg = (f) => {
  const known = [f.durationOut, f.durationBack].filter((x) => x != null);
  return known.length ? Math.max(...known) : null;
};

/**
 * 'main'    → até rules.maxPrice e até rules.maxHours por trecho (duração desconhecida conta como ok)
 * 'special' → passou de maxHours, mas fica até special.maxHours e custa até special.maxPrice
 * null      → fora dos critérios
 */
export function classify(f, rules) {
  const leg = longestLeg(f);
  if (f.price <= rules.maxPrice && (leg == null || leg <= rules.maxHours * 60)) return 'main';
  if (f.price <= rules.special.maxPrice && leg != null && leg <= rules.special.maxHours * 60) return 'special';
  return null;
}

/** Remove duplicatas (mesma entrada/saída/datas) ficando com o menor preço. Prefere preço ao vivo do Google. */
export function dedupe(fares) {
  const best = new Map();
  for (const f of fares) {
    if (!Number.isFinite(f.price) || f.price <= 0) continue;
    const k = fareKey(f);
    const cur = best.get(k);
    if (!cur || f.price < cur.price || (f.source === 'Google Flights' && cur.source !== 'Google Flights')) best.set(k, f);
  }
  return [...best.values()].sort((a, b) => a.price - b.price);
}

/** Uma tarifa por par entrada/saída (a mais barata), para variar as opções no e-mail. */
export function onePerRoute(fares, n) {
  const seen = new Set();
  const out = [];
  for (const f of fares) {
    if (seen.has(routeKey(f))) continue;
    seen.add(routeKey(f)); out.push(f);
    if (out.length >= n) break;
  }
  return out;
}

export function byWeekday(fares) {
  const acc = Array.from({ length: 7 }, (_, i) => ({ day: WEEKDAYS_PT[i], n: 0, sum: 0, min: Infinity }));
  for (const f of fares) {
    const a = acc[weekday(f.depart)];
    a.n++; a.sum += f.price; a.min = Math.min(a.min, f.price);
  }
  return acc.filter((a) => a.n).map((a) => ({ day: a.day, n: a.n, avg: Math.round(a.sum / a.n), min: a.min }))
    .sort((a, b) => a.avg - b.avg);
}

/** Decide se vale mandar e-mail: há tarifa nova ou que ficou mais barata desde o último envio. */
export function newOrCheaper(fares, history, dropPct = 3) {
  const sent = history.sent || {};
  return fares.filter((f) => {
    const prev = sent[fareKey(f)];
    return prev == null || f.price <= prev * (1 - dropPct / 100);
  });
}

export function markSent(history, fares, now = new Date().toISOString()) {
  history.sent ??= {};
  for (const f of fares) history.sent[fareKey(f)] = f.price;
  history.lastEmail = now;
  return history;
}

export function recordRun(history, all, now = new Date().toISOString()) {
  history.runs ??= [];
  history.runs.push({ t: now, n: all.length, best: all[0]?.price ?? null, bestRoute: all[0] ? fareKey(all[0]) : null });
  if (history.runs.length > 500) history.runs.splice(0, history.runs.length - 500);
  history.bestEver = Math.min(history.bestEver ?? Infinity, all[0]?.price ?? Infinity);
  return history;
}
