/**
 * Locating callouts in an editor and writing changes back.
 *
 * Shared by the context menu and the commands so both agree on what "the
 * callout you mean" is.
 */

import type { Editor } from 'obsidian';
import type CalloutCustomizer from './main';
import type { CalloutState, LocatedCallout } from './types';
import {
	isBlockquoteLine,
	parseCalloutLine,
	serializeCalloutLine,
} from './utils/callout';

/** How far up from the cursor to look for the owning callout header. */
const MAX_LOOKBACK_LINES = 400;

/** A right-click is only matched to a callout for this long. */
const CLICK_FRESHNESS_MS = 2000;

interface ClickContext {
	x: number;
	y: number;
	target: EventTarget | null;
	at: number;
}

/** The CodeMirror surface we need, without depending on @codemirror/view. */
interface EditorViewLike {
	posAtDOM?: (node: Node) => number;
	posAtCoords?: (coords: { x: number; y: number }) => number | null;
}

export class CalloutService {
	private lastClick: ClickContext | null = null;

	constructor(private readonly plugin: CalloutCustomizer) {}

	recordClick(evt: MouseEvent): void {
		this.lastClick = {
			x: evt.clientX,
			y: evt.clientY,
			target: evt.target,
			at: Date.now(),
		};
	}

	/**
	 * Resolve the callout the user just right-clicked, falling back to the one
	 * containing the cursor. In Live Preview the cursor often is not inside the
	 * rendered callout that was clicked, so the click position wins when fresh.
	 */
	findAtClick(editor: Editor): LocatedCallout | null {
		const click = this.lastClick;

		if (click && Date.now() - click.at < CLICK_FRESHNESS_MS) {
			const line = this.lineFromClick(editor, click);
			if (line !== null) {
				const found = this.findAtLine(editor, line);
				if (found) return found;
			}
		}

		return this.findAtCursor(editor);
	}

	findAtCursor(editor: Editor): LocatedCallout | null {
		return this.findAtLine(editor, editor.getCursor().line);
	}

	/** Walk up from `line` to the callout header that owns it. */
	findAtLine(editor: Editor, line: number): LocatedCallout | null {
		if (line < 0 || line >= editor.lineCount()) return null;

		const floor = Math.max(0, line - MAX_LOOKBACK_LINES);

		for (let i = line; i >= floor; i--) {
			const text = editor.getLine(i);

			const state = parseCalloutLine(text);
			if (state) return { line: i, state };

			if (!isBlockquoteLine(text)) return null;
		}

		return null;
	}

	/** Write a modified state back to the note, registering any new styling. */
	apply(editor: Editor, line: number, state: CalloutState): void {
		if (state.color) this.plugin.styles.registerColor(state.color);
		if (state.icon) void this.plugin.rememberIcon(state.icon);

		editor.setLine(line, serializeCalloutLine(state));
	}

	private lineFromClick(editor: Editor, click: ClickContext): number | null {
		const view = (editor as Editor & { cm?: EditorViewLike }).cm;
		if (!view) return null;

		const target = click.target;
		if (target instanceof HTMLElement && view.posAtDOM) {
			const callout = target.closest('.callout');
			if (callout) {
				return editor.offsetToPos(view.posAtDOM(callout)).line;
			}
		}

		if (view.posAtCoords) {
			const pos = view.posAtCoords({ x: click.x, y: click.y });
			if (pos !== null && pos !== undefined) {
				return editor.offsetToPos(pos).line;
			}
		}

		return null;
	}
}
