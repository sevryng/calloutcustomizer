/**
 * Dynamic stylesheet.
 *
 * Obsidian resolves `--callout-icon` when it draws a callout, so every icon
 * rule has to exist before a note renders - hence one rule per available icon,
 * written once at load. Colours are the opposite case: `--callout-color` is
 * consumed by `var()` at paint time, so a rule added later applies to callouts
 * that are already on screen. Those are therefore generated on demand and
 * remembered in settings so they exist on the next start.
 *
 * These rules cannot live in styles.css: they depend on which icons the running
 * Obsidian build ships and on colours the user picks at runtime. A constructable
 * stylesheet is used rather than an injected <style> element, which plugin
 * guidelines disallow.
 */

import type { IconIndex } from './icons';
import { hexToCssColor, normalizeHex } from './colors';
import { svgToCssValue } from './svg';

export class StyleManager {
	private sheet: CSSStyleSheet | null = null;
	private baseRules = '';
	private colorRules = new Map<string, string>();

	/** Called when a colour is seen that had no rule yet. */
	onNewColor: ((hex: string) => void) | null = null;

	/**
	 * @param icons  index used to enumerate icon rules
	 * @param knownColors colours persisted from a previous session
	 */
	load(icons: IconIndex, knownColors: readonly string[]): void {
		this.detach();

		this.sheet = new CSSStyleSheet();
		activeDocument.adoptedStyleSheets = [
			...activeDocument.adoptedStyleSheets,
			this.sheet,
		];

		this.baseRules = icons.names
			.map((name) => {
				const svg = icons.customSvg.get(name);
				const value = svg ? svgToCssValue(svg) : `lucide-${name}`;
				return `.callout[data-callout-metadata~="i:${name}"]{--callout-icon:${value};}`;
			})
			.join('\n');

		this.colorRules.clear();
		for (const hex of knownColors) this.registerColor(hex, true);

		this.flush();
	}

	unload(): void {
		this.detach();
		this.colorRules.clear();
	}

	private detach(): void {
		if (!this.sheet) return;

		const sheet = this.sheet;
		activeDocument.adoptedStyleSheets = activeDocument.adoptedStyleSheets.filter(
			(candidate) => candidate !== sheet,
		);
		this.sheet = null;
	}

	/**
	 * Ensure a CSS rule exists for a colour.
	 * @returns true when a new rule was added.
	 */
	registerColor(hex: string, deferFlush = false): boolean {
		const normalized = normalizeHex(hex);
		if (!normalized || this.colorRules.has(normalized)) return false;

		this.colorRules.set(
			normalized,
			`.callout[data-callout-metadata~="c:${normalized}"]{--callout-color:${hexToCssColor(normalized)};}`,
		);

		if (!deferFlush) {
			this.flush();
			this.onNewColor?.(normalized);
		}

		return true;
	}

	private flush(): void {
		if (!this.sheet) return;
		this.sheet.replaceSync(
			[this.baseRules, ...this.colorRules.values()].join('\n'),
		);
	}
}
