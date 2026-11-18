import { readFile, writeFile } from 'node:fs/promises';
import cron from 'node-cron';
import { searchRoundTrips, searchOpenJaw } from './providers/travelpayouts.js';
import { searchLive } from './providers/serpapi.js';
import { searchMock } from './providers/mock.js';
import { dedupe, byWeekday, bestByRoute, findDeals, updateHistory } from './analyze.js';
import { buildEmail, sendEmail } from './email.js';
import { loadJSON, saveJSON } from './storage.js';

const CONFIG_PATH = process.env.CONFIG_PATH || new URL('../config.json', import.meta.url);
const DATA_DIR = process.env.DATA_DIR || new URL('../data/', import.meta.url).pathname;
const HISTORY_PATH = `${DATA_DIR}/history.json`;

export async function runOnce() {
  const cfg = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  const { TRAVELPAYOUTS_TOKEN, SERPAPI_KEY, MOCK } = process.env;
  const started = Date.now();
  let raw = [];

  if (MOCK === '1') {
    raw = searchMock(cfg);
  } else {
    if (!TRAVELPAYOUTS_TOKEN && !SERPAPI_KEY) {
      throw new Error('Configure TRAVELPAYOUTS_TOKEN e/ou SERPAPI_KEY no .env (ou use MOCK=1 para testar).');
    }
    const jobs = [];
    if (TRAVELPAYOUTS_TOKEN) {
      jobs.push(searchRoundTrips(cfg, TRAVELPAYOUTS_TOKEN), searchOpenJaw(cfg, TRAVELPAYOUTS_TOKEN));
    }
    if (SERPAPI_KEY) jobs.push(searchLive(cfg, SERPAPI_KEY));
    raw = (await Promise.all(jobs)).flat();
  }

  const all = dedupe(raw);
  const routes = bestByRoute(all);
  const history = await loadJSON(HISTORY_PATH, {});
  const deals = findDeals(routes, history, cfg.alerts);
  const weekdays = byWeekday(all);
  const top = all.slice(0, cfg.alerts.topN ?? 15);

  console.log(`[run] ${all.length} tarifas, ${deals.length} ofertas, ${((Date.now() - started) / 1000).toFixed(1)}s`);
  for (const r of top.slice(0, 5)) console.log(`  ${r.price} ${r.currency} ${r.destination}/${r.returnFrom} ${r.depart}→${r.ret} ${r.airline}`);

  if (all.length && (deals.length || cfg.alerts.sendDigestAlways)) {
    const mail = buildEmail({ deals, top, weekdays, cfg, stats: { total: all.length } });
    await writeFile(`${DATA_DIR}/ultimo-email.html`, mail.html).catch(() => {});
    await sendEmail(mail);
  }

  await saveJSON(HISTORY_PATH, updateHistory(history, routes));
  await saveJSON(`${DATA_DIR}/ultimos-resultados.json`, top);
  return { all, deals, weekdays };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  await saveJSON(`${DATA_DIR}/.keep`, {});
  const safeRun = () => runOnce().catch((e) => console.error('[erro]', e.message));
  if (process.argv.includes('--once')) {
    await runOnce();
  } else {
    const cfg = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
    const tz = process.env.TZ || 'America/Sao_Paulo';
    console.log(`[cron] agendado "${cfg.schedule}" (${tz}). Rodando uma vez agora...`);
    await safeRun();
    cron.schedule(cfg.schedule, safeRun, { timezone: tz });
  }
}
