export class FakeQueue {
  jobs: { name: string; data: unknown }[] = [];

  async add(name: string, data: unknown): Promise<void> {
    this.jobs.push({ name, data });
  }
}
