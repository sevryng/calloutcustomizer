/**
 * Dynamic stylesheet.
 *
 * Obsidian resolves `--callout-icon` when it draws a callout, so every icon
 * rule has to exist before a note renders - hence one rule per available icon,
 * written once at load. Colours are the opposite case: `--callout-color` is
 * consumed by `var()` at paint time, so a rule added later applies to callouts
 * that are already on screen. Those are therefore generated on demand and
 * remembered in settings so they exist on the next start.
 */

import type { IconIndex } from './icons';
import { hexToCssColor, normalizeHex } from './colors';
import { svgToCssValue } from './svg';

const STYLE_EL_ID = 'callout-customizer-styles';

export class StyleManager {
	private styleEl: HTMLStyleElement | null = null;
	private baseRules = '';
	private colorRules = new Map<string, string>();

	/** Called when a colour is seen that had no rule yet. */
	onNewColor: ((hex: string) => void) | null = null;

	/**
	 * @param icons  index used to enumerate icon rules
	 * @param knownColors colours persisted from a previous session
	 */
	load(icons: IconIndex, knownColors: readonly string[]): void {
		const existing = activeDocument.getElementById(STYLE_EL_ID);
		if (existing) existing.remove();

		const styleEl = activeDocument.createElement('style');
		styleEl.id = STYLE_EL_ID;
		activeDocument.head.appendChild(styleEl);
		this.styleEl = styleEl;

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
		this.styleEl?.remove();
		this.styleEl = null;
		this.colorRules.clear();
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
		if (!this.styleEl) return;
		this.styleEl.setText(
			[this.baseRules, ...this.colorRules.values()].join('\n'),
		);
	}
}
