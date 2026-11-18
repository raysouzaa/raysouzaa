# ✈️ Buscador de passagens Brasil → Europa

Monitora tarifas de ida e volta de São Paulo para as principais portas de entrada da Europa
(Lisboa, Porto, Madri, Barcelona, Paris, Roma, Milão, Amsterdã e Frankfurt). Também busca combinações
de **chegada por uma cidade e volta por outra** (open-jaw). O resultado chega **por e-mail**.

O guia de viagem, com quando comprar, por onde entrar e os roteiros, está em [docs/ROTEIRO.md](docs/ROTEIRO.md).

## O que ele faz
- **Datas:**
  - considera ida entre 01/04 e 10/05/2027, com viagens de 12 a 15 dias
  - prioriza ida terça ou quarta e volta terça, quarta ou quinta
  - pula os feriados: Páscoa, Tiradentes e 1º de maio
- **Fontes de preço:**
  - **Aviasales / Travelpayouts** (gratuita): preços em cache das buscas recentes, cobrindo todos os destinos e todas as datas
  - **Google Flights via SerpApi** (opcional, cota grátis pequena): preço ao vivo em algumas datas, com o indicador
    "preço baixo/normal/alto" do Google
- **Histórico:** guarda o histórico de preços em `data/history.json`.
- **Alerta por e-mail** quando:
  - o preço fica abaixo do limite (`alerts.priceThreshold`, padrão R$ 4.000), ou
  - o preço cai X% em relação ao melhor já visto (`alerts.dropPercent`), ou
  - o Google marca o preço como baixo
- **Resumo diário:** com `sendDigestAlways`, manda também um resumo com o top 15 e **o dia da semana de embarque mais barato**.
- **Horário:** roda às 07h e às 19h (horário de Brasília). Dá para mudar em `schedule` no `config.json`.

## Configuração

### 1. Chaves
1. **Travelpayouts:**
   - crie uma conta em https://www.travelpayouts.com
   - entre no programa **Aviasales**
   - copie o token em *Tools → API*
2. **SerpApi (opcional):** crie uma conta em https://serpapi.com. O plano grátis dá algumas centenas de buscas por mês.
   Com `maxSearchesPerRun: 8` e 2 rodadas por dia são cerca de 480 por mês. Ajuste o valor ao seu plano.
3. **Gmail:**
   - ative a verificação em 2 etapas
   - crie uma **senha de app** em https://myaccount.google.com/apppasswords
   - use essa senha no `SMTP_PASS`

```bash
cp .env.example .env
nano .env        # preencha os tokens e o e-mail
```

### 2. Testar sem chave
```bash
npm install
MOCK=1 npm run once     # usa dados falsos; se o SMTP estiver configurado, manda o e-mail de teste
npm test
```
A prévia do último e-mail fica em `data/ultimo-email.html`.

## Rodar no servidor (Docker)
```bash
git clone https://github.com/raysouzaa/raysouzaa.git
cd raysouzaa/buscador-passagens
cp .env.example .env && nano .env
mkdir -p data && sudo chown 1000:1000 data   # o container roda como usuário "node" (uid 1000)
docker compose up -d --build
docker compose logs -f                        # acompanha as buscas
```
Para alterar destinos, datas ou alertas, edite o `config.json` e rode `docker compose restart`.

### Sem Docker (cron do sistema)
```bash
npm ci --omit=dev
crontab -e
# 0 7,19 * * * cd /caminho/buscador-passagens && /usr/bin/node --env-file=.env src/index.js --once >> busca.log 2>&1
```

## Principais opções do `config.json`
| Campo | O que é |
|---|---|
| `origins` | Códigos de origem: `SAO` (todos os aeroportos de SP), `RIO`, `BSB`, `CNF`, `REC`... |
| `destinations` | Cidades de destino (códigos IATA de cidade) |
| `openJaw` | Pares "chega em X, volta de Y" |
| `window` | Janela de ida e duração mínima e máxima da viagem |
| `preferredDepartWeekdays` / `preferredReturnWeekdays` | 0 = domingo ... 6 = sábado |
| `blackouts` | Períodos a evitar (feriados) |
| `alerts` | Limite de preço, % de queda e tamanho do resumo |

> Os preços do Aviasales vêm de cache e podem ter mudado quando você clicar. Sempre confirme no site da
> companhia. As combinações "2 bilhetes" são compras separadas.
