/**
 * A simple seeded pseudo-random number generator (PRNG)
 * using the mulberry32 algorithm.
 */
export class PRNG {
  private state: number;

  constructor(seed: string | number) {
    if (typeof seed === 'string') {
      this.state = this.hashString(seed);
    } else {
      this.state = seed;
    }
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }

  public next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  public pick<T>(array: T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }
}
