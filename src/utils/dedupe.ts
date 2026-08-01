/** Drop duplicate `id`s from a persisted array, keeping the last occurrence. */
export function dedupeById<T extends { id: string }>(items: readonly T[]): T[] {
	const byId = new Map<string, T>();
	for (const item of items) byId.set(item.id, item);
	return Array.from(byId.values());
}
