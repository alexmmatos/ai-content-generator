# ai-content-generator

API que gera conteúdo com IA de forma assíncrona: uma requisição enfileira um job, um worker
processa em background (chamada de IA simulada + upload para S3) e o cliente consulta o
status pelo `contentId`. Construído com Fastify, Prisma (PostgreSQL), BullMQ (Redis) e
Minio (S3-compatível).

## Como rodar

```bash
cp .env.example .env
docker-compose up --build
```

A API sobe em `http://localhost:3000`. O `docker-compose up` também sobe o worker, o
Postgres, o Redis e o Minio — não é preciso ter Node instalado no host, nem rodar `npm
install` fora do container.

O container `api` aplica as migrations (`prisma migrate deploy`) e roda o seed
(`prisma db seed`) automaticamente antes de subir o servidor, criando dois usuários com IDs
fixos (prontos pra usar em `POST /api/content/generate` sem precisar consultar o banco ou o
log):

| Usuário | ID | Créditos | Uso |
|---|---|---|---|
| Com crédito | `297c69ca-df7a-4062-b5ce-957df31dfb82` | 10 | caminho feliz |
| Sem crédito | `b485e014-75b7-47c7-a84a-14da3fcfaa8e` | 0 | testar o 402 |

O seed também cria, sob o usuário com créditos, um `Content` de cada status (`PENDING`,
`PROCESSING`, `COMPLETED` com uma URL real no Minio, `CANCELED`, `FAILED`) — os IDs desses
são aleatórios, aparecem no log:

```bash
docker compose logs api | grep "Seed:"
```

Isso dá pra testar `GET /api/content/:id` e `POST /api/content/:id/cancel` contra todos os
estados sem depender do worker rodar de verdade (5s + ~20% de chance de falha por chamada).

## Documentação

Swagger/OpenAPI gerado automaticamente a partir dos schemas Zod, disponível em
`http://localhost:3000/docs`.

## Endpoints

| Método | Rota                          | Descrição                                              |
|--------|-------------------------------|---------------------------------------------------------|
| POST   | `/api/content/generate`       | Debita 1 crédito, cria o conteúdo (`PENDING`) e enfileira o job |
| GET    | `/api/content/:id`            | Status, dados originais e URL do resultado (se concluído)  |
| POST   | `/api/content/:id/cancel`     | Cancela a geração (idempotente)                          |

## Testes

```bash
npm test
```

Cobre as duas garantias centrais do desafio: débito de crédito sem duplicação sob
concorrência, e um conteúdo cancelado que nunca volta a `COMPLETED` — inclusive o caso de
retry do BullMQ após a falha simulada da IA (~20% de chance por tentativa).

```bash
docker-compose up -d postgres   # precisa de um Postgres real de pé
npm run test:integration
```

Teste de integração à parte (não roda no `npm test` padrão): dispara `decrementCredits`
concorrente de verdade contra o Postgres do compose, provando a atomicidade do `UPDATE`
condicional — os testes com repositório fake em memória provam a lógica do serviço, mas não
uma corrida real entre conexões.

## Decisões arquiteturais

**Crédito (concorrência).** O débito de crédito é uma única query condicional —
`UPDATE users SET credits = credits - 1 WHERE id = ? AND credits > 0` — em vez de um
`SELECT` seguido de `UPDATE`. Duas requisições concorrentes com 1 crédito disponível nunca
debitam as duas: a segunda `UPDATE` afeta 0 linhas e falha com `InsufficientCreditsError`.

**Corrida worker vs. `/cancel`.** Toda escrita de status (do worker e da rota de
cancelamento) passa por um único primitivo condicional,
`updateStatusIf(id, statusEsperado, dados)`, que só aplica a mudança se o status atual no
banco bater com o esperado — condição e escrita na mesma query, nunca um
"ler-depois-escrever" separado. Isso garante que, se `/cancel` for chamado enquanto o worker
está no meio dos 5s de espera da IA simulada, a escrita final do worker (`COMPLETED` ou
`FAILED`) simplesmente não aplica — o conteúdo permanece `CANCELED`. O mesmo primitivo
também precisa aceitar `PROCESSING` como estado de partida ao marcar `PROCESSING` de novo
(não só `PENDING`): sem isso, um retry do BullMQ após a falha simulada da IA seria
confundido com um cancelamento e o job nunca terminaria de processar.

**Falhas simuladas da IA (~20%).** Tratadas via `attempts`/`backoff` do próprio BullMQ, não
com try/catch silencioso — um job que esgota as tentativas (`0.2³ ≈ 0.8%` de chance) vira
`FAILED` no banco através do listener `worker.on("failed", ...)`.

**Camadas.** `routes → services → repositories`, em uma direção só. Services dependem de
interfaces de repositório (não do Prisma diretamente), o que permite os testes de regras de
negócio rodarem com repositórios fake em memória, sem precisar de Postgres/Redis reais.
