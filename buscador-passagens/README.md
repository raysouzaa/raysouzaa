# ✈️ Buscador de passagens Belém → Europa

Procura passagens de **Belém (BEL)** para a Europa, monta o **roteiro provável** de cada uma e manda tudo **por e-mail**.
O e-mail traz os preços no corpo e **2 PDFs** de roteiro: um para viajar **sozinha** e outro para **grupo de 4**.

O guia de viagem (quando comprar, por onde entrar, custos) está em [docs/ROTEIRO.md](docs/ROTEIRO.md).

## Regras da busca
- **Saída:** sempre de Belém.
- **Entrada na Europa:** só por países sem burocracia.
  - Portugal (Lisboa, Porto), França (Paris), Itália (Roma, Milão) e Alemanha (Frankfurt, Munique, Berlim).
  - Espanha e Inglaterra servem **só para a volta**: a Espanha é rígida na imigração e a Inglaterra exige ETA.
- **Volta:** pode ser pela mesma cidade ou por outra cidade segura (Lisboa, Porto, Madri, Barcelona, Paris, Roma, Milão,
  Frankfurt, Munique, Berlim ou Londres).
- **Preço:** até **R$ 4.500** ida e volta, com no máximo **16h por trecho**, contando as escalas.
- **Caso especial:** até **20h por trecho**, desde que custe até **R$ 3.000**. Aparece numa seção separada do e-mail.
- **Datas:**
  - ida entre 01/04 e 10/05/2027, com viagens de **12 a 20 dias**
  - prioriza ida segunda, terça, quarta ou sexta e volta de segunda a sexta
  - evita Páscoa, Tiradentes e 1º de maio

## Roteiro automático
- **Países:** sempre **Alemanha e Itália**. Depois completa com França, Espanha e Inglaterra, conforme os dias.
- **Portugal** só entra se a passagem chegar ou voltar por Lisboa ou Porto.
- **Ordem das cidades:** começa onde o voo chega, termina de onde ele volta e segue a ordem com menos deslocamento.
- **Custos estimados**, por pessoa, em reais:
  - passagem
  - hospedagem: **hostel com quarto feminino** para quem vai sozinha, **apartamento ou hotel dividido** para o grupo
  - comida e transporte local
  - trens e voos entre cidades
  - seguro-viagem
  - ETA, se o roteiro passar pela Inglaterra
  - 10% para imprevistos
- **Câmbio:** usa a cotação do euro do dia, do Banco Central Europeu.
- **PDFs:** trazem passagem, custos, onde ficar em cada cidade (bairros seguros), programação dia a dia,
  dicas de segurança (sozinha) ou de divisão de gastos (grupo) e os documentos necessários.

## Quando ele manda e-mail
- **Horários:** às **07h e às 19h** (horário de Brasília).
- **Promoções:** durante a **Black Friday, a Cyber Monday e a Travel Tuesday** (26/11 a 02/12/2026) e nas
  liquidações de janeiro (04 a 15/01/2027), busca também **a cada 4 horas**, com 2 buscas extras no Google Flights na Black Friday (só Aviasales em janeiro),
  para caber na cota grátis do SerpApi.
- **Quando envia:** só quando aparece uma passagem nova dentro das regras, ou quando uma já enviada fica 3% mais barata.
  Assim você não recebe o mesmo e-mail duas vezes por dia.
- **Sem novidade:** se passar 7 dias sem nada dentro das regras, manda um resumo com a melhor tarifa encontrada.

## Fontes de preço
- **Aviasales / Travelpayouts** (grátis): preços de buscas recentes. Combina **ida para uma cidade e volta de outra**.
- **Google Flights via SerpApi** (opcional, 250 buscas/mês grátis): confere **ao vivo** as melhores combinações,
  inclusive como bilhete multidestino. São 3 buscas por rodada (metade confere as melhores do Aviasales, metade explora rotas e datas em rodízio), cerca de 180 a 210 por mês.

## Configuração
```bash
cp .env.example .env
nano .env   # TRAVELPAYOUTS_TOKEN, SERPAPI_KEY e dados do Gmail (senha de app)
```
- **Gmail:** precisa de uma **senha de app**: https://myaccount.google.com/apppasswords (exige verificação em 2 etapas).
- **Travelpayouts:** o token fica em *Profile → API token*.
- **SerpApi:** a chave fica em https://serpapi.com/manage-api-key.
- **Servidor bloqueia SMTP** (erro `ETIMEDOUT` no e-mail): muitos provedores bloqueiam as portas 465 e 587.
  Use o **Resend**, que envia por HTTPS:
  - crie uma conta grátis em https://resend.com com o **mesmo e-mail do `MAIL_TO`**
  - gere a chave em *API Keys*
  - coloque `RESEND_API_KEY=...` no `.env`

  Com essa chave preenchida, o buscador usa o Resend no lugar do Gmail.

### Testar sem chave
```bash
npm install
MOCK=1 FORCE_EMAIL=1 npm run once   # dados falsos; gera data/ultimo-email.html e os 2 PDFs (e envia se o SMTP estiver ok)
npm test
```

## Rodar no servidor (Docker)
```bash
git clone -b claude/epic-thompson-736e5m https://github.com/raysouzaa/raysouzaa.git
cd raysouzaa/buscador-passagens
cp .env.example .env && nano .env
mkdir -p data && sudo chown 1000:1000 data   # o container roda como usuário "node" (uid 1000)
docker compose up -d --build
docker compose logs -f
```
Para atualizar: `git pull && docker compose up -d --build`.

- **Testar o e-mail na hora:** `docker compose exec -e FORCE_EMAIL=1 buscador node src/index.js --once`
- **Mudar regras** (preço, horas, cidades, países, datas): edite o `config.json` e rode `docker compose restart`.

## `config.json`
| Campo | O que é |
|---|---|
| `origin` | Cidade de saída (`BEL`) |
| `entryCities` / `returnCities` | Cidades permitidas para chegar e para voltar |
| `window` | Janela de ida; `minDays`/`maxDays` = diferença entre ida e volta (19 = viagem de 20 dias) |
| `rules` | `maxPrice` 4500, `maxHours` 16; `special`: `maxPrice` 3000, `maxHours` 20 |
| `planner` | Países obrigatórios (`DE`, `IT`), opcionais em ordem de preferência, tamanho do grupo, seguro/dia, câmbio reserva |
| `alerts` | Quantas opções no e-mail, % de queda para reenviar, dias para o resumo sem novidades |
| `boost` | Períodos de promoção com busca extra |

Os custos por cidade (hostel, apartamento, gastos do dia, bairros seguros, atrações) ficam em `src/cities.js`.

> Preços do Aviasales vêm de buscas recentes e podem ter mudado. "2 bilhetes" são compras separadas. Para o grupo, o
> preço pode subir ao comprar 4 assentos. Confirme sempre no site da companhia antes de pagar.
