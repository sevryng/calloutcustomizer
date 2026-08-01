/**
 * Context-menu integration.
 *
 * Two separate menus exist, and they are not the same code path:
 *
 * 1. Right-clicking callout *source* (cursor inside, or Source mode) raises the
 *    normal editor menu, which fires `editor-menu`. Appending there is enough.
 *
 * 2. Right-clicking a *rendered* callout in Live Preview raises Obsidian's own
 *    callout widget menu - the one with only "Edit" and "Callout type". That
 *    menu is built internally and fires no public event, so nothing can be
 *    appended to it.
 *
 * Case 2 is the common one, so it is intercepted at the capture phase and
 * replaced with a superset menu: Obsidian's two items reimplemented, plus ours.
 */

import { Menu, MarkdownView, MenuItem } from 'obsidian';
import type { Editor } from 'obsidian';
import type CalloutCustomizer from '../main';
import type { CalloutState, LocatedCallout } from '../types';

/** `setSubmenu` landed in Obsidian 1.4.14; degrade gracefully without it. */
type SubmenuCapable = MenuItem & { setSubmenu?: () => Menu };

/** Types offered in the "Callout type" submenu, deduplicated by behaviour. */
const PRIMARY_TYPES: readonly string[] = [
	'note', 'abstract', 'info', 'todo', 'tip', 'success', 'question',
	'warning', 'failure', 'danger', 'bug', 'example', 'quote',
];

export function registerContextMenu(plugin: CalloutCustomizer): void {
	plugin.registerDomEvent(
		activeDocument,
		'contextmenu',
		(evt: MouseEvent) => {
			plugin.calloutService.recordClick(evt);
			interceptRenderedCallout(plugin, evt);
		},
		{ capture: true },
	);

	// Source-mode and cursor-inside right-clicks still come through here.
	plugin.registerEvent(
		plugin.app.workspace.on('editor-menu', (menu, editor) => {
			if (!plugin.settings.addContextMenuItem) return;

			const found = plugin.calloutService.findAtClick(editor);
			if (!found) return;

			addCustomizerItems(plugin, menu, editor, found);
		}),
	);
}

/**
 * Replace Obsidian's rendered-callout menu with a superset of it.
 * Bails out - leaving the native menu alone - whenever anything is unclear.
 */
function interceptRenderedCallout(plugin: CalloutCustomizer, evt: MouseEvent): void {
	if (!plugin.settings.addContextMenuItem) return;

	const target = evt.target;
	if (!(target instanceof HTMLElement)) return;

	const callout = target.closest('.callout');
	if (!callout) return;

	// Only inside an editor: reading view has nothing to write back to.
	if (!target.closest('.markdown-source-view')) return;

	const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
	const editor = view?.editor;
	if (!editor) return;

	// A live selection means the user probably wants Copy; leave them alone.
	if (editor.somethingSelected()) return;

	const found = plugin.calloutService.findAtClick(editor);
	if (!found) return;

	evt.preventDefault();
	evt.stopPropagation();

	const menu = new Menu();

	menu.addItem((item) =>
		item
			.setTitle('Edit')
			.setIcon('pencil')
			.onClick(() => {
				// Placing the cursor on the header un-renders the widget.
				editor.setCursor({
					line: found.line,
					ch: editor.getLine(found.line).length,
				});
				editor.focus();
			}),
	);

	menu.addItem((item) => addTypeSubmenu(plugin, item, editor, found));

	addCustomizerItems(plugin, menu, editor, found);

	menu.showAtMouseEvent(evt);
}

/** The plugin's own items, shared by both menus. */
function addCustomizerItems(
	plugin: CalloutCustomizer,
	menu: Menu,
	editor: Editor,
	found: LocatedCallout,
): void {
	const { line, state } = found;

	menu.addSeparator();

	menu.addItem((item) =>
		item
			.setTitle('Customize callout…')
			.setIcon('palette')
			.onClick(() => plugin.openCustomizer(editor, found)),
	);

	if (plugin.settings.presets.length) {
		menu.addItem((item) => addPresets(plugin, item, editor, found));
	}

	if (plugin.settings.showRecentSubmenu && plugin.settings.recentIcons.length) {
		menu.addItem((item) => addRecentIcons(plugin, item, editor, found));
	}

	menu.addItem((item) =>
		item
			.setTitle(state.fold === '-' ? 'Expand by default' : 'Collapse by default')
			.setIcon(state.fold === '-' ? 'chevron-down' : 'chevron-right')
			.onClick(() => {
				plugin.calloutService.apply(editor, line, {
					...state,
					fold: state.fold === '-' ? '+' : '-',
				});
			}),
	);

	if (state.icon || state.color) {
		menu.addItem((item) =>
			item
				.setTitle('Reset callout style')
				.setIcon('rotate-ccw')
				.onClick(() => {
					plugin.calloutService.apply(editor, line, {
						...state,
						icon: '',
						color: '',
					});
				}),
		);
	}
}

function addTypeSubmenu(
	plugin: CalloutCustomizer,
	item: MenuItem,
	editor: Editor,
	found: LocatedCallout,
): void {
	item.setTitle('Callout type').setIcon('list');

	const submenu = openSubmenu(item);
	if (!submenu) {
		item.onClick(() => plugin.openCustomizer(editor, found));
		return;
	}

	const applyType = (type: string): void => {
		plugin.calloutService.apply(editor, found.line, { ...found.state, type });
	};

	for (const type of PRIMARY_TYPES) {
		submenu.addItem((sub) =>
			sub
				.setTitle(sentenceCase(type))
				.setChecked(found.state.type === type)
				.onClick(() => applyType(type)),
		);
	}

	if (plugin.settings.customTypes.length) {
		submenu.addSeparator();
		for (const custom of plugin.settings.customTypes) {
			submenu.addItem((sub) =>
				sub
					.setTitle(custom.name)
					.setChecked(found.state.type === custom.id)
					.onClick(() => applyType(custom.id)),
			);
		}
	}
}

function addPresets(
	plugin: CalloutCustomizer,
	item: MenuItem,
	editor: Editor,
	found: LocatedCallout,
): void {
	item.setTitle('Apply preset').setIcon('palette');

	const submenu = openSubmenu(item);
	if (!submenu) {
		item.onClick(() => plugin.openCustomizer(editor, found));
		return;
	}

	for (const preset of plugin.settings.presets) {
		submenu.addItem((sub) =>
			sub.setTitle(preset.name).onClick(() => {
				applyLook(plugin, editor, found, preset);
			}),
		);
	}
}

function addRecentIcons(
	plugin: CalloutCustomizer,
	item: MenuItem,
	editor: Editor,
	found: LocatedCallout,
): void {
	item.setTitle('Recent icons').setIcon('history');

	const submenu = openSubmenu(item);
	if (!submenu) {
		item.onClick(() => plugin.openCustomizer(editor, found));
		return;
	}

	for (const name of plugin.settings.recentIcons) {
		if (!plugin.icons.has(name)) continue;

		submenu.addItem((sub) => {
			sub
				.setTitle(name)
				.setChecked(found.state.icon === name)
				.onClick(() => {
					plugin.calloutService.apply(editor, found.line, {
						...found.state,
						icon: name,
					});
				});

			if (!plugin.icons.isCustom(name)) sub.setIcon(`lucide-${name}`);
		});
	}
}

function applyLook(
	plugin: CalloutCustomizer,
	editor: Editor,
	found: LocatedCallout,
	look: Pick<CalloutState, 'icon' | 'color'>,
): void {
	plugin.calloutService.apply(editor, found.line, {
		...found.state,
		icon: look.icon,
		color: look.color,
	});
}

function openSubmenu(item: MenuItem): Menu | null {
	const capable = item as SubmenuCapable;
	return typeof capable.setSubmenu === 'function' ? capable.setSubmenu() : null;
}

function sentenceCase(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}
