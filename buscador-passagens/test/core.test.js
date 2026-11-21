import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidatePairs, monthsBetween, weekday, diffDays, spreadPick } from '../src/dates.js';
import { classify, dedupe, byWeekday, newOrCheaper, markSent, onePerRoute } from '../src/analyze.js';
import { buildPlan, estimateCosts, dailySchedule } from '../src/planner.js';
import { planPdf } from '../src/pdf.js';

const cfg = {
  window: { departFrom: '2027-04-01', departTo: '2027-05-10', minDays: 11, maxDays: 19 },
  preferredDepartWeekdays: [2, 3], preferredReturnWeekdays: [2, 3, 4],
  blackouts: [{ from: '2027-04-16', to: '2027-04-21' }],
};
const rules = { maxPrice: 4500, maxHours: 16, special: { maxPrice: 3000, maxHours: 20 } };

test('datas candidatas respeitam dias da semana, duração e feriados', () => {
  const pairs = candidatePairs(cfg);
  assert.ok(pairs.length > 0);
  for (const p of pairs) {
    assert.ok([2, 3].includes(weekday(p.depart)));
    assert.ok([2, 3, 4].includes(weekday(p.ret)));
    assert.equal(diffDays(p.depart, p.ret), p.days);
    assert.ok(!(p.ret >= '2027-04-16' && p.ret <= '2027-04-21'));
  }
  assert.equal(weekday('2027-04-06'), 2); // 06/04/2027 é terça
  assert.deepEqual(monthsBetween('2026-12-10', '2027-01-02'), ['2026-12', '2027-01']);
  assert.equal(spreadPick([1, 2, 3, 4, 5, 6, 7, 8, 9], 3).length, 3);
});

test('regras de preço e duração (inclui o caso especial de 20h por até R$ 3.000)', () => {
  const f = (price, out, back) => ({ price, durationOut: out, durationBack: back });
  assert.equal(classify(f(4400, 8 * 60, 9 * 60), rules), 'main');
  assert.equal(classify(f(4600, 8 * 60, 9 * 60), rules), null); // acima de 4.500
  assert.equal(classify(f(4000, 17 * 60, 9 * 60), rules), null); // 17h e não é barato o suficiente
  assert.equal(classify(f(2900, 19 * 60, 12 * 60), rules), 'special'); // 19h por 2.900
  assert.equal(classify(f(2900, 21 * 60, 12 * 60), rules), null); // passou de 20h
  assert.equal(classify(f(4000, null, null), rules), 'main'); // duração desconhecida
});

test('dedupe, um por rota, dia mais barato e controle de reenvio', () => {
  const r = (price, d, entry = 'LIS', exit = 'ROM') => ({ entry, exit, depart: d, back: '2027-04-20', price });
  const all = dedupe([r(5000, '2027-04-06'), r(4500, '2027-04-06'), r(3900, '2027-04-07'), r(4100, '2027-04-07', 'PAR', 'PAR')]);
  assert.equal(all.length, 3);
  assert.equal(all[0].price, 3900);
  assert.equal(onePerRoute(all, 5).length, 2);
  assert.equal(byWeekday(all)[0].day, 'quarta');
  const h = markSent({}, [all[0]]);
  assert.equal(newOrCheaper([all[0]], h).length, 0);
  assert.equal(newOrCheaper([{ ...all[0], price: 3700 }], h).length, 1);
});

test('roteiro sempre tem Alemanha e Itália; Portugal só se entrar ou sair por lá', () => {
  const viaParis = buildPlan({ entry: 'PAR', ret: 'ROM', depart: '2027-04-06', retDate: '2027-04-22' });
  assert.ok(viaParis.countries.includes('DE') && viaParis.countries.includes('IT'));
  assert.ok(!viaParis.countries.includes('PT'));
  assert.equal(viaParis.stops[0].city, 'PAR');
  assert.equal(viaParis.stops.at(-1).city, 'ROM');
  assert.equal(viaParis.stops.reduce((s, x) => s + x.nights, 0), viaParis.nights);
  assert.equal(viaParis.stops.at(-1).checkOut, '2027-04-22');

  const voltaLisboa = buildPlan({ entry: 'FRA', ret: 'LIS', depart: '2027-04-06', retDate: '2027-04-24' });
  assert.ok(voltaLisboa.countries.includes('PT'));
  assert.equal(voltaLisboa.stops.at(-1).city, 'LIS');

  for (const [e, r] of [['LIS', 'LIS'], ['ROM', 'ROM'], ['PAR', 'PAR'], ['MIL', 'FRA'], ['OPO', 'LON']]) {
    for (const back of ['2027-04-13', '2027-04-18', '2027-04-25']) {
      const pl = buildPlan({ entry: e, ret: r, depart: '2027-04-02', retDate: back });
      assert.equal(pl.stops.reduce((s, x) => s + x.nights, 0), pl.nights, `${e}-${r}-${back}`);
      assert.equal(pl.stops.at(-1).checkOut, back);
      assert.ok(pl.stops.every((x) => x.nights >= 1));
    }
  }

  const days = dailySchedule(viaParis);
  assert.equal(days.length, diffDays('2027-04-06', '2027-04-22') + 1);
});

test('custos: grupo e sozinha, e PDF gerado', async () => {
  const plan = buildPlan({ entry: 'LIS', ret: 'ROM', depart: '2027-04-06', retDate: '2027-04-24' });
  const solo = estimateCosts(plan, { profile: 'solo', flightBRL: 4200, eurBrl: 6.3 });
  const group = estimateCosts(plan, { profile: 'group', flightBRL: 4200, eurBrl: 6.3, groupSize: 4 });
  assert.ok(solo.brl.perPerson > 4200);
  assert.ok(Math.abs(group.brl.group - group.brl.perPerson * 4) <= 4);
  const fare = { price: 4200, kind: 'ida e volta', source: 'teste', depart: plan.depart, back: plan.retDate, stops: 0, returnStops: 1, durationOut: 500, durationBack: 800, airline: 'TP' };
  const pdf = await planPdf({ plan, costs: solo, fare, profile: 'solo', fx: 6.3 });
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
});
