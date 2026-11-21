// Google Flights via SerpApi: preço AO VIVO. Cota pequena (plano grátis: 250/mês), então é usado para
// conferir as melhores combinações achadas no Aviasales, ou, sem elas, testar algumas datas.
// Doc: https://serpapi.com/google-flights-api
import { candidatePairs, spreadPick, diffDays } from '../dates.js';

const BASE = 'https://serpapi.com/search.json';
const AIRPORT = { SAO: 'GRU', RIO: 'GIG', PAR: 'CDG', ROM: 'FCO', MIL: 'MXP', LON: 'LHR' };
const ap = (c) => AIRPORT[c] || c;

async function search(params, key) {
  const url = new URL(BASE);
  for (const [k, v] of Object.entries({ engine: 'google_flights', hl: 'pt', gl: 'br', api_key: key, ...params })) {
    url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

function best(json) {
  const list = [...(json.best_flights || []), ...(json.other_flights || [])].filter((f) => f.price);
  list.sort((a, b) => a.price - b.price);
  return list[0] || null;
}

/** Consulta uma combinação (ida e volta ou "chega em X, volta de Y") numa data exata. */
async function liveFare(cfg, key, { entry, exit, depart, back }) {
  const sameCity = entry === exit;
  const params = sameCity
    ? { type: '1', departure_id: cfg.origin, arrival_id: ap(entry), outbound_date: depart, return_date: back }
    : {
      type: '3',
      multi_city_json: JSON.stringify([
        { departure_id: cfg.origin, arrival_id: ap(entry), date: depart },
        { departure_id: ap(exit), arrival_id: cfg.origin, date: back },
      ]),
    };
  const json = await search({ ...params, currency: cfg.currency, max_duration: String(cfg.rules.special.maxHours * 60) }, key);
  const f = best(json);
  if (!f) return null;
  return {
    source: 'Google Flights', kind: sameCity ? 'ida e volta' : 'multidestino (1 bilhete)',
    entry, exit, depart, back, days: diffDays(depart, back), price: f.price,
    airline: [...new Set((f.flights || []).map((x) => x.airline))].join(' / '),
    stops: Math.max(0, (f.flights?.length || 1) - 1), returnStops: null,
    durationOut: f.total_duration ?? null, durationBack: null,
    entryAirport: ap(entry), exitAirport: ap(exit),
    priceLevel: json.price_insights?.price_level || null,
    link: json.search_metadata?.google_flights_url || null,
  };
}

/** Confere ao vivo as melhores combinações (uma por par entrada/saída). */
export async function verifyLive(cfg, key, candidates, log = console) {
  const budget = cfg.serpapi?.maxSearchesPerRun ?? 4;
  const seen = new Set();
  const picks = [];
  for (const c of candidates) {
    const k = `${c.entry}-${c.exit}`;
    if (seen.has(k)) continue;
    seen.add(k); picks.push(c);
    if (picks.length >= budget) break;
  }
  // Sem candidatos do Aviasales: testa algumas datas nas cidades de fallback.
  if (!picks.length) {
    const dests = cfg.serpapi?.fallbackDestinations ?? ['LIS'];
    const pairs = spreadPick(candidatePairs(cfg), Math.max(1, Math.floor(budget / dests.length)));
    for (const p of pairs) for (const d of dests) picks.push({ entry: d, exit: d, depart: p.depart, back: p.ret });
  }
  const out = [];
  for (const p of picks.slice(0, budget)) {
    try {
      const r = await liveFare(cfg, key, p);
      if (r) out.push(r);
    } catch (e) {
      log.warn(`[google] ${p.entry}/${p.exit} ${p.depart}: ${e.message}`);
    }
  }
  log.log(`[google] ${out.length} preços ao vivo (${picks.slice(0, budget).length} buscas)`);
  return out;
}
