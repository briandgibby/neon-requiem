export interface Tickable {
  /** Unique identifier for the subscriber */
  readonly name: string;
  /** How many heartbeat ticks to wait between executions (1 = every tick) */
  readonly frequency: number;
  /** The logic to execute */
  onTick(tickCount: number): Promise<void>;
}

export type HeartbeatErrorHandler = (error: unknown, subscriber: Tickable) => void;

export class Heartbeat {
  private subscribers: Tickable[] = [];
  private tickCount = 0;
  private running = false;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private errorHandler: HeartbeatErrorHandler;

  constructor(
    private readonly intervalMs: number,
    errorHandler?: HeartbeatErrorHandler
  ) {
    this.errorHandler = errorHandler || ((err, sub) => {
      console.error(`[Heartbeat] Error in subscriber "${sub.name}":`, err);
    });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.scheduleTick();
  }

  stop(): void {
    this.running = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  subscribe(tickable: Tickable): void {
    if (this.subscribers.some(s => s.name === tickable.name)) {
      throw new Error(`Subscriber with name "${tickable.name}" already exists`);
    }
    this.subscribers.push(tickable);
  }

  unsubscribe(name: string): void {
    this.subscribers = this.subscribers.filter(s => s.name !== name);
  }

  private async scheduleTick(): Promise<void> {
    if (!this.running) return;

    const startTime = Date.now();
    this.tickCount++;

    // Execute relevant subscribers
    const tasks = this.subscribers
      .filter(s => this.tickCount % s.frequency === 0)
      .map(async (s) => {
        try {
          await s.onTick(this.tickCount);
        } catch (err) {
          this.errorHandler(err, s);
        }
      });

    await Promise.allSettled(tasks);

    if (!this.running) return;

    const endTime = Date.now();
    const elapsed = endTime - startTime;
    const nextDelay = Math.max(0, this.intervalMs - elapsed);

    this.timeoutId = setTimeout(() => {
      void this.scheduleTick();
    }, nextDelay);
  }

  get ticks(): number {
    return this.tickCount;
  }

  get isRunning(): boolean {
    return this.running;
  }
}
