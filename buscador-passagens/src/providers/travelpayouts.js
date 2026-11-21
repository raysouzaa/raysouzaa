// Aviasales / Travelpayouts Data API (gratuita; preços em cache das buscas dos últimos dias).
// Doc: https://support.travelpayouts.com/hc/en-us/articles/203956163
import { datePart, diffDays, monthsBetween, addDays } from '../dates.js';

const BASE = 'https://api.travelpayouts.com/aviasales/v3/prices_for_dates';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(params, token) {
  const url = new URL(BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { 'X-Access-Token': token, 'Accept-Encoding': 'gzip' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  if (json.success === false) throw new Error(json.error || 'erro desconhecido');
  await sleep(250); // educação com a API
  return json.data || [];
}

const link = (l) => (l ? `https://www.aviasales.com${l}` : null);

async function oneWay(origin, destination, month, cfg, token) {
  const data = await call({
    origin, destination, departure_at: month, one_way: true, direct: false, unique: false,
    sorting: 'price', currency: cfg.currency.toLowerCase(), limit: 1000, page: 1,
  }, token);
  return data.map((it) => ({
    date: datePart(it.departure_at), price: Number(it.price), airline: it.airline || '',
    stops: it.transfers ?? null, duration: it.duration_to ?? it.duration ?? null,
    from: it.origin_airport || origin, to: it.destination_airport || destination, link: link(it.link),
  }));
}

function windowMonths(cfg) {
  const { departFrom, departTo, minDays, maxDays } = cfg.window;
  return {
    dep: monthsBetween(departFrom, departTo),
    ret: monthsBetween(addDays(departFrom, minDays), addDays(departTo, maxDays)),
  };
}

const okWindow = (cfg, depart, back) => {
  const { departFrom, departTo, minDays, maxDays } = cfg.window;
  const days = diffDays(depart, back);
  return depart >= departFrom && depart <= departTo && days >= minDays && days <= maxDays;
};

/**
 * Busca tudo saindo de cfg.origin:
 *  - ida e volta (mesma cidade) para cada cidade de entrada que também serve de volta;
 *  - trechos só de ida (entrada) e só de volta (saída), combinados em "chega em X, volta de Y".
 */
export async function searchAll(cfg, token, log = console) {
  const origin = cfg.origin;
  const { dep, ret } = windowMonths(cfg);
  const cap = Math.max(cfg.rules.maxPrice, cfg.rules.special.maxPrice) * 1.15; // corta o que nunca vai interessar
  const fares = [];
  const warn = (what, e) => log.warn(`[aviasales] ${what}: ${e.message}`);

  // 1) Ida e volta pela mesma cidade.
  for (const city of cfg.entryCities.filter((c) => cfg.returnCities.includes(c))) {
    for (const dm of dep) {
      for (const rm of ret) {
        if (rm < dm) continue;
        try {
          const data = await call({
            origin, destination: city, departure_at: dm, return_at: rm, one_way: false, direct: false,
            unique: false, sorting: 'price', currency: cfg.currency.toLowerCase(), limit: 1000, page: 1,
          }, token);
          for (const it of data) {
            const depart = datePart(it.departure_at);
            const back = it.return_at ? datePart(it.return_at) : null;
            if (!back || !okWindow(cfg, depart, back) || it.price > cap) continue;
            fares.push({
              source: 'Aviasales', kind: 'ida e volta', entry: city, exit: city, depart, back,
              days: diffDays(depart, back), price: Number(it.price), airline: it.airline || '',
              stops: it.transfers ?? null, returnStops: it.return_transfers ?? null,
              durationOut: it.duration_to ?? null, durationBack: it.duration_back ?? null,
              entryAirport: it.destination_airport || city, exitAirport: it.destination_airport || city,
              link: link(it.link),
            });
          }
        } catch (e) { warn(`${origin}⇄${city} ${dm}/${rm}`, e); }
      }
    }
  }

  // 2) Trechos avulsos para montar entrada/saída por cidades diferentes.
  const outs = [];
  for (const city of cfg.entryCities) {
    for (const m of dep) {
      try { outs.push(...(await oneWay(origin, city, m, cfg, token)).map((o) => ({ ...o, city }))); } catch (e) { warn(`${origin}→${city} ${m}`, e); }
    }
  }
  const backs = [];
  for (const city of cfg.returnCities) {
    for (const m of ret) {
      try { backs.push(...(await oneWay(city, origin, m, cfg, token)).map((b) => ({ ...b, city }))); } catch (e) { warn(`${city}→${origin} ${m}`, e); }
    }
  }
  // Mantém só o mais barato por cidade+dia em cada lado (reduz combinações).
  const cheapest = (list) => {
    const m = new Map();
    for (const x of list) {
      const k = `${x.city}|${x.date}`;
      if (!m.has(k) || m.get(k).price > x.price) m.set(k, x);
    }
    return [...m.values()];
  };
  const O = cheapest(outs); const B = cheapest(backs);
  for (const o of O) {
    for (const b of B) {
      if (o.city === b.city) continue; // mesma cidade já veio como ida e volta
      if (!okWindow(cfg, o.date, b.date)) continue;
      const price = o.price + b.price;
      if (price > cap) continue;
      fares.push({
        source: 'Aviasales', kind: '2 bilhetes', entry: o.city, exit: b.city, depart: o.date, back: b.date,
        days: diffDays(o.date, b.date), price, airline: [o.airline, b.airline].filter(Boolean).join(' / '),
        stops: o.stops, returnStops: b.stops, durationOut: o.duration, durationBack: b.duration,
        entryAirport: o.to, exitAirport: b.from, link: o.link, link2: b.link,
      });
    }
  }
  log.log(`[aviasales] ${fares.length} combinações (${O.length} idas, ${B.length} voltas avulsas)`);
  return fares;
}
