import { readFile, writeFile } from 'node:fs/promises';
import cron from 'node-cron';
import { searchAll } from './providers/travelpayouts.js';
import { verifyLive } from './providers/serpapi.js';
import { searchMock } from './providers/mock.js';
import { classify, dedupe, onePerRoute, byWeekday, newOrCheaper, markSent, recordRun } from './analyze.js';
import { buildPlan, estimateCosts } from './planner.js';
import { planPdf } from './pdf.js';
import { eurToBrl } from './fx.js';
import { buildEmail, sendEmail } from './email.js';
import { loadJSON, saveJSON } from './storage.js';

const CONFIG_PATH = process.env.CONFIG_PATH || new URL('../config.json', import.meta.url);
const DATA_DIR = process.env.DATA_DIR || new URL('../data', import.meta.url).pathname;
const HISTORY_PATH = `${DATA_DIR}/history.json`;

const today = () => new Date().toISOString().slice(0, 10);
export const activeBoost = (cfg, day = today()) => (cfg.boost?.periods || []).find((p) => day >= p.from && day <= p.to) || null;

/** Monta roteiro e custos (sozinha e grupo) para uma tarifa. */
function enrich(fare, cfg, fx) {
  const plan = buildPlan({ entry: fare.entry, ret: fare.exit, depart: fare.depart, retDate: fare.back, opts: cfg.planner });
  if (!plan) return null;
  const base = { flightBRL: fare.price, eurBrl: fx.rate, insuranceBrlPerDay: cfg.planner.insuranceBrlPerDay, groupSize: cfg.planner.groupSize };
  return { fare, plan, solo: estimateCosts(plan, { ...base, profile: 'solo' }), group: estimateCosts(plan, { ...base, profile: 'group' }) };
}

export async function runOnce({ useSerpApi = true, boost = null } = {}) {
  const cfg = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  const { TRAVELPAYOUTS_TOKEN, SERPAPI_KEY, MOCK } = process.env;
  const started = Date.now();
  let raw = [];

  if (MOCK === '1') {
    raw = searchMock(cfg);
  } else {
    if (!TRAVELPAYOUTS_TOKEN && !SERPAPI_KEY) throw new Error('Configure TRAVELPAYOUTS_TOKEN e/ou SERPAPI_KEY no .env (ou MOCK=1 para testar).');
    if (TRAVELPAYOUTS_TOKEN) raw = await searchAll(cfg, TRAVELPAYOUTS_TOKEN);
    if (SERPAPI_KEY && useSerpApi) {
      const cands = dedupe(raw).filter((f) => classify(f, cfg.rules));
      raw.push(...(await verifyLive(cfg, SERPAPI_KEY, cands)));
    }
  }

  const all = dedupe(raw);
  const fx = await eurToBrl(cfg.planner.eurBrlFallback);
  const n = cfg.alerts.topN ?? 8;
  const mainFares = onePerRoute(all.filter((f) => classify(f, cfg.rules) === 'main'), n);
  const specialFares = onePerRoute(all.filter((f) => classify(f, cfg.rules) === 'special'), Math.ceil(n / 2));
  const history = await loadJSON(HISTORY_PATH, {});
  const fresh = new Set(newOrCheaper([...mainFares, ...specialFares], history, cfg.alerts.renotifyDropPercent));
  const mk = (f) => { const e = enrich(f, cfg, fx); return e && { ...e, isNew: fresh.has(f) }; };
  const main = mainFares.map(mk).filter(Boolean);
  const special = specialFares.map(mk).filter(Boolean);

  console.log(`[run] ${all.length} tarifas · ${main.length} dentro do limite · ${special.length} caso especial · ${fresh.size} novas · ${((Date.now() - started) / 1000).toFixed(1)}s`);
  for (const o of [...main, ...special].slice(0, 5)) console.log(`  R$${o.fare.price} ${o.fare.entry}/${o.fare.exit} ${o.fare.depart}→${o.fare.back} ${o.fare.airline}`);

  // Envia quando há algo novo/mais barato; sem nada, manda um status a cada heartbeatDays.
  const daysSinceEmail = history.lastEmail ? (Date.now() - Date.parse(history.lastEmail)) / 86_400_000 : Infinity;
  const hasNews = fresh.size > 0;
  const statusOnly = !main.length && !special.length && daysSinceEmail >= (cfg.alerts.heartbeatDays ?? 7);
  if (hasNews || statusOnly || process.env.FORCE_EMAIL === '1') {
    const best = all[0] ? enrich(all[0], cfg, fx) : null;
    const rec = main[0] || special[0] || best;
    const mail = buildEmail({ main, special, best, cfg, fx, stats: { total: all.length }, weekdays: byWeekday(all), boost: boost?.label, statusOnly: !main.length && !special.length });
    const attachments = [];
    if (rec) {
      const tag = `${rec.fare.entry}-${rec.fare.exit}-${rec.fare.depart}`;
      attachments.push(
        { filename: `roteiro-sozinha-${tag}.pdf`, content: await planPdf({ plan: rec.plan, costs: rec.solo, fare: rec.fare, profile: 'solo', fx: fx.rate }) },
        { filename: `roteiro-grupo-${cfg.planner.groupSize}-${tag}.pdf`, content: await planPdf({ plan: rec.plan, costs: rec.group, fare: rec.fare, profile: 'group', groupSize: cfg.planner.groupSize, fx: fx.rate }) },
      );
    }
    await writeFile(`${DATA_DIR}/ultimo-email.html`, mail.html).catch(() => {});
    for (const a of attachments) await writeFile(`${DATA_DIR}/${a.filename}`, a.content).catch(() => {});
    if (await sendEmail({ ...mail, attachments })) markSent(history, [...mainFares, ...specialFares]);
  } else {
    console.log('[run] nada novo para enviar');
  }

  await saveJSON(HISTORY_PATH, recordRun(history, all));
  return { all, main, special };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  try {
    await saveJSON(`${DATA_DIR}/.keep`, {});
  } catch (e) {
    console.error(`[erro] sem permissão para gravar em ${DATA_DIR} (${e.code}). No servidor rode: chown -R 1000:1000 data && docker compose restart`);
    process.exit(1);
  }
  const cfg = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  const tz = process.env.TZ || 'America/Sao_Paulo';
  const safe = (opts) => runOnce(opts).catch((e) => console.error('[erro]', e.message));

  if (process.argv.includes('--once')) {
    await runOnce({ boost: activeBoost(cfg) });
  } else {
    console.log(`[cron] busca normal "${cfg.schedule}" (${tz})`);
    await safe({ boost: activeBoost(cfg) });
    cron.schedule(cfg.schedule, () => safe({ boost: activeBoost(cfg) }), { timezone: tz });
    if (cfg.boost?.schedule) {
      console.log(`[cron] busca extra em promoções "${cfg.boost.schedule}": ${cfg.boost.periods.map((p) => `${p.label} (${p.from}..${p.to})`).join('; ')}`);
      cron.schedule(cfg.boost.schedule, () => {
        const b = activeBoost(cfg);
        if (b) safe({ useSerpApi: cfg.boost.useSerpApi ?? false, boost: b });
      }, { timezone: tz });
    }
  }
}
