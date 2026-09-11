/** Mulberry32: one explicitly seeded stream; no time, UUIDs or platform randomness. */
export class Random {
    private state: number;

    constructor(seed: number) {
        this.state = seed >>> 0;
    }

    float(): number {
        let t = this.state = (this.state + 0x6d2b79f5) >>> 0;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    int(min: number, max: number): number {
        return min + Math.floor(this.float() * (max - min + 1));
    }

    chance(probability: number): boolean {
        return this.float() < probability;
    }

    pick<T>(values: readonly T[]): T {
        if (!values.length) throw new Error("Cannot choose from an empty collection");
        return values[this.int(0, values.length - 1)]!;
    }

    normal(mean: number, deviation: number): number {
        return mean + deviation * Math.sqrt(-2 * Math.log(1 - this.float())) * Math.cos(2 * Math.PI * this.float());
    }

    shuffle<T>(values: readonly T[]): T[] {
        const result = [...values];
        for (let i = result.length - 1; i > 0; i--) {
            const j = this.int(0, i);
            [result[i], result[j]] = [result[j]!, result[i]!];
        }
        return result;
    }
}
