// Dados falsos para testar o fluxo (e o e-mail) sem chave de API. Ative com MOCK=1.
import { candidatePairs } from '../dates.js';

export function searchMock(cfg) {
  const base = { LIS: 3900, OPO: 4100, MAD: 4000, BCN: 4500, PAR: 4700, ROM: 4900, MIL: 4600, AMS: 4800, FRA: 4750 };
  const out = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const p of candidatePairs(cfg)) {
    for (const d of cfg.destinations) {
      out.push({
        source: 'MOCK', origin: cfg.origins[0], destination: d.code, returnFrom: d.code, destName: d.name,
        depart: p.depart, ret: p.ret, days: p.days,
        price: Math.round((base[d.code] || 5000) * (0.8 + rnd() * 0.5)),
        currency: cfg.currency, airline: 'TP', stops: d.code === 'LIS' ? 0 : 1, link: 'https://example.com',
        durationOut: d.code === 'LIS' ? 500 : Math.round(600 + rnd() * 900), durationBack: d.code === 'LIS' ? 540 : Math.round(600 + rnd() * 900),
      });
    }
  }
  return out;
}
