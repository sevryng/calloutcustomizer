/**
 * SVG sanitizing and CSS embedding.
 *
 * Obsidian accepts a raw SVG element as a callout icon:
 *
 *     --callout-icon: '<svg>...</svg>';
 *
 * That markup is injected into the document, so anything a user pastes is
 * treated as untrusted: only a known-safe subset of shape elements and
 * attributes survives, and scripts, event handlers, and external references
 * are dropped entirely.
 *
 * @see https://help.obsidian.md/callouts#Customize+callouts
 */

const ALLOWED_TAGS = new Set([
	'svg', 'g', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
	'rect', 'defs', 'lineargradient', 'radialgradient', 'stop', 'title', 'desc',
	'clippath', 'mask', 'symbol', 'text', 'tspan',
]);

const ALLOWED_ATTRS = new Set([
	'viewbox', 'xmlns', 'width', 'height', 'fill', 'stroke', 'stroke-width',
	'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset',
	'stroke-opacity', 'fill-opacity', 'fill-rule', 'clip-rule', 'opacity',
	'd', 'points', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
	'transform', 'offset', 'stop-color', 'stop-opacity', 'gradientunits',
	'clip-path', 'mask', 'id', 'class', 'font-size', 'font-family', 'text-anchor',
	'preserveaspectratio',
]);

/** Attribute values referencing anything outside the element itself. */
const EXTERNAL_REF = /^\s*(?:https?:|\/\/|data:|javascript:)/i;

const MAX_LENGTH = 32_000;

export class SvgError extends Error {}

export interface SanitizeOptions {
	/**
	 * Rewrite concrete fill/stroke colours to `currentColor` so the icon takes
	 * the callout's colour. Without this, an icon exported with a hardcoded
	 * black fill is invisible on a dark theme - which looks exactly like the
	 * icon failing to load.
	 */
	recolor?: boolean;
}

/**
 * Parse, validate, and strip an SVG down to a safe subset.
 * @throws SvgError with a human-readable reason when the input is unusable.
 */
export function sanitizeSvg(input: string, options: SanitizeOptions = {}): string {
	const { recolor = true } = options;

	const source = extractSvgElement(input);
	const root = parseSvg(source);

	scrub(root, recolor);

	// Obsidian sizes the icon; fixed dimensions fight it.
	root.removeAttribute('width');
	root.removeAttribute('height');
	if (!root.getAttribute('viewBox')) root.setAttribute('viewBox', '0 0 24 24');
	root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

	if (recolor && !root.getAttribute('fill') && !root.getAttribute('stroke')) {
		root.setAttribute('fill', 'currentColor');
	}

	const collapsed = new XMLSerializer()
		.serializeToString(root)
		.replace(/\s+/g, ' ')
		.trim();

	if (collapsed.length > MAX_LENGTH) {
		throw new SvgError(
			`That SVG is ${Math.round(collapsed.length / 1000)}kB after cleanup, over the ${MAX_LENGTH / 1000}kB limit. Try a simpler icon.`,
		);
	}

	return collapsed;
}

/**
 * Pull the `<svg>` element out of whatever was pasted.
 *
 * Real files and real copy-pastes routinely arrive wrapped in a BOM, an XML
 * declaration, a DOCTYPE, or editor comments. Requiring the string to start
 * with `<svg` rejects most `.svg` files on disk.
 */
function extractSvgElement(input: string): string {
	// \uFEFF is a byte-order mark. Written as an escape: a literal BOM here is
	// invisible in an editor and ESLint rejects it as irregular whitespace.
	const text = input.replace(/^\uFEFF/, '').trim();
	if (!text) throw new SvgError('Nothing to import - paste some SVG markup first.');

	const start = text.search(/<svg[\s>]/i);
	if (start < 0) {
		throw new SvgError('No <svg> element found in what you pasted.');
	}

	const end = text.toLowerCase().lastIndexOf('</svg>');
	if (end < 0) {
		throw new SvgError('The <svg> element is never closed - the paste looks truncated.');
	}

	return text
		.slice(start, end + '</svg>'.length)
		// Undeclared xlink: prefixes are a hard XML parse error, and every
		// xlink attribute is stripped later anyway.
		.replace(/\sxlink:[\w-]+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
}

/** Strict XML first, then lenient HTML, so sloppy markup still works. */
function parseSvg(source: string): Element {
	const xml = new DOMParser().parseFromString(source, 'image/svg+xml');
	const xmlError = xml.querySelector('parsererror');

	if (!xmlError) {
		const root = xml.documentElement;
		if (root && root.tagName.toLowerCase() === 'svg') return root;
	}

	const html = new DOMParser().parseFromString(source, 'text/html');
	const fallback = html.querySelector('svg');
	if (fallback) return fallback;

	throw new SvgError(
		xmlError?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 200) ??
			'That SVG could not be parsed.',
	);
}

function scrub(element: Element, recolor: boolean): void {
	for (const child of Array.from(element.children)) {
		if (!ALLOWED_TAGS.has(child.tagName.toLowerCase())) {
			child.remove();
			continue;
		}
		scrub(child, recolor);
	}

	for (const attr of Array.from(element.attributes)) {
		const name = attr.name.toLowerCase();

		if (
			name.startsWith('on') ||
			name.startsWith('xlink:') ||
			name.startsWith('xmlns:') ||
			name === 'href' ||
			name === 'style'
		) {
			element.removeAttribute(attr.name);
			continue;
		}

		if (!ALLOWED_ATTRS.has(name)) {
			element.removeAttribute(attr.name);
			continue;
		}

		if (EXTERNAL_REF.test(attr.value)) {
			element.removeAttribute(attr.name);
			continue;
		}

		if (recolor && (name === 'fill' || name === 'stroke')) {
			const value = attr.value.trim().toLowerCase();
			if (value && value !== 'none' && value !== 'currentcolor') {
				element.setAttribute(attr.name, 'currentColor');
			}
		}
	}
}

/**
 * Wrap sanitized SVG as a CSS string value for `--callout-icon`.
 * Backslashes and single quotes are escaped so the declaration cannot be
 * broken out of.
 */
export function svgToCssValue(svg: string): string {
	const escaped = svg.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
	return `'${escaped}'`;
}

/** Turn a display name into a CSS- and metadata-safe slug. */
export function slugify(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);
}
