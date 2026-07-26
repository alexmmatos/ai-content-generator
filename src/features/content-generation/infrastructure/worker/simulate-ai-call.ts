export function createAiSimulator(options: {
  delayMs?: number;
  failureRate?: number;
  random?: () => number;
} = {}): (topic: string) => Promise<string> {
  const delayMs = options.delayMs ?? 5000;
  const failureRate = options.failureRate ?? 0.2;
  const random = options.random ?? (() => Math.random());

  return async (topic: string): Promise<string> => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (random() < failureRate) throw new Error("Simulated AI failure");
    return `Conteúdo gerado sobre "${topic}".\n\nEste é um texto fictício produzido pela IA simulada para fins do desafio técnico.`;
  };
}
