import { z } from "zod";

export const ContentIdParamSchema = z.object({
  id: z.string().uuid(),
});
