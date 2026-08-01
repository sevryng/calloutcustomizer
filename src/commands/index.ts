/**
 * Command registration. IDs are stable API - do not rename them.
 */

import { Notice } from 'obsidian';
import type { Editor } from 'obsidian';
import type CalloutCustomizer from '../main';
import type { FoldState } from '../types';

const FOLD_CYCLE: readonly FoldState[] = ['', '+', '-'];

const NOT_IN_CALLOUT = 'Cursor is not inside a callout.';

export function registerCommands(plugin: CalloutCustomizer): void {
	plugin.addCommand({
		id: 'customize-callout-at-cursor',
		name: 'Customize callout at cursor',
		editorCallback: (editor: Editor) => {
			const found = plugin.calloutService.findAtCursor(editor);
			if (!found) {
				new Notice(NOT_IN_CALLOUT);
				return;
			}
			plugin.openCustomizer(editor, found);
		},
	});

	plugin.addCommand({
		id: 'cycle-callout-fold',
		name: 'Cycle callout fold state',
		editorCallback: (editor: Editor) => {
			const found = plugin.calloutService.findAtCursor(editor);
			if (!found) {
				new Notice(NOT_IN_CALLOUT);
				return;
			}

			const next =
				FOLD_CYCLE[(FOLD_CYCLE.indexOf(found.state.fold) + 1) % FOLD_CYCLE.length] ?? '';

			plugin.calloutService.apply(editor, found.line, {
				...found.state,
				fold: next,
			});
		},
	});

	plugin.addCommand({
		id: 'clear-callout-customization',
		name: 'Remove customization from callout at cursor',
		editorCallback: (editor: Editor) => {
			const found = plugin.calloutService.findAtCursor(editor);
			if (!found) {
				new Notice(NOT_IN_CALLOUT);
				return;
			}

			plugin.calloutService.apply(editor, found.line, {
				...found.state,
				icon: '',
				color: '',
			});
		},
	});
}
