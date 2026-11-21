// Dados falsos para testar o fluxo (e o e-mail/PDF) sem chave de API. Ative com MOCK=1.
import { candidatePairs } from '../dates.js';

export function searchMock(cfg) {
  const base = { LIS: 3600, OPO: 3900, PAR: 4300, ROM: 4500, MIL: 4400, FRA: 4600, MUC: 4700, BER: 4800, MAD: 4100, BCN: 4400, LON: 4900 };
  const out = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pairs = candidatePairs(cfg).filter((_, i) => i % 3 === 0);
  for (const p of pairs) {
    for (const entry of cfg.entryCities) {
      for (const exit of [entry, 'ROM', 'LIS', 'LON']) {
        if (!cfg.returnCities.includes(exit)) continue;
        const direct = entry === 'LIS';
        out.push({
          source: 'MOCK', kind: entry === exit ? 'ida e volta' : '2 bilhetes', entry, exit,
          depart: p.depart, back: p.ret, days: p.days,
          price: Math.round(((base[entry] + base[exit]) / 2) * (0.7 + rnd() * 0.5)),
          airline: 'TP', stops: direct ? 0 : 1, returnStops: exit === 'LIS' ? 0 : 1,
          durationOut: direct ? 500 : Math.round(660 + rnd() * 600),
          durationBack: exit === 'LIS' ? 540 : Math.round(660 + rnd() * 600),
          entryAirport: entry, exitAirport: exit, link: 'https://example.com',
        });
      }
    }
  }
  return out;
}
