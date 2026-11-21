import nodemailer from 'nodemailer';
import { fmtBR, weekday, WEEKDAYS_PT } from './dates.js';
import { CITIES } from './cities.js';
import { routeSummary, countryNames } from './planner.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const brl = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
const hrs = (m) => (m == null ? '?' : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`);
const stops = (n) => (n == null ? '?' : n === 0 ? 'direto' : `${n} esc.`);
const dw = (iso) => `${fmtBR(iso)} (${WEEKDAYS_PT[weekday(iso)].slice(0, 3)})`;
const city = (c) => CITIES[c]?.name || c;

const TD = 'style="padding:6px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top"';

function offerRow(o) {
  const f = o.fare;
  const links = [f.link && `<a href="${esc(f.link)}">ver ida</a>`, f.link2 && `<a href="${esc(f.link2)}">ver volta</a>`]
    .filter(Boolean).join(' · ').replace('ver ida', f.link2 ? 'ver ida' : 'ver voo');
  return `<tr>
    <td ${TD}><b style="font-size:16px">${brl(f.price)}</b>${o.isNew ? ' <span style="color:#059669;font-size:11px">NOVO</span>' : ''}<br>
      <small>${esc(f.kind)} · ${esc(f.source)}${f.priceLevel === 'low' ? ' · <b style="color:#059669">Google: preço baixo</b>' : ''}</small></td>
    <td ${TD}><b>${esc(city(f.entry))}</b> → … → <b>${esc(city(f.exit))}</b><br>
      <small>ida ${dw(f.depart)} · ${hrs(f.durationOut)} ${stops(f.stops)}<br>volta ${dw(f.back)} · ${hrs(f.durationBack)} ${stops(f.returnStops)}<br>${esc(f.airline)} · ${f.days + 1} dias</small></td>
    <td ${TD}><small>${esc(routeSummary(o.plan))}</small></td>
    <td ${TD} align="right">${brl(o.solo.brl.perPerson)}</td>
    <td ${TD} align="right">${brl(o.group.brl.perPerson)}<br><small>grupo: ${brl(o.group.brl.group)}</small></td>
    <td ${TD}>${links}</td>
  </tr>`;
}

const offersTable = (rows) => `<table cellspacing="0" style="border-collapse:collapse;font-size:13px;width:100%">
  <tr style="background:#eef2ff;text-align:left"><th ${TD}>Passagem</th><th ${TD}>Entrada / saída e voos</th><th ${TD}>Roteiro provável</th>
  <th ${TD}>Total sozinha*</th><th ${TD}>Total grupo/pessoa*</th><th ${TD}>Link</th></tr>
  ${rows.map(offerRow).join('')}</table>`;

function costBlock(title, c, groupSize) {
  const row = (k, v) => `<tr><td style="padding:3px 8px">${k}</td><td style="padding:3px 8px" align="right">${v}</td></tr>`;
  return `<td style="vertical-align:top;padding:0 12px 0 0"><b>${title}</b>
    <table style="font-size:13px">${row('Passagem', brl(c.brl.flight))}
    ${row('Hospedagem', brl(c.eur.lodging * c.eurBrl))}${row('Comida, transporte local, atrações', brl(c.eur.daily * c.eurBrl))}
    ${row('Trens/voos entre cidades', brl(c.eur.transport * c.eurBrl))}${c.eur.eta ? row('ETA Reino Unido', brl(c.eur.eta * c.eurBrl)) : ''}
    ${row('Imprevistos (10%)', brl(c.eur.reserve * c.eurBrl))}${row('Seguro-viagem', brl(c.brl.insurance))}
    <tr><td style="padding:3px 8px"><b>Total por pessoa</b></td><td style="padding:3px 8px" align="right"><b>${brl(c.brl.perPerson)}</b></td></tr>
    ${c.profile === 'group' ? `<tr><td style="padding:3px 8px"><b>Total grupo (${groupSize})</b></td><td style="padding:3px 8px" align="right"><b>${brl(c.brl.group)}</b></td></tr>` : ''}
    </table></td>`;
}

export function buildEmail({ main, special, best, cfg, fx, stats, weekdays, boost, statusOnly }) {
  const r = cfg.rules;
  const g = cfg.planner.groupSize;
  const top = main[0] || special[0];
  const subject = statusOnly
    ? `Passagens Europa (Belém): nada abaixo de ${brl(r.maxPrice)} ainda — melhor ${best ? brl(best.fare.price) : 'sem dados'}`
    : `✈️ Europa saindo de Belém por ${brl(top.fare.price)} — ${city(top.fare.entry)} / ${city(top.fare.exit)}${special.length && !main.length ? ' (caso especial)' : ''}`;

  const rec = top || best;
  const html = `<div style="font-family:Arial,sans-serif;color:#1f2937;max-width:960px">
  <h2 style="color:#1d4ed8;margin-bottom:4px">Buscador de passagens: Belém → Europa</h2>
  <p style="margin-top:0;color:#6b7280;font-size:13px">Ida entre ${fmtBR(cfg.window.departFrom)} e ${fmtBR(cfg.window.departTo)} ·
   viagem de ${cfg.window.minDays + 1} a ${cfg.window.maxDays + 1} dias · até ${brl(r.maxPrice)} e ${r.maxHours}h por trecho
   (ou até ${r.special.maxHours}h se custar até ${brl(r.special.maxPrice)}) · ${stats.total} tarifas analisadas${boost ? ` · <b>modo promoção: ${esc(boost)}</b>` : ''}</p>

  ${statusOnly ? `<p>Nenhuma passagem dentro dos critérios nesta semana. ${best ? `A mais barata encontrada foi <b>${brl(best.fare.price)}</b> (${esc(city(best.fare.entry))} / ${esc(city(best.fare.exit))}, ${dw(best.fare.depart)} a ${dw(best.fare.back)}).` : ''} Continuo procurando 2x por dia.</p>` : ''}

  ${main.length ? `<h3>Melhores opções (até ${brl(r.maxPrice)}, até ${r.maxHours}h por trecho)</h3>${offersTable(main)}` : ''}
  ${special.length ? `<h3>Caso especial: voo mais longo (até ${r.special.maxHours}h), mas até ${brl(r.special.maxPrice)}</h3>${offersTable(special)}` : ''}

  ${rec ? `<h3>Roteiro recomendado (PDFs em anexo)</h3>
  <p><b>${esc(routeSummary(rec.plan))}</b><br>
  <small>Entra por ${esc(city(rec.fare.entry))}, volta por ${esc(city(rec.fare.exit))} · ${rec.plan.nights} noites · ${esc(countryNames(rec.plan))}</small></p>
  <table><tr>${costBlock('Sozinha (hostel feminino)', rec.solo, g)}${costBlock(`Grupo de ${g} (apartamento/hotel)`, rec.group, g)}</tr></table>` : ''}

  ${weekdays.length ? `<h3>Dia de embarque mais barato (nesta busca)</h3><ol style="font-size:13px">${weekdays.slice(0, 4).map((w) => `<li>${w.day}: média ${brl(w.avg)}, mínimo ${brl(w.min)}</li>`).join('')}</ol>` : ''}

  <p style="font-size:12px;color:#6b7280">* Totais por pessoa = passagem + hospedagem + gastos diários + deslocamentos + seguro + 10% de reserva,
  câmbio €1 = R$ ${fx.rate.toFixed(2)} (${esc(fx.source)}). Estimativas de média temporada.
  Preços do Aviasales vêm de buscas recentes e podem mudar; "2 bilhetes" são compras separadas. Confirme no site da companhia antes de pagar.
  Para o grupo, o preço da passagem pode subir ao comprar 4 assentos juntos.</p>
  </div>`;
  return { subject, html };
}

export async function sendEmail({ subject, html, attachments = [] }) {
  const { SMTP_HOST, SMTP_PORT = '465', SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_TO } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !MAIL_TO) {
    console.warn('[email] SMTP não configurado — e-mail não enviado. Assunto:', subject);
    return false;
  }
  const transport = nodemailer.createTransport({
    host: SMTP_HOST, port: +SMTP_PORT, secure: +SMTP_PORT === 465, auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  await transport.sendMail({ from: MAIL_FROM || SMTP_USER, to: MAIL_TO, subject, html, attachments });
  console.log(`[email] enviado para ${MAIL_TO}: ${subject}`);
  return true;
}
