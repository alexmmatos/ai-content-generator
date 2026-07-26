function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function simulateAiCall(topic: string): Promise<string> {
  await sleep(5000);
  if (Math.random() < 0.2) throw new Error("Simulated AI failure");
  return `Conteúdo gerado sobre "${topic}".\n\nEste é um texto fictício produzido pela IA simulada para fins do desafio técnico.`;
}
