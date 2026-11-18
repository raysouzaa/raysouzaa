// Utilitários de data. Trabalha só com strings "YYYY-MM-DD" (sem fuso) para evitar surpresas.

const DAY_MS = 86_400_000;
export const WEEKDAYS_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const toUTC = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const fromUTC = (ms) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (iso, n) => fromUTC(toUTC(iso) + n * DAY_MS);
export const diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
export const weekday = (iso) => new Date(toUTC(iso)).getUTCDay();
export const datePart = (s) => String(s).slice(0, 10);
export const fmtBR = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export function inBlackout(iso, blackouts = []) {
  return blackouts.find((b) => iso >= b.from && iso <= b.to) || null;
}

/** Meses (YYYY-MM) que cobrem o intervalo [from, to]. */
export function monthsBetween(from, to) {
  const out = [];
  let y = +from.slice(0, 4);
  let m = +from.slice(5, 7);
  const endKey = to.slice(0, 7);
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    out.push(key);
    if (key >= endKey) break;
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

/**
 * Gera pares (ida, volta) candidatos dentro da janela, priorizando dias de semana
 * que costumam ser mais baratos e evitando feriados.
 */
export function candidatePairs(cfg) {
  const { departFrom, departTo, minDays, maxDays } = cfg.window;
  const depW = new Set(cfg.preferredDepartWeekdays ?? [0, 1, 2, 3, 4, 5, 6]);
  const retW = new Set(cfg.preferredReturnWeekdays ?? [0, 1, 2, 3, 4, 5, 6]);
  const pairs = [];
  for (let d = departFrom; d <= departTo; d = addDays(d, 1)) {
    if (!depW.has(weekday(d)) || inBlackout(d, cfg.blackouts)) continue;
    for (let len = minDays; len <= maxDays; len++) {
      const r = addDays(d, len);
      if (!retW.has(weekday(r)) || inBlackout(r, cfg.blackouts)) continue;
      pairs.push({ depart: d, ret: r, days: len });
    }
  }
  return pairs;
}

/** Escolhe N pares bem espalhados na janela (para APIs com cota baixa). */
export function spreadPick(list, n) {
  if (list.length <= n) return list;
  const step = (list.length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => list[Math.round(i * step)]);
}
