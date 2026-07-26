import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi, { type FastifySwaggerUiConfigOptions } from "@fastify/swagger-ui";
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { createContentRoutes } from "./features/content-generation/api/content.routes.js";
import type { AppDependencies } from "./app-dependencies.type.js";
import type { BuildAppOptions } from "./build-app-options.interface.js";
import { InsufficientCreditsError } from "./features/content-generation/domain/errors/insufficient-credits.error.js";
import { ContentNotFoundError } from "./features/content-generation/domain/errors/content-not-found.error.js";
import { UserNotFoundError } from "./features/content-generation/domain/errors/user-not-found.error.js";
import { RequestIdConflictError } from "./features/content-generation/domain/errors/request-id-conflict.error.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const API_DESCRIPTION = `
Gera conteúdo com IA de forma assíncrona: \`POST /generate\` debita 1 crédito e enfileira um
job; um worker em background simula a chamada de IA (~5s, ~20% de chance de falha por
tentativa) e faz upload do resultado em S3/Minio; o cliente acompanha o progresso consultando
\`GET /:id\` pelo \`contentId\` retornado.

**Fluxo de status:** \`PENDING\` → \`PROCESSING\` → \`COMPLETED\` (com URL do resultado) ou
\`FAILED\` (após 3 tentativas). \`POST /:id/cancel\` pode interromper esse fluxo a qualquer
momento antes da conclusão — o cancelamento vence uma conclusão concorrente do worker se foi
solicitado primeiro.

**Idempotência:** envie um UUID no header \`request-id\` em \`POST /generate\`; repetir a
mesma requisição com o mesmo payload não debita outro crédito e retorna o mesmo
\`contentId\`. Ao clicar em "Try it out" aqui no Swagger, um \`request-id\` é preenchido
automaticamente se você deixar o campo em branco.

**Usuários de teste (seed):**
- Com crédito: \`297c69ca-df7a-4062-b5ce-957df31dfb82\` (10 créditos — caminho feliz)
- Sem crédito: \`b485e014-75b7-47c7-a84a-14da3fcfaa8e\` (0 créditos — testa o 402)
`.trim();

const CONTENT_TAG = "Content";

export function buildApp(
  deps: AppDependencies,
  options: BuildAppOptions = {}
): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? true,
    requestIdHeader: false,
    genReqId(rawRequest) {
      const received = rawRequest.headers["request-id"];
      return typeof received === "string" && UUID_PATTERN.test(received)
        ? received
        : randomUUID();
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.addHook("onSend", async (request, reply) => {
    reply.header("request-id", request.id);
  });

  app.register(swagger, {
    openapi: {
      info: {
        title: "AI Content Generator API",
        version: "1.0.0",
        description: API_DESCRIPTION,
      },
      tags: [
        {
          name: CONTENT_TAG,
          description: "Geração, consulta e cancelamento de conteúdo gerado por IA.",
        },
      ],
    },
    transform: jsonSchemaTransform,
  });
  app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      // swagger-ui-dist passes a plain object here at runtime, not a Fetch API Request
      // (the upstream .d.ts is inaccurate) — typed to match what actually reaches the browser.
      requestInterceptor: ((req: { headers: Record<string, string> }) => {
        if (!req.headers["request-id"]) {
          req.headers["request-id"] = crypto.randomUUID();
        }
        return req;
      }) as unknown as FastifySwaggerUiConfigOptions["requestInterceptor"],
    },
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.register(createContentRoutes(deps), { prefix: "/api/content" });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof InsufficientCreditsError) {
      return reply.code(402).send({ error: "Insufficient credits" });
    }
    if (error instanceof ContentNotFoundError) {
      return reply.code(404).send({ error: "Content not found" });
    }
    if (error instanceof UserNotFoundError) {
      return reply.code(404).send({ error: "User not found" });
    }
    if (error instanceof RequestIdConflictError) {
      return reply
        .code(409)
        .send({ error: "Request ID already used with a different payload" });
    }
    if (error.code === "FST_ERR_VALIDATION") {
      return reply.code(400).send({ error: "Validation error", details: error.message });
    }

    request.log.error(error);
    return reply.code(500).send({ error: "Internal Server Error" });
  });

  return app;
}
