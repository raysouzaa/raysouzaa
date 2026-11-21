// E-mail em HTML "à prova de Gmail": uma coluna (máx. 600px), tabelas e estilos inline, sem CSS externo.
import nodemailer from 'nodemailer';
import { fmtBR, weekday, WEEKDAYS_PT } from './dates.js';
import { CITIES } from './cities.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const hrs = (m) => (m == null ? 'duração n/d' : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`);
const stops = (n) => (n == null ? '' : n === 0 ? ' · direto' : ` · ${n} escala${n > 1 ? 's' : ''}`);
const dw = (iso) => `${WEEKDAYS_PT[weekday(iso)]}, ${fmtBR(iso).slice(0, 5)}`;
const city = (c) => CITIES[c]?.name || c;

const C = {
  sky: '#0284c7', skyLight: '#e0f2fe', orange: '#f97316', text: '#0f172a', muted: '#64748b',
  border: '#e2e8f0', bg: '#f1f5f9', green: '#15803d', greenBg: '#dcfce7', yellow: '#a16207', yellowBg: '#fef9c3',
};
const FONT = "font-family:Arial,Helvetica,sans-serif;";

const routeLine = (plan) => plan.stops.map((s) => esc(s.name))
  .join(` <span style="color:${C.orange};font-size:10px">&#9679;</span> `);

function badge(kind, rules) {
  return kind === 'main'
    ? `<span style="display:inline-block;padding:4px 10px;border-radius:12px;background:${C.greenBg};color:${C.green};font-size:12px;font-weight:bold">Dentro do limite (até ${brl(rules.maxPrice)})</span>`
    : `<span style="display:inline-block;padding:4px 10px;border-radius:12px;background:${C.yellowBg};color:${C.yellow};font-size:12px;font-weight:bold">Caso especial: até ${rules.special.maxHours}h por até ${brl(rules.special.maxPrice)}</span>`;
}

function costBox(title, subtitle, main, extra) {
  return `<td width="50%" valign="top" style="padding:4px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.skyLight};border-radius:8px">
      <tr><td style="${FONT}padding:10px 12px">
        <div style="font-size:13px;font-weight:bold;color:${C.sky}">${title}</div>
        <div style="font-size:11px;color:${C.muted};margin-bottom:6px">${subtitle}</div>
        <div style="font-size:18px;font-weight:bold;color:${C.text}">${main}</div>
        <div style="font-size:11px;color:${C.muted}">${extra}</div>
      </td></tr>
    </table></td>`;
}

function button(href, label) {
  if (!href) return '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px"><tr>
    <td style="background:${C.orange};border-radius:6px">
      <a href="${esc(href)}" style="${FONT}display:inline-block;padding:10px 18px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none">${label}</a>
    </td></tr></table>`;
}

function card(o, kind, rules, groupSize) {
  const f = o.fare;
  const flightLine = (label, iso, dur, st, from, to) => `<tr>
    <td style="${FONT}padding:3px 0;font-size:13px;color:${C.muted};width:48px" valign="top">${label}</td>
    <td style="${FONT}padding:3px 0;font-size:13px;color:${C.text}"><b>${esc(from)} → ${esc(to)}</b><br>
      <span style="color:${C.muted}">${dw(iso)} · ${hrs(dur)}${stops(st)}</span></td></tr>`;
  return `<tr><td style="padding:0 16px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${C.border};border-radius:10px">
    <tr><td style="${FONT}padding:16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="${FONT}font-size:28px;font-weight:bold;color:${C.text}">${brl(f.price)}${o.isNew ? ` <span style="font-size:11px;color:${C.orange};vertical-align:middle">NOVO</span>` : ''}</td>
      </tr><tr><td style="${FONT}font-size:12px;color:${C.muted};padding-bottom:8px">por pessoa, ida e volta${f.kind !== 'ida e volta' ? ` · ${esc(f.kind)}` : ''} · ${esc(f.airline || f.source)} · ${f.days + 1} dias</td></tr>
      <tr><td style="padding-bottom:10px">${badge(kind, rules)}</td></tr></table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${flightLine('Ida', f.depart, f.durationOut, f.stops, 'Belém', city(f.entry))}
        ${flightLine('Volta', f.back, f.durationBack, f.returnStops, city(f.exit), 'Belém')}
      </table>

      <div style="${FONT}font-size:12px;color:${C.muted};margin:12px 0 4px">ROTEIRO PROVÁVEL · ${o.plan.nights} noites</div>
      <div style="${FONT}font-size:14px;color:${C.text};line-height:1.6">${routeLine(o.plan)}</div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px"><tr>
        ${costBox('Sozinha', 'hostel feminino', brl(o.solo.brl.perPerson), 'total por pessoa')}
        ${costBox(`Grupo de ${groupSize}`, 'apartamento/hotel', `${brl(o.group.brl.perPerson)}<span style="font-size:11px;font-weight:normal"> /pessoa</span>`, `total do grupo: ${brl(o.group.brl.group)}`)}
      </tr></table>

      ${button(f.link, 'Ver passagem')}
      ${f.link2 ? `<div style="${FONT}font-size:12px;margin-top:6px"><a href="${esc(f.link2)}" style="color:${C.sky}">ver bilhete da volta</a></div>` : ''}
    </td></tr>
  </table></td></tr>`;
}

const sectionTitle = (t) => `<tr><td style="${FONT}padding:8px 16px 10px;font-size:15px;font-weight:bold;color:${C.text}">${t}</td></tr>`;

export function buildEmail({ main, special, best, cfg, fx, stats, boost, statusOnly }) {
  const r = cfg.rules;
  const g = cfg.planner.groupSize;
  const top = main[0] || special[0];
  const searchDate = new Date().toLocaleString('pt-BR', { timeZone: process.env.TZ || 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

  const subject = statusOnly
    ? `Passagens Europa (Belém): nada até ${brl(r.maxPrice)} ainda — melhor ${best ? brl(best.fare.price) : 'sem dados'}`
    : `✈️ Belém → Europa por ${brl(top.fare.price)} · ${city(top.fare.entry)} → ${city(top.fare.exit)}${!main.length ? ' (caso especial)' : ''}`;

  const sum = top || best;
  const summary = sum
    ? `<b>${statusOnly ? 'Mais barata encontrada' : 'Melhor oferta'}: ${brl(sum.fare.price)}</b> · ${esc(city(sum.fare.entry))} → ${esc(city(sum.fare.exit))} · ${fmtBR(sum.fare.depart).slice(0, 5)} a ${fmtBR(sum.fare.back).slice(0, 5)}`
    : 'Nenhuma tarifa encontrada nesta busca.';

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.bg}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:16px 8px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${C.bg}">

  <tr><td style="background:${C.sky};border-radius:12px 12px 0 0;border-bottom:4px solid ${C.orange};padding:20px 16px">
    <div style="${FONT}font-size:20px;font-weight:bold;color:#ffffff">✈️ Buscador de Passagens – Belém → Europa</div>
    <div style="${FONT}font-size:12px;color:#e0f2fe;margin-top:4px">Busca de ${esc(searchDate)} · ${stats.total} tarifas analisadas${boost ? ` · modo promoção: ${esc(boost)}` : ''}</div>
  </td></tr>

  <tr><td style="padding:16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-left:4px solid ${C.orange};border-radius:6px">
      <tr><td style="${FONT}padding:12px 14px;font-size:15px;color:${C.text}">${summary}
      ${statusOnly ? `<div style="font-size:13px;color:${C.muted};margin-top:6px">Ainda nada até ${brl(r.maxPrice)} com até ${r.maxHours}h por trecho. Continuo procurando 2x por dia.</div>` : ''}
      </td></tr>
    </table>
  </td></tr>

  ${main.length ? sectionTitle(`Dentro do limite · até ${brl(r.maxPrice)} e ${r.maxHours}h por trecho`) + main.map((o) => card(o, 'main', r, g)).join('') : ''}
  ${special.length ? sectionTitle(`Caso especial · até ${r.special.maxHours}h por até ${brl(r.special.maxPrice)}`) + special.map((o) => card(o, 'special', r, g)).join('') : ''}
  ${statusOnly && best ? sectionTitle('Melhor tarifa da semana (acima do limite)') + card(best, 'main', { ...r, maxPrice: best.fare.price }, g) : ''}

  <tr><td style="${FONT}padding:8px 20px 24px;font-size:11px;line-height:1.5;color:${C.muted}">
    📎 <b>PDFs do roteiro em anexo</b> (sozinha e grupo de ${g}) para ${sum ? `${esc(city(sum.fare.entry))} → ${esc(city(sum.fare.exit))}` : 'a melhor opção'}.<br>
    Preços de passagem são estimados a partir de buscas recentes e podem mudar: confirme no site da companhia antes de pagar.
    "2 bilhetes" são compras separadas; para o grupo, o preço pode subir ao comprar 4 assentos.<br>
    Totais por pessoa = passagem + hospedagem + comida e transporte + trens/voos internos + seguro + 10% de reserva ·
    €1 = R$ ${fx.rate.toFixed(2)} (${esc(fx.source)}).
  </td></tr>

</table></td></tr></table></body></html>`;
  return { subject, html };
}

/** Envio por HTTPS (porta 443) via Resend, para servidores que bloqueiam SMTP. */
async function sendViaResend({ subject, html, attachments }) {
  const { RESEND_API_KEY, RESEND_FROM = 'Buscador de Passagens <onboarding@resend.dev>', MAIL_TO } = process.env;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: RESEND_FROM, to: MAIL_TO.split(',').map((x) => x.trim()), subject, html,
      attachments: attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString('base64') })),
    }),
  });
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  console.log(`[email] enviado via Resend para ${MAIL_TO}: ${subject}`);
  return true;
}

export async function sendEmail({ subject, html, attachments = [] }) {
  if (process.env.RESEND_API_KEY && process.env.MAIL_TO) return sendViaResend({ subject, html, attachments });
  const { SMTP_HOST, SMTP_PORT = '465', SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_TO } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !MAIL_TO) {
    console.warn('[email] SMTP não configurado — e-mail não enviado. Assunto:', subject);
    return false;
  }
  const transport = nodemailer.createTransport({
    host: SMTP_HOST, port: +SMTP_PORT, secure: +SMTP_PORT === 465, auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 20_000, family: 4,
  });
  await transport.sendMail({ from: MAIL_FROM || SMTP_USER, to: MAIL_TO, subject, html, attachments });
  console.log(`[email] enviado para ${MAIL_TO}: ${subject}`);
  return true;
}
