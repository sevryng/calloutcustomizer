/**
 * Lucide icon index: availability, tag search, and category grouping.
 *
 * The dataset is generated from `lucide-static` (see scripts/generate-icon-data.cjs).
 * Lucide publishes categories.json only in its GitHub repo, so the bundled
 * categories are derived from official tag metadata; a real categories.json can
 * be dropped into the plugin folder to override them.
 */

import { getIconIds, setIcon } from 'obsidian';
import { CUSTOM_ICON_PREFIX, type CategoryOverride, type CustomIcon } from '../types';
import {
	LUCIDE_ALL_NAMES,
	LUCIDE_CATEGORY_BLOB,
	LUCIDE_TAG_BLOB,
} from './icon-data';

const LUCIDE_PREFIX = 'lucide-';

/**
 * Above this many keys an override is assumed to be icon-keyed
 * (`{ icon: [categories] }`) rather than category-keyed. Lucide has ~1,750
 * icons and ~46 categories, so the gap is not close.
 */
const ICON_KEYED_THRESHOLD = 200;

/** Parses `key:value|key:value` blobs into a plain record. */
function splitBlob(blob: string): Record<string, string> {
	const parsed: Record<string, string> = {};

	for (const chunk of blob.split('|')) {
		const separator = chunk.indexOf(':');
		if (separator < 0) continue;
		parsed[chunk.slice(0, separator)] = chunk.slice(separator + 1);
	}

	return parsed;
}

export class IconIndex {
	ready = false;
	names: string[] = [];
	available: Set<string> = new Set();

	/** Custom icon token (`svg-<slug>`) -> sanitized SVG markup. */
	readonly customSvg = new Map<string, string>();

	private tags: Record<string, string> = {};
	private categories: Record<string, string[]> = {};
	private categorized: Set<string> = new Set();

	build(override?: CategoryOverride | null, customIcons: readonly CustomIcon[] = []): void {
		this.available = new Set(resolveAvailableNames());
		this.tags = splitBlob(LUCIDE_TAG_BLOB);

		this.customSvg.clear();
		for (const icon of customIcons) {
			const token = `${CUSTOM_ICON_PREFIX}${icon.slug}`;
			this.customSvg.set(token, icon.svg);
			this.available.add(token);
			this.tags[token] = icon.name.toLowerCase();
		}

		this.names = Array.from(this.available).sort();

		const grouped = override
			? normalizeOverride(override)
			: splitCategoryBlob(LUCIDE_CATEGORY_BLOB);

		this.categories = {};
		this.categorized = new Set();

		for (const category of Object.keys(grouped).sort()) {
			const icons = (grouped[category] ?? []).filter((icon) =>
				this.available.has(icon),
			);
			if (!icons.length) continue;

			this.categories[category] = icons;
			for (const icon of icons) this.categorized.add(icon);
		}

		if (this.customSvg.size) {
			this.categories['custom'] = Array.from(this.customSvg.keys()).sort();
			for (const token of this.customSvg.keys()) this.categorized.add(token);
		}

		const uncategorized = this.names.filter((name) => !this.categorized.has(name));
		if (uncategorized.length) this.categories['other'] = uncategorized;

		this.ready = true;
	}

	isCustom(name: string): boolean {
		return this.customSvg.has(name);
	}

	/**
	 * Draw an icon into an element, handling both Lucide names and custom SVG.
	 * Custom markup is parsed and adopted as nodes rather than assigned as
	 * HTML, so nothing user-supplied is ever treated as markup at runtime.
	 */
	renderInto(el: HTMLElement, name: string): void {
		el.empty();

		const svg = this.customSvg.get(name);
		if (!svg) {
			setIcon(el, `lucide-${name}`);
			return;
		}

		const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
		const root = parsed.documentElement;

		if (!root || parsed.querySelector('parsererror')) return;

		const node = el.ownerDocument.importNode(root, true);
		node.addClass('svg-icon');
		el.appendChild(node);
	}

	categoryNames(): string[] {
		return Object.keys(this.categories);
	}

	iconsInCategory(category: string): string[] {
		return this.categories[category] ?? [];
	}

	has(name: string): boolean {
		return this.available.has(name);
	}

	/**
	 * Ranked search over names and official Lucide tags:
	 * exact match, then prefix, then substring, then tag hits.
	 */
	search(query: string, category?: string): string[] {
		const pool = category ? this.iconsInCategory(category) : this.names;

		const needle = query.trim().toLowerCase().replace(/\s+/g, '-');
		if (!needle) return pool.slice();

		const spaced = needle.replace(/-/g, ' ');
		const exact: string[] = [];
		const prefixed: string[] = [];
		const contained: string[] = [];
		const tagged: string[] = [];

		for (const name of pool) {
			if (name === needle) {
				exact.push(name);
			} else if (name.startsWith(needle)) {
				prefixed.push(name);
			} else if (name.includes(needle)) {
				contained.push(name);
			} else {
				const tags = this.tags[name];
				if (tags && (tags.includes(spaced) || tags.includes(needle))) {
					tagged.push(name);
				}
			}
		}

		return [...exact, ...prefixed, ...contained, ...tagged];
	}

	prettyCategory(category: string): string {
		return category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}
}

/** Prefer what this Obsidian build actually ships; fall back to the bundle. */
function resolveAvailableNames(): string[] {
	const fromApp = getIconIds()
		.filter((id) => id.startsWith(LUCIDE_PREFIX))
		.map((id) => id.slice(LUCIDE_PREFIX.length));

	if (fromApp.length) return fromApp;

	return LUCIDE_ALL_NAMES ? LUCIDE_ALL_NAMES.split(' ') : [];
}

function splitCategoryBlob(blob: string): Record<string, string[]> {
	const grouped: Record<string, string[]> = {};

	for (const [category, icons] of Object.entries(splitBlob(blob))) {
		grouped[category] = icons.split(' ');
	}

	return grouped;
}

/**
 * Accepts both `{ icon: [categories] }` (the official shape) and
 * `{ category: [icons] }`, normalizing to the latter.
 */
function normalizeOverride(override: CategoryOverride): Record<string, string[]> {
	const entries = Object.entries(override);
	const grouped: Record<string, string[]> = {};

	if (entries.length <= ICON_KEYED_THRESHOLD) {
		for (const [category, icons] of entries) grouped[category] = icons.slice();
		return grouped;
	}

	for (const [icon, categories] of entries) {
		for (const category of categories) {
			(grouped[category] ??= []).push(icon);
		}
	}

	return grouped;
}
