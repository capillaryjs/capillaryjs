export function byId<T extends { id: string }>(rows: readonly T[]): Map<T["id"], T> {
  return new Map(rows.map(row => [row.id, row]));
}
export function groupBy<T, K>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const group = groups.get(k);
    if (group) group.push(row); else groups.set(k, [row]);
  }
  return groups;
}
export function sum<T>(rows: readonly T[], value: (row: T) => number): number {
  return rows.reduce((total, row) => total + value(row), 0);
}
export function round(value: number, places = 4): number { return Number(value.toFixed(places)); }
export function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
