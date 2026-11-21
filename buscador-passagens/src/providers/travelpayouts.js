// Aviasales / Travelpayouts Data API (gratuita, preços em cache das buscas dos últimos dias).
// Doc: https://support.travelpayouts.com/hc/en-us/articles/203956163
import { datePart, diffDays, monthsBetween, addDays } from '../dates.js';

const BASE = 'https://api.travelpayouts.com/aviasales/v3/prices_for_dates';

async function call(params, token) {
  const url = new URL(BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { 'X-Access-Token': token, 'Accept-Encoding': 'gzip' } });
  if (!res.ok) throw new Error(`Travelpayouts HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.success === false) throw new Error(`Travelpayouts: ${json.error || 'erro desconhecido'}`);
  return json.data || [];
}

function normalize(item, currency, extra = {}) {
  const depart = datePart(item.departure_at);
  const ret = item.return_at ? datePart(item.return_at) : null;
  return {
    source: 'Aviasales',
    origin: item.origin_airport || item.origin,
    destination: item.destination_airport || item.destination,
    returnFrom: item.destination_airport || item.destination,
    depart,
    ret,
    days: ret ? diffDays(depart, ret) : null,
    price: Number(item.price),
    currency,
    airline: item.airline || '',
    stops: item.transfers ?? null,
    returnStops: item.return_transfers ?? null,
    durationOut: item.duration_to ?? null,
    durationBack: item.duration_back ?? null,
    link: item.link ? `https://www.aviasales.com${item.link}` : null,
    ...extra,
  };
}

/** Ida e volta: consulta por mês e filtra pela duração desejada. */
export async function searchRoundTrips(cfg, token) {
  const currency = cfg.currency.toLowerCase();
  const { departFrom, departTo, minDays, maxDays } = cfg.window;
  const depMonths = monthsBetween(departFrom, departTo);
  const retMonths = monthsBetween(addDays(departFrom, minDays), addDays(departTo, maxDays));
  const results = [];

  for (const origin of cfg.origins) {
    for (const dest of cfg.destinations) {
      for (const dm of depMonths) {
        for (const rm of retMonths) {
          if (rm < dm) continue;
          try {
            const data = await call({
              origin, destination: dest.code, departure_at: dm, return_at: rm,
              one_way: false, direct: false, unique: false, sorting: 'price',
              currency, limit: 1000, page: 1,
            }, token);
            for (const it of data) {
              const n = normalize(it, cfg.currency, { destName: dest.name });
              if (n.depart < departFrom || n.depart > departTo) continue;
              if (n.days == null || n.days < minDays || n.days > maxDays) continue;
              results.push(n);
            }
          } catch (e) {
            console.warn(`[travelpayouts] ${origin}->${dest.code} ${dm}/${rm}: ${e.message}`);
          }
        }
      }
    }
  }
  return results;
}

/** Trechos só de ida (usados para montar "open-jaw": chega numa cidade, volta de outra). */
export async function searchOneWay(origin, destination, month, cfg, token) {
  const data = await call({
    origin, destination, departure_at: month, one_way: true, direct: false,
    unique: false, sorting: 'price', currency: cfg.currency.toLowerCase(), limit: 1000, page: 1,
  }, token);
  return data.map((it) => ({
    date: datePart(it.departure_at),
    price: Number(it.price),
    airline: it.airline || '',
    stops: it.transfers ?? null,
    duration: it.duration_to ?? it.duration ?? null,
    link: it.link ? `https://www.aviasales.com${it.link}` : null,
  }));
}

/** Combina ida X + volta Y (bilhetes separados) para os pares open-jaw configurados. */
export async function searchOpenJaw(cfg, token) {
  const { departFrom, departTo, minDays, maxDays } = cfg.window;
  const depMonths = monthsBetween(departFrom, departTo);
  const retMonths = monthsBetween(addDays(departFrom, minDays), addDays(departTo, maxDays));
  const results = [];

  for (const origin of cfg.origins) {
    for (const oj of cfg.openJaw || []) {
      try {
        const outs = (await Promise.all(depMonths.map((m) => searchOneWay(origin, oj.out, m, cfg, token)))).flat()
          .filter((o) => o.date >= departFrom && o.date <= departTo);
        const backs = (await Promise.all(retMonths.map((m) => searchOneWay(oj.back, origin, m, cfg, token)))).flat();
        for (const o of outs) {
          for (const b of backs) {
            const days = diffDays(o.date, b.date);
            if (days < minDays || days > maxDays) continue;
            results.push({
              source: 'Aviasales (2 bilhetes)', origin, destination: oj.out, returnFrom: oj.back,
              destName: oj.label, depart: o.date, ret: b.date, days,
              price: o.price + b.price, currency: cfg.currency,
              airline: [o.airline, b.airline].filter(Boolean).join(' / '),
              stops: o.stops, returnStops: b.stops, durationOut: o.duration, durationBack: b.duration, link: o.link, link2: b.link, openJaw: true,
            });
          }
        }
      } catch (e) {
        console.warn(`[travelpayouts] open-jaw ${oj.out}/${oj.back}: ${e.message}`);
      }
    }
  }
  return results;
}
