# ai-content-generator

API que gera conteúdo com IA de forma assíncrona: uma requisição enfileira um job, um worker
processa em background (chamada de IA simulada + upload para S3) e o cliente consulta o
status pelo `contentId`. Construído com Fastify, Prisma (PostgreSQL), BullMQ (Redis) e
Minio (S3-compatível).

## Como rodar

```bash
docker compose up --build
```

A API sobe em `http://localhost:3000`. O `docker compose up` também sobe o worker, o
Postgres, o Redis e o Minio — não é preciso ter Node instalado no host, nem rodar `npm
install` fora do container. O `.env` é opcional: os defaults locais já estão no Compose;
copie `.env.example` apenas se quiser sobrescrevê-los. As imagens Minio estão fixadas por
digest para que uma futura mudança em `latest` não quebre o bootstrap.

O serviço one-shot `database-setup` aplica as migrations (`prisma migrate deploy`) e roda o
seed (`prisma db seed`) antes da API e do worker. Assim, migrations não são efeito colateral
do startup HTTP. O seed cria dois usuários com IDs fixos:

| Usuário | ID | Créditos | Uso |
|---|---|---|---|
| Com crédito | `297c69ca-df7a-4062-b5ce-957df31dfb82` | 10 | caminho feliz |
| Sem crédito | `b485e014-75b7-47c7-a84a-14da3fcfaa8e` | 0 | testar o 402 |

O seed também cria, sob o usuário com créditos, um `Content` de cada status (`PENDING`,
`PROCESSING`, `COMPLETED`, `CANCELED`, `FAILED`) — os IDs são aleatórios e aparecem no log:

```bash
docker compose logs database-setup | grep "Seed:"
```

Isso dá pra testar `GET /api/content/:id` e `POST /api/content/:id/cancel` contra todos os
estados sem depender do worker rodar de verdade (5s + ~20% de chance de falha por chamada).

## Documentação

Swagger/OpenAPI gerado automaticamente a partir dos schemas Zod, disponível em
`http://localhost:3000/docs`.

## Endpoints

| Método | Rota                          | Descrição                                              |
|--------|-------------------------------|---------------------------------------------------------|
| POST   | `/api/content/generate`       | Debita 1 crédito e grava conteúdo (`PENDING`) + outbox |
| GET    | `/api/content/:id`            | Status, dados originais e URL do resultado (se concluído)  |
| POST   | `/api/content/:id/cancel`     | Cancela a geração (idempotente)                          |

### `request-id` e idempotência

`POST /api/content/generate` aceita um UUID no header opcional `request-id`. O mesmo valor
é devolvido no header e no corpo da resposta, persistido com o conteúdo, enviado no job do
BullMQ, incluído nos logs do worker e gravado nos metadados do objeto no S3.

```bash
curl -i -X POST http://localhost:3000/api/content/generate \
  -H 'content-type: application/json' \
  -H 'request-id: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' \
  -d '{"topic":"gatos","userId":"297c69ca-df7a-4062-b5ce-957df31dfb82"}'
```

Repetir o mesmo `request-id` com o mesmo payload retorna o mesmo `contentId`, não debita
outro crédito, inclui `request-replayed: true` e informa o estado persistido atual.
Reutilizá-lo com outro `topic` ou `userId` retorna `409`. Sem o header, a API gera um UUID
automaticamente; para que um retry após timeout seja idempotente, o cliente deve gerar e
reutilizar seu próprio UUID.

O cancelamento retorna também `canceled`: `true` quando a chamada aplicou a transição e
`false` quando o conteúdo já estava cancelado ou em outro estado terminal.

## Testes

```bash
npm test
npm run test:coverage
npm run lint
```

Cobre as duas garantias centrais do desafio: débito de crédito sem duplicação sob
concorrência, e um conteúdo cancelado que nunca volta a `COMPLETED` — inclusive o caso de
retry do BullMQ após a falha simulada da IA (~20% de chance por tentativa).

As suítes com infraestrutura usam projetos Compose temporários e removem somente os próprios
containers, volumes e dados ao terminar:

```bash
npm run test:integration # PostgreSQL + Redis/BullMQ; valida backoff real
npm run test:e2e         # HTTP + PostgreSQL + outbox + BullMQ + worker + Minio
npm run test:all         # todos os quality gates
```

A integração prova transação/rollback concorrente, três tentativas reais, reconciliação de
`FAILED` após indisponibilidade do banco e prioridade do cancelamento. O E2E prova que a API
aceita pedidos com worker/Redis/Minio parados e que o worker os conclui com a API parada,
além de replay, download, metadados e ausência de objeto órfão.

## Decisões arquiteturais

**Crédito, idempotência e outbox (concorrência).** Criação do conteúdo, débito condicional
e criação do evento de outbox ocorrem na mesma transação. O `request_id` possui índice
único e o débito usa uma única query condicional —
`UPDATE "user" SET credits = credits - 1 WHERE id = ? AND credits > 0` — em vez de um
`SELECT` seguido de `UPDATE`. Duas requisições concorrentes com 1 crédito disponível nunca
debitam as duas, e replays concorrentes da mesma requisição convergem para o mesmo conteúdo.
Se qualquer etapa falhar, tudo sofre rollback.

**API e worker independentes.** A API só depende de PostgreSQL: ela confirma conteúdo,
crédito e `outbox_event` na mesma transação e responde sem importar ou conectar Redis,
BullMQ ou S3. Somente o dispatcher do worker lê a outbox e publica no Redis, usando
`request-id` como `jobId`. A API continua aceitando pedidos com o worker desligado, e o
worker processa eventos confirmados com a API desligada. Cada runtime valida apenas suas
próprias variáveis de ambiente e possui lifecycle separado.

A mesma transação também executa `pg_notify` no canal da outbox. O worker mantém uma
conexão PostgreSQL dedicada em `LISTEN` (`pg`, já que o Prisma Client não expõe
`LISTEN`/`NOTIFY`) e acorda o dispatcher imediatamente ao receber a notificação — sem a API
tocar em Redis, BullMQ ou S3 em nenhum momento. `NOTIFY` não é persistido pelo PostgreSQL,
então o polling padrão (`OUTBOX_POLL_INTERVAL_MS`, default `1000`) continua ativo como rede
de segurança para notificações perdidas (listener caído, reinício do worker); no caminho
saudável, o evento fica visível bem abaixo desse intervalo.

**Prioridade do cancelamento.** PostgreSQL registra `cancellation_requested_at` e
`terminal_at` com o relógio do próprio banco. Se o cancelamento começou antes da transição
terminal concorrente (`cancellation_requested_at <= terminal_at`), o resultado final é
`CANCELED`, mesmo que a escrita do worker tenha sido observada primeiro. Um cancelamento
iniciado depois de uma conclusão já confirmada continua sendo no-op. O worker nunca aceita
`CANCELED` como origem de `COMPLETED` ou `FAILED`.

Quando o cancelamento vence, a mesma transação cria
`CONTENT_CANCELLATION_REQUESTED` na outbox. O worker executa um job idempotente de cleanup
pela chave determinística; a API nunca acessa S3. Isso também remove um objeto que tenha sido
gravado por uma conclusão concorrente.

**Falhas simuladas da IA (~20%).** Tratadas via `attempts`/`backoff` do próprio BullMQ, não
com try/catch silencioso — um job que esgota as tentativas (`0.2³ ≈ 0.8%` de chance) vira
`FAILED` no banco através do listener `worker.on("failed", ...)`. Jobs falhos permanecem no
Redis com AOF; um reconciliador periódico tenta novamente a persistência terminal caso o
banco estivesse indisponível no listener, sem sobrescrever `CANCELED`. Isso soma dois
pollers de background no worker (dispatcher da outbox + reconciliador de `FAILED`) — mais
superfície do que o mínimo do enunciado pede, mas é o preço deliberado de nunca perder uma
transição terminal por uma falha transitória do banco.

**Camadas.** `routes → services → repositories`, em uma direção só. Services dependem de
interfaces em `application/ports` e de entidades em `domain`, ambos dentro de
`src/features/content-generation`, sem importar tipos do Prisma. Conexões,
workers e timers são criados por factories nos runtimes de bootstrap e possuem shutdown
explícito, permitindo testar o wiring sem abrir infraestrutura durante o import.

As imagens usadas no Compose estão fixadas por digest:

- PostgreSQL 16 Alpine:
  `sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777`;
- Redis 7 Alpine:
  `sha256:6ab0b6e7381779332f97b8ca76193e45b0756f38d4c0dcda72dbb3c32061ab99`;
- Minio:
  `sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e`;
- Minio Client:
  `sha256:a7fe349ef4bd8521fb8497f55c6042871b2ae640607cf99d9bede5e9bdf11727`.
