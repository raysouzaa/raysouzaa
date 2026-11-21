// Gera o PDF do roteiro (sozinha ou grupo) com pdfkit. Só usa caracteres Latin-1 (fontes padrão do PDF).
import PDFDocument from 'pdfkit';
import { CITIES, COUNTRIES } from './cities.js';
import { dailySchedule, routeSummary, countryNames } from './planner.js';
import { fmtBR, weekday, WEEKDAYS_PT } from './dates.js';

const clean = (s) => String(s ?? '')
  .replace(/[→⇄]/g, '>').replace(/≈/g, '~').replace(/[–—]/g, '-')
  .replace(/[^\x20-\x7E\xA0-\xFF€•\n]/g, '');
const brl = (v) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
const eur = (v) => `€ ${Math.round(v).toLocaleString('pt-BR')}`;
const hrs = (m) => (m == null ? 'n/d' : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`);
const dw = (iso) => `${fmtBR(iso)} (${WEEKDAYS_PT[weekday(iso)].slice(0, 3)})`;

const C = { brand: '#1d4ed8', text: '#1f2937', muted: '#6b7280', line: '#d1d5db', band: '#eef2ff' };

function table(doc, cols, rows, { header = true } = {}) {
  const x0 = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const widths = cols.map((c) => c.w * width);
  const drawRow = (cells, bold, fill) => {
    const h = Math.max(...cells.map((c, i) => doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
      .heightOfString(clean(c), { width: widths[i] - 8 }))) + 8;
    if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const y = doc.y;
    if (fill) doc.rect(x0, y, width, h).fill(fill);
    let x = x0;
    cells.forEach((c, i) => {
      doc.fillColor(C.text).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
        .text(clean(c), x + 4, y + 4, { width: widths[i] - 8, align: cols[i].align || 'left' });
      x += widths[i];
    });
    doc.moveTo(x0, y + h).lineTo(x0 + width, y + h).strokeColor(C.line).lineWidth(0.5).stroke();
    doc.x = x0; doc.y = y + h;
  };
  if (header) drawRow(cols.map((c) => c.label), true, C.band);
  rows.forEach((r) => drawRow(r, r.bold, null));
  doc.moveDown(0.6);
}

function h2(doc, text) {
  if (doc.y > doc.page.height - 140) doc.addPage();
  doc.moveDown(0.4).fillColor(C.brand).font('Helvetica-Bold').fontSize(13).text(clean(text));
  doc.moveDown(0.3).fillColor(C.text);
}
const p = (doc, text, opts = {}) => doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.size || 10)
  .fillColor(opts.color || C.text).text(clean(text), { lineGap: 2 });
const bullets = (doc, items) => items.forEach((t) => p(doc, `•  ${t}`));

/**
 * @returns {Promise<Buffer>}
 */
export function planPdf({ plan, costs, fare, profile, groupSize = 4, fx }) {
  const solo = profile === 'solo';
  const doc = new PDFDocument({ size: 'A4', margin: 42, info: { Title: `Roteiro Europa - ${solo ? 'sozinha' : `grupo de ${groupSize}`}` } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  // Capa / resumo
  doc.fillColor(C.brand).font('Helvetica-Bold').fontSize(20)
    .text(clean(`Roteiro Europa - ${solo ? 'viagem sozinha' : `grupo de ${groupSize} pessoas`}`));
  doc.fillColor(C.muted).font('Helvetica').fontSize(10)
    .text(clean(`${dw(plan.depart)} a ${dw(plan.retDate)} · ${plan.nights} noites na Europa · ${countryNames(plan)}`));
  doc.moveDown(0.5);
  p(doc, routeSummary(plan), { bold: true, size: 11 });

  h2(doc, 'Passagem');
  table(doc, [{ label: 'Trecho', w: 0.34 }, { label: 'Data', w: 0.2 }, { label: 'Duração / escalas', w: 0.26 }, { label: 'Cia', w: 0.2 }], [
    [`Belém (BEL) > ${CITIES[plan.entry].name} (${fare.entryAirport || plan.entry})`, dw(fare.depart), `${hrs(fare.durationOut)} · ${fare.stops === 0 ? 'direto' : `${fare.stops ?? '?'} escala(s)`}`, fare.airline || '-'],
    [`${CITIES[plan.ret].name} (${fare.exitAirport || plan.ret}) > Belém (BEL)`, dw(fare.back), `${hrs(fare.durationBack)} · ${fare.returnStops === 0 ? 'direto' : `${fare.returnStops ?? '?'} escala(s)`}`, ''],
  ]);
  p(doc, `Preço encontrado: ${brl(fare.price)} por pessoa, ida e volta (${fare.kind}, fonte ${fare.source}). ${solo ? '' : `Para ${groupSize} pessoas: ~${brl(fare.price * groupSize)} (o preço pode subir ao comprar 4 assentos).`}`);
  if (fare.kind === '2 bilhetes') p(doc, 'Atenção: são 2 bilhetes separados. Se o voo de ida atrasar, a companhia da volta não tem obrigação de remarcar.', { color: C.muted, size: 9 });

  h2(doc, 'Quanto vai custar (por pessoa)');
  table(doc, [{ label: 'Item', w: 0.6 }, { label: 'Euro', w: 0.2, align: 'right' }, { label: 'Reais', w: 0.2, align: 'right' }], [
    ['Passagem ida e volta', '', brl(costs.brl.flight)],
    [solo ? 'Hospedagem (hostel, cama em quarto feminino)' : `Hospedagem (apartamento/hotel dividido por ${groupSize})`, eur(costs.eur.lodging), brl(costs.eur.lodging * fx)],
    ['Alimentação, transporte local e atrações', eur(costs.eur.daily), brl(costs.eur.daily * fx)],
    ['Trens/voos entre cidades + traslados de aeroporto', eur(costs.eur.transport), brl(costs.eur.transport * fx)],
    ...(costs.eur.eta ? [['ETA do Reino Unido (£20)', eur(costs.eur.eta), brl(costs.eur.eta * fx)]] : []),
    ['Reserva para imprevistos (10%)', eur(costs.eur.reserve), brl(costs.eur.reserve * fx)],
    ['Seguro-viagem (cobertura mín. €30 mil)', '', brl(costs.brl.insurance)],
    Object.assign([`TOTAL POR PESSOA`, eur(costs.eur.total), brl(costs.brl.perPerson)], { bold: true }),
    ...(solo ? [] : [Object.assign([`TOTAL DO GRUPO (${groupSize} pessoas)`, '', brl(costs.brl.group)], { bold: true })]),
  ]);
  p(doc, `Câmbio usado: €1 = R$ ${fx.toFixed(2)}. Valores de hospedagem e gastos são estimativas de média temporada; reservando cedo costuma sair mais barato.`, { color: C.muted, size: 9 });

  h2(doc, 'Hospedagem por cidade');
  table(doc, [{ label: 'Cidade', w: 0.16 }, { label: 'Noites', w: 0.09, align: 'center' }, { label: solo ? 'Hostel/noite' : 'Por pessoa/noite', w: 0.14, align: 'right' }, { label: 'Onde ficar', w: 0.61 }],
    costs.lines.map((l, i) => [l.city, `${l.nights} (${fmtBR(plan.stops[i].checkIn).slice(0, 5)})`, eur(l.perNight), CITIES[plan.stops[i].city].safe]));

  h2(doc, 'Dia a dia');
  table(doc, [{ label: 'Dia', w: 0.07, align: 'center' }, { label: 'Data', w: 0.15 }, { label: 'Cidade', w: 0.14 }, { label: 'Programação', w: 0.64 }],
    dailySchedule(plan).map((d) => [String(d.n), dw(d.date), d.city, d.text]));

  h2(doc, solo ? 'Segurança para mulher viajando sozinha' : 'Dicas para o grupo');
  bullets(doc, solo ? [
    'Reserve hostels com quarto FEMININO, nota 8,5+ e comentários recentes de mulheres; prefira os com armário individual e recepção 24h.',
    'Chegue nas cidades de dia sempre que possível (os trens sugeridos já consideram isso).',
    'Compartilhe a localização em tempo real com alguém de confiança e deixe o roteiro impresso com a família.',
    'Use doleira/pochete por baixo da roupa em Paris, Barcelona, Roma e metrôs lotados (furtos são o maior risco).',
    'Evite a região das estações centrais à noite (Termini em Roma, Gare du Nord em Paris, Bahnhofsviertel em Frankfurt).',
    'Tenha um eSIM europeu ativo desde o pouso e o número de emergência 112 (vale em toda a UE).',
  ] : [
    `Para ${groupSize} pessoas, apartamento com 2 quartos e 2 banheiros costuma sair mais barato que 2 quartos de hotel; confira taxa de limpeza e taxa turística.`,
    'Reserve tudo com cancelamento grátis e divida os pagamentos por app (Splitwise ou similar).',
    'Comprem os trens juntos com antecedência: Trenitalia/Italo, SNCF/Ouigo, Deutsche Bahn têm tarifas de grupo e promoções.',
    'Cozinhar o café da manhã e alguns jantares no apartamento reduz bastante o gasto diário (já considerado na estimativa).',
    'Combinem um valor de "caixinha" comum para mercado, táxis e gorjetas.',
  ]);

  h2(doc, 'Documentos e entrada');
  const docs = [
    'Passaporte válido por pelo menos 3 meses após a volta e emitido há menos de 10 anos.',
    'Brasileiro não precisa de visto para o Espaço Schengen (até 90 dias). Na 1ª entrada há cadastro biométrico (EES): digitais e foto, pode ter fila.',
    'ETIAS: previsto para 2027, sem data confirmada. Confira em travel-europe.europa.eu/etias 2 meses antes (taxa ~€20).',
    'Leve impressos: passagem de volta, reservas de todas as hospedagens, este roteiro, seguro-viagem (mín. €30 mil) e comprovante de dinheiro/cartão.',
    `Porta de entrada: ${COUNTRIES[CITIES[plan.entry].country].name} (imigração ${COUNTRIES[CITIES[plan.entry].country].entry}).`,
  ];
  if (plan.countries.includes('UK')) docs.push('Inglaterra fica fora do Schengen: peça o ETA (£20) pelo app oficial "UK ETA" ou gov.uk, com 1 semana de antecedência. Cuidado com sites falsos.');
  bullets(doc, docs);

  doc.moveDown(1);
  p(doc, 'Gerado automaticamente pelo buscador de passagens. Preços de passagem mudam rápido: confira no site da companhia antes de comprar.', { color: C.muted, size: 8 });
  doc.end();
  return done;
}
