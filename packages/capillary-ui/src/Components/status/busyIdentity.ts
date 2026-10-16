/** Stable presentation identity for arbitrary selection keys, without serialization. */
export class BusyIdentity {
    private keys: readonly unknown[] = []
    private token: object = {}

    for(keys: Iterable<unknown>): object {
        const next = [...keys]
        if (next.length !== this.keys.length || next.some((key, index) => !Object.is(key, this.keys[index]))) {
            this.keys = next
            this.token = {}
        }
        return this.token
    }
}
