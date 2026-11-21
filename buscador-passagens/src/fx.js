// Cotação EUR -> BRL do dia (Banco Central Europeu via frankfurter.app, sem chave). Usa o valor do config se falhar.
export async function eurToBrl(fallback = 6.3) {
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=BRL', { signal: AbortSignal.timeout(8000) });
    const json = await res.json();
    const v = Number(json?.rates?.BRL);
    if (v > 3 && v < 15) return { rate: v, source: `BCE ${json.date}` };
  } catch { /* sem internet ou API fora: usa o fallback */ }
  return { rate: fallback, source: 'valor fixo do config' };
}
