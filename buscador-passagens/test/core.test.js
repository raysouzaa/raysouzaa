import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidatePairs, monthsBetween, weekday, diffDays, spreadPick } from '../src/dates.js';
import { dedupe, byWeekday, findDeals, bestByRoute, updateHistory } from '../src/analyze.js';

const cfg = {
  window: { departFrom: '2027-04-01', departTo: '2027-05-10', minDays: 12, maxDays: 15 },
  preferredDepartWeekdays: [2, 3], preferredReturnWeekdays: [2, 3, 4],
  blackouts: [{ from: '2027-04-16', to: '2027-04-21' }],
};

test('datas candidatas respeitam dias da semana, duração e feriados', () => {
  const pairs = candidatePairs(cfg);
  assert.ok(pairs.length > 0);
  for (const p of pairs) {
    assert.ok([2, 3].includes(weekday(p.depart)));
    assert.ok([2, 3, 4].includes(weekday(p.ret)));
    assert.equal(diffDays(p.depart, p.ret), p.days);
    assert.ok(p.days >= 12 && p.days <= 15);
    assert.ok(!(p.ret >= '2027-04-16' && p.ret <= '2027-04-21'));
  }
  assert.equal(weekday('2027-04-06'), 2); // 06/04/2027 é terça
});

test('meses e amostragem', () => {
  assert.deepEqual(monthsBetween('2027-04-01', '2027-05-25'), ['2027-04', '2027-05']);
  assert.deepEqual(monthsBetween('2026-12-10', '2027-01-02'), ['2026-12', '2027-01']);
  assert.equal(spreadPick([1, 2, 3, 4, 5, 6, 7, 8, 9], 3).length, 3);
});

test('análise: dedupe, dia mais barato, alertas e histórico', () => {
  const r = (p, d, dest = 'LIS') => ({ origin: 'GRU', destination: dest, returnFrom: dest, depart: d, ret: '2027-04-20', price: p, currency: 'BRL' });
  const all = dedupe([r(5000, '2027-04-06'), r(4500, '2027-04-06'), r(3900, '2027-04-07'), r(6000, '2027-04-09', 'MAD')]);
  assert.equal(all.length, 3);
  assert.equal(all[0].price, 3900);
  assert.equal(byWeekday(all)[0].day, 'quarta');
  const routes = bestByRoute(all);
  const hist = updateHistory({}, [{ ...routes[0], price: 4500 }, { ...routes[1], price: 7000 }]);
  const deals = findDeals(routes, hist, { priceThreshold: 4000, dropPercent: 8 });
  assert.equal(deals.length, 2); // LIS abaixo do limite e caiu; MAD caiu 14%
});
