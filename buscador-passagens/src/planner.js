// Planejador de roteiro: dado onde a passagem chega e de onde volta, monta a rota pelos países,
// divide as noites, sugere o que ver por dia e estima os custos (sozinha ou grupo de 4).
import { CITIES, COUNTRIES, COUNTRY_CITIES, TRANSIT_CITIES, legInfo, cityOf } from './cities.js';
import { addDays, diffDays } from './dates.js';

const WEIGHTS = { IT: 1.6, DE: 1.1, FR: 1.0, ES: 1.0, UK: 0.8, PT: 0.8 };

function geoDist(a, b) {
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2
    + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
const pt = (c) => CITIES[c];
const centroid = (cities) => ({
  lat: cities.reduce((s, c) => s + pt(c).lat, 0) / cities.length,
  lon: cities.reduce((s, c) => s + pt(c).lon, 0) / cities.length,
});

function permutations(arr) {
  if (arr.length <= 1) return [arr.slice()];
  return arr.flatMap((x, i) => permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map((p) => [x, ...p]));
}

/** Divide `total` em partes proporcionais aos pesos, com mínimo por parte. */
function split(total, weights, min = 1) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map((x) => Math.max(min, Math.floor(x)));
  let diff = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
  for (let k = 0; diff > 0; k++, diff--) out[order[k % out.length]]++;
  for (let k = 0; diff < 0 && k < 1000; k++) {
    const i = out.indexOf(Math.max(...out));
    if (out[i] > min) { out[i]--; diff++; } else break;
  }
  return out;
}

/** Escolhe quais países entram no roteiro. */
export function chooseCountries(entryCountry, returnCountry, nights, opts = {}) {
  const mandatory = opts.mandatoryCountries ?? ['DE', 'IT'];
  const optional = opts.optionalCountries ?? ['FR', 'ES', 'UK'];
  const target = nights <= 12 ? 3 : nights <= 17 ? 4 : 5;
  const set = [];
  for (const c of [entryCountry, ...mandatory, returnCountry]) if (!set.includes(c)) set.push(c);
  // Portugal só entra se for a porta de entrada ou de saída (regra pedida).
  for (const c of optional) {
    if (set.length >= target) break;
    if (c !== 'PT' && !set.includes(c)) set.push(c);
  }
  return set;
}

function pickCities(country, nights, required) {
  const onlyTransit = required.length > 0 && required.every((c) => TRANSIT_CITIES.has(c));
  const base = nights <= 4 ? 1 : Math.ceil(nights / 3);
  // Se a cidade obrigatória é só de passagem (Frankfurt/Milão), acrescenta uma cidade turística do país.
  const k = Math.min(COUNTRY_CITIES[country].length, Math.max(required.length + (onlyTransit && nights >= 3 ? 1 : 0), base));
  const list = [...required];
  for (const c of COUNTRY_CITIES[country]) {
    if (list.length >= k) break;
    if (!list.includes(c) && !TRANSIT_CITIES.has(c)) list.push(c);
  }
  return list;
}

/** Ordena as cidades de um bloco respeitando quem deve vir primeiro/último e minimizando deslocamento. */
function orientBlock(cities, { first, last, prev, next }) {
  let best = null;
  for (const p of permutations(cities)) {
    if (first && p[0] !== first) continue;
    if (last && p[p.length - 1] !== last) continue;
    let d = 0;
    if (prev) d += geoDist(prev, pt(p[0]));
    for (let i = 1; i < p.length; i++) d += geoDist(pt(p[i - 1]), pt(p[i]));
    if (next) d += geoDist(pt(p[p.length - 1]), next);
    if (!best || d < best.d) best = { p, d };
  }
  return best ? best.p : cities;
}

/**
 * Monta o roteiro.
 * @param entry  código da cidade onde o voo chega (ex.: LIS, PAR, ROM)
 * @param ret    código da cidade de onde o voo volta
 * @param depart data de saída de Belém (YYYY-MM-DD) — chega na Europa no dia seguinte
 * @param retDate data do voo de volta
 */
export function buildPlan({ entry, ret, depart, retDate, opts = {} }) {
  entry = cityOf(entry); ret = cityOf(ret);
  if (!CITIES[entry] || !CITIES[ret]) return null;
  const arrival = addDays(depart, 1);
  const nights = diffDays(arrival, retDate);
  if (nights < 5) return null;

  const Ce = CITIES[entry].country;
  const Cr = CITIES[ret].country;
  const countries = chooseCountries(Ce, Cr, nights, opts);
  const cNights = split(nights, countries.map((c) => WEIGHTS[c] ?? 1), 2);

  // Blocos: cada país vira um bloco de cidades. Se entra e sai pelo mesmo país, ele vira 2 blocos (início e fim).
  const blocks = countries.map((c, i) => {
    const required = [];
    if (c === Ce) required.push(entry);
    if (c === Cr && !required.includes(ret)) required.push(ret);
    return { country: c, nights: cNights[i], cities: pickCities(c, cNights[i], required) };
  });

  let firstBlock; let lastBlock;
  if (Ce === Cr) {
    const b = blocks.find((x) => x.country === Ce);
    blocks.splice(blocks.indexOf(b), 1);
    const rest = b.cities.filter((c) => c !== entry);
    if (!rest.length) rest.push(ret);
    if (!rest.includes(ret)) rest.push(ret);
    const restCities = rest.filter((c) => c !== entry || entry === ret);
    const restN = Math.max(1, Math.min(restCities.length * 2, b.nights - 1));
    firstBlock = { country: Ce, cities: [entry], nights: b.nights - restN };
    lastBlock = { country: Ce, cities: restCities, nights: restN };
  } else {
    firstBlock = blocks.find((x) => x.country === Ce);
    lastBlock = blocks.find((x) => x.country === Cr);
    blocks.splice(blocks.indexOf(firstBlock), 1);
    blocks.splice(blocks.indexOf(lastBlock), 1);
  }

  // Ordem dos países do meio: a que percorre menos distância.
  let bestOrder = blocks;
  let bestD = Infinity;
  for (const p of permutations(blocks)) {
    const seq = [firstBlock, ...p, lastBlock].map((b) => centroid(b.cities));
    let d = 0;
    for (let i = 1; i < seq.length; i++) d += geoDist(seq[i - 1], seq[i]);
    if (d < bestD) { bestD = d; bestOrder = p; }
  }
  const ordered = [firstBlock, ...bestOrder, lastBlock];

  // Orienta as cidades de cada bloco e divide as noites do país entre elas.
  const stops = [];
  ordered.forEach((b, i) => {
    const prevCity = stops.length ? pt(stops[stops.length - 1].city) : null;
    const next = ordered[i + 1] ? centroid(ordered[i + 1].cities) : null;
    const cities = orientBlock(b.cities, {
      first: i === 0 ? entry : null,
      last: i === ordered.length - 1 ? ret : null,
      prev: prevCity, next,
    });
    const w = cities.map((c) => (TRANSIT_CITIES.has(c) ? 0.5 : 1));
    const ns = split(b.nights, w, 1);
    cities.forEach((c, j) => stops.push({ city: c, nights: ns[j] }));
  });

  // Junta cidades repetidas em sequência e calcula datas/deslocamentos.
  const merged = [];
  for (const s of stops) {
    const last = merged[merged.length - 1];
    if (last && last.city === s.city) last.nights += s.nights; else merged.push({ ...s });
  }
  let d = arrival;
  merged.forEach((s, i) => {
    s.name = CITIES[s.city].name;
    s.country = CITIES[s.city].country;
    s.checkIn = d;
    s.checkOut = addDays(d, s.nights);
    s.leg = i === 0 ? null : legInfo(merged[i - 1].city, s.city);
    d = s.checkOut;
  });

  return {
    entry, ret, depart, arrival, retDate, nights,
    countries: [...new Set(merged.map((s) => s.country))],
    stops: merged,
  };
}

/** Programação dia a dia (texto curto por dia). */
export function dailySchedule(plan) {
  const days = [];
  let n = 1;
  days.push({ n: n++, date: plan.depart, city: 'Belém', text: `Voo noturno de Belém para ${CITIES[plan.entry].name}.` });
  for (const s of plan.stops) {
    const see = CITIES[s.city].see;
    let k = 0;
    for (let i = 0; i < s.nights; i++) {
      const date = addDays(s.checkIn, i);
      let text;
      if (i === 0 && !s.leg) {
        text = `Chegada e check-in. Fim de tarde leve: ${see[k++] || 'passeio pelo centro'}.`;
      } else if (i === 0) {
        const l = s.leg;
        text = `${l.mode} para ${s.name} (~${l.h}h, ~€${l.eur}).${l.h <= 4 ? ` À tarde: ${see[k++] || 'passeio pelo centro'}.` : ' Check-in e jantar.'}`;
      } else {
        text = see[k++] || 'Dia livre: bairros, mercados, compras ou bate-volta.';
      }
      days.push({ n: n++, date, city: s.name, text });
    }
  }
  const last = plan.stops[plan.stops.length - 1];
  days.push({ n: n++, date: plan.retDate, city: last.name, text: `Voo de volta de ${CITIES[plan.ret].name} para Belém.` });
  return days;
}

/**
 * Estima custos por pessoa.
 * profile: 'solo' (hostel feminino) ou 'group' (4 pessoas dividindo apartamento/hotel)
 */
export function estimateCosts(plan, { profile, flightBRL, eurBrl, insuranceBrlPerDay = 15, groupSize = 4 }) {
  let lodging = 0; let daily = 0; let transport = 30; // 30 = traslados de/para aeroportos
  const lines = [];
  for (const s of plan.stops) {
    const c = CITIES[s.city];
    const perNight = profile === 'group' ? c.apt4 / groupSize : c.hostel;
    const perDay = profile === 'group' ? c.daily * 0.85 : c.daily; // grupo cozinha às vezes
    const l = perNight * s.nights; const dd = perDay * s.nights; const t = s.leg?.eur ?? 0;
    lodging += l; daily += dd; transport += t;
    lines.push({ city: s.name, nights: s.nights, lodging: Math.round(l), daily: Math.round(dd), transport: t, perNight: Math.round(perNight) });
  }
  const etaEur = plan.countries.includes('UK') ? 23 : 0;
  const eurSubtotal = lodging + daily + transport + etaEur;
  const reserve = eurSubtotal * 0.1;
  const eurTotal = eurSubtotal + reserve;
  const tripDays = diffDays(plan.depart, plan.retDate) + 1;
  const insurance = insuranceBrlPerDay * tripDays;
  const groundBRL = eurTotal * eurBrl;
  const perPerson = flightBRL + groundBRL + insurance;
  return {
    profile, lines,
    eur: { lodging: Math.round(lodging), daily: Math.round(daily), transport: Math.round(transport), eta: etaEur, reserve: Math.round(reserve), total: Math.round(eurTotal) },
    brl: { flight: Math.round(flightBRL), ground: Math.round(groundBRL), insurance: Math.round(insurance), perPerson: Math.round(perPerson), group: Math.round(perPerson * (profile === 'group' ? groupSize : 1)) },
    eurBrl,
  };
}

export const routeSummary = (plan) => plan.stops.map((s) => `${s.name} (${s.nights}n)`).join(' > ');
export const countryNames = (plan) => plan.countries.map((c) => COUNTRIES[c].name).join(', ');
