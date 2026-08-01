/**
 * Colour helpers.
 *
 * Colours are stored in the note as a bare 6-digit hex and emitted to CSS as
 * the `R, G, B` triplet that Obsidian's `--callout-color` expects.
 */

/** Theme colour variables used for the swatch row, with hard fallbacks. */
export const SWATCHES: ReadonlyArray<readonly [string, string]> = [
	['--color-red', '#e93147'],
	['--color-orange', '#ec7500'],
	['--color-yellow', '#e0ac00'],
	['--color-green', '#08b94e'],
	['--color-cyan', '#00bfbc'],
	['--color-blue', '#086ddd'],
	['--color-purple', '#7852ee'],
	['--color-pink', '#d53984'],
	['--color-gray', '#7e7e7e'],
];

/**
 * Normalize any hex-ish input to a bare lowercase 6-digit hex.
 * Returns '' for anything unparseable, which callers read as "no colour".
 */
export function normalizeHex(value: string | null | undefined): string {
	if (!value) return '';

	const trimmed = String(value).trim().replace(/^#/, '').toLowerCase();

	const short = /^([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(trimmed);
	if (short) {
		const [, r = '', g = '', b = ''] = short;
		return r + r + g + g + b + b;
	}

	return /^[0-9a-f]{6}$/.test(trimmed) ? trimmed : '';
}

/**
 * `e07b39` -> `#e07b39`, the form `--callout-color` expects.
 *
 * Obsidian once wanted a bare `R, G, B` triplet here, because its own CSS did
 * `rgba(var(--callout-color), 0.1)`. Current Obsidian takes any valid CSS
 * colour instead, so a triplet is silently ignored - which looks exactly like
 * "colours don't work while icons do". Returns '' if the hex is invalid.
 *
 * @see https://help.obsidian.md/callouts#Customize+callouts
 */
export function hexToCssColor(hex: string): string {
	const normalized = normalizeHex(hex);
	return normalized ? `#${normalized}` : '';
}

/** `e07b39` -> `224, 123, 57`. Kept for the legacy triplet fallback. */
export function hexToRgbTriplet(hex: string): string {
	const normalized = normalizeHex(hex);
	if (!normalized) return '';

	return [
		parseInt(normalized.slice(0, 2), 16),
		parseInt(normalized.slice(2, 4), 16),
		parseInt(normalized.slice(4, 6), 16),
	].join(', ');
}

/** Accepts `#rgb`, `#rrggbb`, `rgb(r g b)` or a bare `r, g, b` triplet. */
export function cssColorToHex(value: string): string {
	const raw = String(value ?? '').trim();
	if (!raw) return '';

	const direct = normalizeHex(raw);
	if (direct) return direct;

	const parts = /(-?[\d.]+)[,\s]+(-?[\d.]+)[,\s]+(-?[\d.]+)/.exec(raw);
	if (!parts) return '';

	const [, r = '0', g = '0', b = '0'] = parts;

	const toByte = (n: string): string =>
		Math.max(0, Math.min(255, Math.round(parseFloat(n))))
			.toString(16)
			.padStart(2, '0');

	return toByte(r) + toByte(g) + toByte(b);
}

/**
 * Read a theme colour variable so swatches match the active theme.
 * Falls back to the bundled default when the variable is missing.
 */
export function resolveSwatch(varName: string, fallback: string): string {
	const raw = getComputedStyle(activeDocument.body).getPropertyValue(varName);
	const hex = cssColorToHex(raw);
	return hex || normalizeHex(fallback);
}
