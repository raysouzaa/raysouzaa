// Google Flights via SerpApi (preço ao vivo; cota limitada, então busca poucas datas por rodada).
// Doc: https://serpapi.com/google-flights-api
import { candidatePairs, spreadPick } from '../dates.js';

const BASE = 'https://serpapi.com/search.json';

// SerpApi usa códigos de aeroporto; mapeia códigos de cidade comuns.
const AIRPORTS = {
  SAO: 'GRU', RIO: 'GIG', PAR: 'CDG', ROM: 'FCO', MIL: 'MXP', LON: 'LHR',
};
const ap = (c) => AIRPORTS[c] || c;

async function search(params, key) {
  const url = new URL(BASE);
  const all = { engine: 'google_flights', hl: 'pt', gl: 'br', api_key: key, ...params };
  for (const [k, v] of Object.entries(all)) url.searchParams.set(k, String(v));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpApi HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.error) throw new Error(`SerpApi: ${json.error}`);
  return json;
}

function bestOf(json) {
  const list = [...(json.best_flights || []), ...(json.other_flights || [])].filter((f) => f.price);
  list.sort((a, b) => a.price - b.price);
  return list[0] || null;
}

/** Busca ida e volta ao vivo em algumas datas espalhadas pela janela (destinos em cfg.serpapi.destinations). */
export async function searchLive(cfg, key) {
  const budget = cfg.serpapi?.maxSearchesPerRun ?? 6;
  const origin = cfg.origins[0];
  const codes = cfg.serpapi?.destinations ?? [cfg.destinations[0].code];
  const routes = codes.map((c) => ({
    out: c, back: c, label: cfg.destinations.find((d) => d.code === c)?.name || c,
  }));
  const pairs = spreadPick(candidatePairs(cfg), Math.max(1, Math.floor(budget / routes.length)));
  const results = [];
  let used = 0;

  for (const p of pairs) {
    for (const r of routes) {
      if (used >= budget) break;
      used++;
      try {
        const json = await search({
          type: 1, departure_id: ap(origin), arrival_id: ap(r.out),
          outbound_date: p.depart, return_date: p.ret, currency: cfg.currency,
          ...(cfg.maxFlightHours ? { max_duration: cfg.maxFlightHours * 60 } : {}),
        }, key);
        const f = bestOf(json);
        if (!f) continue;
        const first = f.flights?.[0];
        results.push({
          source: 'Google Flights', origin: ap(origin), destination: ap(r.out), returnFrom: ap(r.back),
          destName: r.label, depart: p.depart, ret: p.ret, days: p.days,
          price: f.price, currency: cfg.currency,
          airline: [...new Set((f.flights || []).map((x) => x.airline))].join(' / '),
          stops: Math.max(0, (f.flights?.length || 1) - 1), durationOut: f.total_duration ?? null, durationBack: null,
          priceLevel: json.price_insights?.price_level || null,
          typicalRange: json.price_insights?.typical_price_range || null,
          link: json.search_metadata?.google_flights_url || null,
          departTime: first?.departure_airport?.time || null,
        });
      } catch (e) {
        console.warn(`[serpapi] ${r.out} ${p.depart}: ${e.message}`);
      }
    }
  }
  return results;
}
