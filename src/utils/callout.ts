/**
 * Parsing and serializing of callout header lines.
 *
 * Round-tripping is lossless: any metadata token this plugin does not own is
 * preserved verbatim, so theme metadata such as `> [!note|left]` keeps working.
 */

import type { CalloutState, FoldState } from '../types';
import { normalizeHex } from './colors';

export const KEY_ICON = 'i';
export const KEY_COLOR = 'c';

//                       indent  > markers      [! type     | metadata  ] fold  title
export const CALLOUT_RE =
	/^(\s{0,3}(?:>\s?)+)\[!([^\]|\n]+?)(?:\|([^\]\n]*))?\]([+-]?)(.*)$/;

export const BUILTIN_TYPES: readonly string[] = [
	'note', 'abstract', 'summary', 'tldr', 'info', 'todo', 'tip', 'hint',
	'important', 'success', 'check', 'done', 'question', 'help', 'faq',
	'warning', 'caution', 'attention', 'failure', 'fail', 'missing', 'danger',
	'error', 'bug', 'example', 'quote', 'cite',
];

/** Obsidian's built-in icon per callout type, used for the modal preview. */
const DEFAULT_ICONS: Record<string, string> = {
	note: 'pencil',
	abstract: 'clipboard-list',
	summary: 'clipboard-list',
	tldr: 'clipboard-list',
	info: 'info',
	todo: 'circle-check',
	tip: 'flame',
	hint: 'flame',
	important: 'flame',
	success: 'check',
	check: 'check',
	done: 'check',
	question: 'help-circle',
	help: 'help-circle',
	faq: 'help-circle',
	warning: 'alert-triangle',
	caution: 'alert-triangle',
	attention: 'alert-triangle',
	failure: 'x',
	fail: 'x',
	missing: 'x',
	danger: 'zap',
	error: 'zap',
	bug: 'bug',
	example: 'list',
	quote: 'quote',
	cite: 'quote',
};

export function defaultIconFor(type: string): string {
	return DEFAULT_ICONS[String(type).toLowerCase()] ?? 'pencil';
}

export interface ParsedMeta {
	icon: string;
	color: string;
	extra: string[];
}

export function parseMeta(raw: string): ParsedMeta {
	const parsed: ParsedMeta = { icon: '', color: '', extra: [] };

	for (const token of String(raw ?? '').split(/\s+/)) {
		if (!token) continue;

		if (token.startsWith(`${KEY_ICON}:`)) {
			parsed.icon = token.slice(KEY_ICON.length + 1).trim();
		} else if (token.startsWith(`${KEY_COLOR}:`)) {
			parsed.color = normalizeHex(token.slice(KEY_COLOR.length + 1));
		} else {
			parsed.extra.push(token);
		}
	}

	return parsed;
}

export function buildMeta(
	state: Pick<CalloutState, 'icon' | 'color' | 'extraMeta'>,
): string {
	const parts: string[] = [];

	if (state.icon) parts.push(`${KEY_ICON}:${state.icon}`);
	if (state.color) parts.push(`${KEY_COLOR}:${normalizeHex(state.color)}`);
	for (const extra of state.extraMeta) parts.push(extra);

	return parts.join(' ');
}

export function parseCalloutLine(line: string): CalloutState | null {
	const match = CALLOUT_RE.exec(line);
	if (!match) return null;

	const [, prefix = '', type = '', metaRaw = '', fold = '', rest = ''] = match;
	const meta = parseMeta(metaRaw);

	return {
		prefix,
		type: type.trim(),
		icon: meta.icon,
		color: meta.color,
		extraMeta: meta.extra,
		fold: fold as FoldState,
		title: rest.trim(),
	};
}

export function serializeCalloutLine(state: CalloutState): string {
	const meta = buildMeta(state);
	const title = state.title.trim();

	return (
		state.prefix +
		`[!${state.type}${meta ? `|${meta}` : ''}]` +
		state.fold +
		(title ? ` ${title}` : '')
	);
}

/** True when the line could be part of a callout body (a blockquote line). */
export function isBlockquoteLine(line: string): boolean {
	return /^\s{0,3}>/.test(line);
}
