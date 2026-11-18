import nodemailer from 'nodemailer';
import { fmtBR, weekday, WEEKDAYS_PT } from './dates.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (v, cur) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(v);
const stops = (n) => (n == null ? '?' : n === 0 ? 'direto' : `${n} escala${n > 1 ? 's' : ''}`);

function row(r) {
  const links = [r.link && `<a href="${esc(r.link)}">ver</a>`, r.link2 && `<a href="${esc(r.link2)}">volta</a>`]
    .filter(Boolean).join(' · ');
  const route = r.openJaw || r.destination !== r.returnFrom
    ? `${esc(r.origin)} → ${esc(r.destination)} … ${esc(r.returnFrom)} → ${esc(r.origin)}`
    : `${esc(r.origin)} ⇄ ${esc(r.destination)}`;
  return `<tr>
    <td style="padding:6px 8px"><b>${esc(r.destName || r.destination)}</b><br><small>${route}</small></td>
    <td style="padding:6px 8px">${fmtBR(r.depart)} (${WEEKDAYS_PT[weekday(r.depart)].slice(0, 3)})<br>${fmtBR(r.ret)} (${WEEKDAYS_PT[weekday(r.ret)].slice(0, 3)})</td>
    <td style="padding:6px 8px">${r.days} dias</td>
    <td style="padding:6px 8px">${esc(r.airline)}<br><small>${stops(r.stops)} / ${stops(r.returnStops)}</small></td>
    <td style="padding:6px 8px;white-space:nowrap"><b>${money(r.price, r.currency)}</b>${r.reasons ? `<br><small style="color:#0a7">${esc(r.reasons.join('; '))}</small>` : ''}</td>
    <td style="padding:6px 8px"><small>${esc(r.source)}</small><br>${links}</td>
  </tr>`;
}

const table = (rows) => `<table style="border-collapse:collapse;font-size:14px" border="1" cellspacing="0">
  <tr style="background:#f0f0f0"><th>Destino</th><th>Ida / Volta</th><th>Duração</th><th>Cia</th><th>Preço</th><th>Fonte</th></tr>
  ${rows.map(row).join('')}</table>`;

export function buildEmail({ deals, top, weekdays, cfg, stats }) {
  const cur = cfg.currency;
  const subject = deals.length
    ? `✈️ ${deals.length} oferta(s) Europa a partir de ${money(Math.min(...deals.map((d) => d.price)), cur)}`
    : `Resumo passagens Europa: melhor ${top[0] ? money(top[0].price, cur) : 'sem resultados'}`;

  const wk = weekdays.map((w) => `<li>${w.day}: média ${money(w.avg, cur)} · mínimo ${money(w.min, cur)} (${w.n} tarifas)</li>`).join('');

  const html = `<div style="font-family:Arial,sans-serif;color:#222">
    <h2>Buscador de passagens — Brasil → Europa</h2>
    <p>Janela: ida de ${fmtBR(cfg.window.departFrom)} a ${fmtBR(cfg.window.departTo)}, ${cfg.window.minDays}–${cfg.window.maxDays} dias.
       ${stats.total} tarifas analisadas.</p>
    ${deals.length ? `<h3>🔥 Ofertas que bateram o alerta</h3>${table(deals)}` : '<p>Nenhuma tarifa bateu o alerta nesta rodada.</p>'}
    <h3>Top ${top.length} mais baratas</h3>${table(top)}
    <h3>Dia da semana de embarque mais barato (dados desta rodada)</h3><ol>${wk}</ol>
    <p style="font-size:12px;color:#777">Preços do Aviasales vêm de cache (buscas recentes de outros usuários) e podem mudar;
    confirme no site da companhia antes de comprar. Ida+volta de cidades diferentes ("2 bilhetes") são compras separadas.</p>
  </div>`;
  return { subject, html };
}

export async function sendEmail({ subject, html }) {
  const { SMTP_HOST, SMTP_PORT = '465', SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_TO } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !MAIL_TO) {
    console.warn('[email] SMTP não configurado — e-mail não enviado. Assunto:', subject);
    return false;
  }
  const transport = nodemailer.createTransport({
    host: SMTP_HOST, port: +SMTP_PORT, secure: +SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  await transport.sendMail({ from: MAIL_FROM || SMTP_USER, to: MAIL_TO, subject, html });
  console.log(`[email] enviado para ${MAIL_TO}: ${subject}`);
  return true;
}
