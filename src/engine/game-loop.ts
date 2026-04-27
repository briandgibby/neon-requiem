export type TickHandler = (tick: number) => void | Promise<void>;

export class GameLoop {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private tickCount = 0;
  private running = false;

  constructor(
    private readonly intervalMs: number,
    private readonly onTick: TickHandler
  ) {}

  start(): void {
    if (this.running) throw new Error('GameLoop is already running');
    this.running = true;
    void this.scheduleTick();
  }

  private async scheduleTick(): Promise<void> {
    if (!this.running) return;

    const startTime = Date.now();
    this.tickCount++;
    
    try {
      await this.onTick(this.tickCount);
    } catch (err) {
      // In a real app, we might want to log this to an external service
      console.error(`Error in GameLoop tick ${this.tickCount}:`, err);
    }

    if (!this.running) return;

    const endTime = Date.now();
    const elapsed = endTime - startTime;
    const nextDelay = Math.max(0, this.intervalMs - elapsed);

    this.timeoutId = setTimeout(() => {
      void this.scheduleTick();
    }, nextDelay);
  }

  stop(): void {
    this.running = false;
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  get isRunning(): boolean {
    return this.running;
  }

  get ticks(): number {
    return this.tickCount;
  }
}
