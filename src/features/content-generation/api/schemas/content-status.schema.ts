import { z } from "zod";
import { CONTENT_STATUSES } from "../../domain/content-statuses.js";

export const ContentStatusSchema = z
  .enum(CONTENT_STATUSES)
  .describe(
    "PENDING: aguardando o worker. PROCESSING: IA em execução. COMPLETED: concluído, " +
      "`resultUrl` disponível. CANCELED: cancelado pelo cliente. FAILED: esgotou as 3 " +
      "tentativas."
  );
