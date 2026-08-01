/**
 * Shared types.
 *
 * Customization is stored as ordinary Obsidian callout metadata:
 *
 *     > [!note|i:star c:e07b39]- My title
 *
 * `i:` is a Lucide icon name, `c:` a bare 6-digit hex colour. Tokens are
 * space-separated so generated CSS can target them with `~=`, which matches
 * whole tokens and so never confuses `i:star` with `i:starship`.
 */

/** '' = not collapsible, '+' = collapsible and open, '-' = collapsed. */
export type FoldState = '' | '+' | '-';

export type GridSize = 'small' | 'medium' | 'large';

export interface CalloutState {
	/** Indent and blockquote markers, e.g. `> ` or `> > `. */
	prefix: string;
	type: string;
	/** Lucide icon name without the `lucide-` prefix. '' means type default. */
	icon: string;
	/** Bare 6-digit lowercase hex, no leading `#`. '' means type default. */
	color: string;
	/** Metadata tokens this plugin does not own, preserved verbatim. */
	extraMeta: string[];
	fold: FoldState;
	title: string;
}

/** A callout header located in an open editor. */
export interface LocatedCallout {
	line: number;
	state: CalloutState;
}

/** Either shape of an external Lucide categories.json is accepted. */
export type CategoryOverride = Record<string, string[]>;

/** A user-supplied SVG, usable anywhere a Lucide name is. */
export interface CustomIcon {
	/** CSS-safe identifier, referenced in metadata as `i:svg-<slug>`. */
	slug: string;
	name: string;
	/** Sanitized SVG markup. */
	svg: string;
}

/** A saved look, applied inline to a single callout. */
export interface CalloutPreset {
	id: string;
	name: string;
	icon: string;
	color: string;
}

/** A saved look promoted to a real callout type via a CSS snippet. */
export interface CustomCalloutType {
	/** The `[!id]` identifier. Lowercase, CSS-safe. */
	id: string;
	name: string;
	icon: string;
	color: string;
}

/** Prefix marking a metadata icon token as a custom SVG rather than Lucide. */
export const CUSTOM_ICON_PREFIX = 'svg-';
