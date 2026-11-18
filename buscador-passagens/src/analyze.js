// Análise dos resultados: melhores ofertas, dia da semana mais barato, quedas de preço.
import { weekday, WEEKDAYS_PT } from './dates.js';

const key = (r) => `${r.origin}-${r.destination}-${r.returnFrom}`;

export function dedupe(results) {
  const best = new Map();
  for (const r of results) {
    if (!Number.isFinite(r.price) || r.price <= 0) continue;
    const k = `${key(r)}|${r.depart}|${r.ret}`;
    if (!best.has(k) || best.get(k).price > r.price) best.set(k, r);
  }
  return [...best.values()].sort((a, b) => a.price - b.price);
}

/** Média e mínimo por dia da semana de embarque: mostra em quais dias costuma estar mais barato. */
export function byWeekday(results) {
  const acc = Array.from({ length: 7 }, (_, i) => ({ day: WEEKDAYS_PT[i], n: 0, sum: 0, min: Infinity }));
  for (const r of results) {
    const a = acc[weekday(r.depart)];
    a.n++; a.sum += r.price; a.min = Math.min(a.min, r.price);
  }
  return acc.filter((a) => a.n).map((a) => ({ day: a.day, n: a.n, avg: Math.round(a.sum / a.n), min: a.min }))
    .sort((a, b) => a.avg - b.avg);
}

/** Melhor preço por rota (destino). */
export function bestByRoute(results) {
  const m = new Map();
  for (const r of results) if (!m.has(key(r)) || m.get(key(r)).price > r.price) m.set(key(r), r);
  return [...m.values()].sort((a, b) => a.price - b.price);
}

/** Compara com o histórico e marca ofertas que caíram ou estão abaixo do limite. */
export function findDeals(routesBest, history, alerts) {
  const deals = [];
  for (const r of routesBest) {
    const prev = history.routes?.[key(r)]?.best;
    const dropPct = prev ? ((prev - r.price) / prev) * 100 : 0;
    const reasons = [];
    if (r.price <= alerts.priceThreshold) reasons.push(`abaixo de ${alerts.priceThreshold}`);
    if (prev && dropPct >= alerts.dropPercent) reasons.push(`caiu ${dropPct.toFixed(0)}% (antes ${prev})`);
    if (r.priceLevel === 'low') reasons.push('Google indica preço BAIXO');
    if (reasons.length) deals.push({ ...r, reasons, prev });
  }
  return deals;
}

export function updateHistory(history, routesBest, now = new Date().toISOString()) {
  history.routes ??= {};
  for (const r of routesBest) {
    const h = (history.routes[key(r)] ??= { best: r.price, points: [] });
    h.best = Math.min(h.best, r.price);
    h.last = r.price;
    h.points.push({ t: now, p: r.price, d: r.depart, r: r.ret });
    if (h.points.length > 200) h.points.splice(0, h.points.length - 200);
  }
  history.lastRun = now;
  return history;
}
