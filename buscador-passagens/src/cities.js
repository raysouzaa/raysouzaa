// Base de cidades e países usada pelo planejador.
// Custos em EURO, ESTIMATIVAS para abril/maio (média temporada). Ajuste à vontade.
//   hostel: cama em quarto FEMININO de hostel bem avaliado e central (por noite, 1 pessoa)
//   daily:  comida simples + transporte local + 1 atração paga, por pessoa/dia
//   apt4:   apartamento/Airbnb ou hotel para 4 pessoas (2 quartos), por noite, valor TOTAL

export const COUNTRIES = {
  PT: { name: 'Portugal', entry: 'fácil', note: 'Imigração em português; exige ~€75 por entrada + €40/dia em meios financeiros.' },
  ES: { name: 'Espanha', entry: 'rigorosa', note: 'Imigração conhecida por ser rígida com brasileiros (~€120/dia). Evitamos como porta de ENTRADA.' },
  FR: { name: 'França', entry: 'fácil' },
  DE: { name: 'Alemanha', entry: 'fácil' },
  IT: { name: 'Itália', entry: 'fácil' },
  UK: { name: 'Inglaterra', entry: 'burocrática', note: 'Fora do Schengen: exige ETA (autorização eletrônica, £20, pedir pelo app/site oficial do governo britânico, ~3 dias).' },
};

export const CITIES = {
  LIS: { name: 'Lisboa', country: 'PT', lat: 38.72, lon: -9.14, hostel: 35, daily: 45, apt4: 150,
    safe: 'Baixa, Chiado, Príncipe Real ou Avenidas Novas. Evite ruelas vazias do Martim Moniz/Intendente à noite.',
    see: ['Alfama, Castelo de São Jorge e miradouros', 'Belém: Torre, Jerónimos e pastéis', 'Bate-volta a Sintra', 'Baixa, Chiado e Bairro Alto'] },
  OPO: { name: 'Porto', country: 'PT', lat: 41.15, lon: -8.61, hostel: 30, daily: 40, apt4: 125,
    safe: 'Ribeira, Baixa e Cedofeita.',
    see: ['Ribeira, Ponte Luís I e caves de vinho do Porto', 'Livraria Lello, Clérigos e Bolhão'] },
  MAD: { name: 'Madri', country: 'ES', lat: 40.42, lon: -3.70, hostel: 35, daily: 50, apt4: 160,
    safe: 'Sol, Huertas (Barrio de las Letras), Malasaña e Salamanca.',
    see: ['Museu do Prado e Retiro', 'Palácio Real, Plaza Mayor e Sol', 'Bate-volta a Toledo'] },
  BCN: { name: 'Barcelona', country: 'ES', lat: 41.39, lon: 2.17, hostel: 45, daily: 55, apt4: 195,
    safe: 'Eixample e Gràcia. Cuidado com batedores de carteira; evite o Raval à noite.',
    see: ['Sagrada Família e Passeig de Gràcia', 'Bairro Gótico e El Born', 'Park Güell e Bunkers del Carmel'] },
  PAR: { name: 'Paris', country: 'FR', lat: 48.86, lon: 2.35, hostel: 55, daily: 60, apt4: 230,
    safe: 'Marais, Quartier Latin, Saint-Germain e 11e. Evite os arredores de Gare du Nord/Château Rouge à noite.',
    see: ['Torre Eiffel, Trocadéro e cruzeiro no Sena', 'Louvre, Tulherias e Champs-Élysées', 'Montmartre e Sacré-Cœur', 'Versalhes (bate-volta)'] },
  LON: { name: 'Londres', country: 'UK', lat: 51.51, lon: -0.13, hostel: 60, daily: 70, apt4: 270,
    safe: 'Bloomsbury, South Kensington, Southbank e Paddington.',
    see: ['Westminster, Big Ben e London Eye', 'British Museum e Covent Garden', 'Tower Bridge, Torre de Londres e Borough Market'] },
  BER: { name: 'Berlim', country: 'DE', lat: 52.52, lon: 13.40, hostel: 35, daily: 50, apt4: 150,
    safe: 'Mitte, Prenzlauer Berg e Friedrichshain (rua principal).',
    see: ['Portão de Brandemburgo, Reichstag e Memorial do Holocausto', 'Ilha dos Museus e East Side Gallery', 'Checkpoint Charlie e Topografia do Terror'] },
  MUC: { name: 'Munique', country: 'DE', lat: 48.14, lon: 11.58, hostel: 50, daily: 55, apt4: 200,
    safe: 'Altstadt, Maxvorstadt e Schwabing.',
    see: ['Marienplatz, Viktualienmarkt e cervejarias', 'Jardim Inglês e Residenz', 'Bate-volta ao Castelo de Neuschwanstein'] },
  FRA: { name: 'Frankfurt', country: 'DE', lat: 50.11, lon: 8.68, hostel: 40, daily: 50, apt4: 160,
    safe: 'Sachsenhausen, Westend e centro antigo. Evite o Bahnhofsviertel (região da estação) à noite.',
    see: ['Römerberg e beira do rio Meno', 'Bate-volta ao vale do Reno (Rüdesheim)'] },
  VCE: { name: 'Veneza', country: 'IT', lat: 45.44, lon: 12.32, hostel: 50, daily: 55, apt4: 200,
    safe: 'Cannaregio ou Mestre (mais barato, 10 min de trem).',
    see: ['Praça São Marcos, Basílica e Ponte de Rialto', 'Burano e Murano de vaporetto'] },
  FLR: { name: 'Florença', country: 'IT', lat: 43.77, lon: 11.25, hostel: 45, daily: 55, apt4: 180,
    safe: 'Centro histórico, Santa Croce e Oltrarno.',
    see: ['Duomo, Ponte Vecchio e Piazza della Signoria', 'Galeria Uffizi e Piazzale Michelangelo', 'Bate-volta a Pisa ou Siena'] },
  ROM: { name: 'Roma', country: 'IT', lat: 41.90, lon: 12.50, hostel: 45, daily: 55, apt4: 190,
    safe: 'Monti, Trastevere e Prati. Evite os arredores da estação Termini à noite.',
    see: ['Coliseu, Fórum e Palatino', 'Vaticano: Museus, Capela Sistina e São Pedro', 'Fontana di Trevi, Panteão e Piazza Navona', 'Trastevere e Villa Borghese'] },
  MIL: { name: 'Milão', country: 'IT', lat: 45.46, lon: 9.19, hostel: 45, daily: 55, apt4: 185,
    safe: 'Brera, Navigli e Porta Romana. Evite arredores da Centrale à noite.',
    see: ['Duomo, Galeria Vittorio Emanuele e Brera', 'Bate-volta ao Lago de Como'] },
};

// Cidades de cada país em ordem de prioridade turística (as de "trânsito" vêm por último).
export const COUNTRY_CITIES = {
  PT: ['LIS', 'OPO'],
  ES: ['MAD', 'BCN'],
  UK: ['LON'],
  FR: ['PAR'],
  DE: ['MUC', 'BER', 'FRA'],
  IT: ['ROM', 'FLR', 'VCE', 'MIL'],
};
export const TRANSIT_CITIES = new Set(['FRA', 'MIL']);

// Conversão de aeroporto -> código de cidade.
export const AIRPORT_CITY = {
  GRU: 'SAO', CGH: 'SAO', VCP: 'SAO', GIG: 'RIO', SDU: 'RIO',
  CDG: 'PAR', ORY: 'PAR', BVA: 'PAR', FCO: 'ROM', CIA: 'ROM', MXP: 'MIL', LIN: 'MIL', BGY: 'MIL',
  LHR: 'LON', LGW: 'LON', STN: 'LON', LTN: 'LON', LCY: 'LON', TXL: 'BER', SXF: 'BER',
};
export const cityOf = (code) => AIRPORT_CITY[code] || code;

export function distanceKm(a, b) {
  const A = CITIES[a]; const B = CITIES[b];
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(B.lat - A.lat) / 2) ** 2
    + Math.cos(r(A.lat)) * Math.cos(r(B.lat)) * Math.sin(r(B.lon - A.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Trechos com informação conhecida (custo por pessoa em €, comprado com antecedência).
const KNOWN_LEGS = {
  'LIS-OPO': { mode: 'trem', h: 3, eur: 30 },
  'LIS-MAD': { mode: 'voo low-cost', h: 3.5, eur: 55 },
  'MAD-BCN': { mode: 'trem AVE/Ouigo', h: 3, eur: 35 },
  'BCN-PAR': { mode: 'trem TGV', h: 6.5, eur: 70 },
  'LON-PAR': { mode: 'trem Eurostar', h: 2.5, eur: 90 },
  'PAR-MUC': { mode: 'trem TGV/ICE', h: 6, eur: 75 },
  'FRA-PAR': { mode: 'trem ICE/TGV', h: 4, eur: 60 },
  'BER-MUC': { mode: 'trem ICE', h: 4.5, eur: 50 },
  'FRA-MUC': { mode: 'trem ICE', h: 3.5, eur: 50 },
  'BER-FRA': { mode: 'trem ICE', h: 4.5, eur: 50 },
  'MUC-VCE': { mode: 'trem/ônibus', h: 7, eur: 50 },
  'MIL-MUC': { mode: 'trem (via Verona)', h: 7, eur: 60 },
  'FLR-MUC': { mode: 'trem (via Verona/Bolonha)', h: 7, eur: 70 },
  'FLR-VCE': { mode: 'trem Italo/Frecciarossa', h: 2.2, eur: 30 },
  'FLR-ROM': { mode: 'trem Italo/Frecciarossa', h: 1.7, eur: 25 },
  'FLR-MIL': { mode: 'trem Italo/Frecciarossa', h: 2, eur: 30 },
  'MIL-VCE': { mode: 'trem', h: 2.5, eur: 25 },
  'MIL-ROM': { mode: 'trem Italo/Frecciarossa', h: 3.2, eur: 40 },
  'ROM-VCE': { mode: 'trem Italo/Frecciarossa', h: 4, eur: 40 },
  'MIL-PAR': { mode: 'trem TGV', h: 7, eur: 70 },
};

/** Como ir de uma cidade a outra: modo, horas porta a porta e custo estimado por pessoa (€). */
export function legInfo(a, b) {
  if (a === b) return null;
  const k = [a, b].sort().join('-');
  if (KNOWN_LEGS[k]) return { ...KNOWN_LEGS[k] };
  const d = distanceKm(a, b);
  const sameCountry = CITIES[a].country === CITIES[b].country;
  const ukInvolved = CITIES[a].country === 'UK' || CITIES[b].country === 'UK';
  if (!ukInvolved && (sameCountry || d < 650)) {
    return { mode: 'trem', h: +(d / 140 + 0.5).toFixed(1), eur: Math.round(25 + d * 0.08) };
  }
  return { mode: 'voo low-cost (só bagagem de mão)', h: +(3 + d / 750).toFixed(1), eur: Math.round(55 + d * 0.035) };
}
