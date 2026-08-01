/**
 * The "Customize callout" modal: live preview, type/title/fold fields,
 * colour swatches, and the Lucide icon picker.
 */

import { App, Modal, Setting, setIcon } from 'obsidian';
import type { ColorComponent, TextComponent } from 'obsidian';
import type { CalloutState, CustomIcon, FoldState, GridSize } from '../types';
import { SaveLookModal, SvgImportModal, type SaveTarget } from './prompts';
import type { IconIndex } from '../utils/icons';
import { BUILTIN_TYPES, buildMeta, defaultIconFor } from '../utils/callout';
import { SWATCHES, hexToCssColor, normalizeHex, resolveSwatch } from '../utils/colors';
import { IconPicker } from './icon-picker';

/** Sentinel value for the "Custom…" entry in the type dropdown. */
const CUSTOM_TYPE = '__custom__';

export interface CustomizerModalOptions {
	icons: IconIndex;
	gridSize: GridSize;
	recents: readonly string[];
	state: CalloutState;
	onSubmit: (state: CalloutState) => void;
	onAddCustomIcon: (icon: CustomIcon) => Promise<void>;
	onSaveLook: (
		name: string,
		target: SaveTarget,
		look: { icon: string; color: string },
	) => Promise<void>;
}

export class CustomizerModal extends Modal {
	private readonly options: CustomizerModalOptions;
	private readonly state: CalloutState;

	private previewWrap!: HTMLElement;
	private picker!: IconPicker;
	private colorPicker: ColorComponent | null = null;
	private hexInput: TextComponent | null = null;

	constructor(app: App, options: CustomizerModalOptions) {
		super(app);
		this.options = options;
		this.state = { ...options.state, extraMeta: [...options.state.extraMeta] };
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass('callout-customizer-modal');
		contentEl.empty();

		this.setTitle('Customize callout');

		this.previewWrap = contentEl.createDiv({ cls: 'cc-preview-wrap' });
		this.renderPreview();

		const form = contentEl.createDiv({ cls: 'cc-form' });
		this.renderTypeField(form);
		this.renderTitleField(form);
		this.renderFoldField(form);
		this.renderColorFields(form);

		this.picker = new IconPicker({
			icons: this.options.icons,
			gridSize: this.options.gridSize,
			recents: this.options.recents,
			selected: this.state.icon,
			onSelect: (name) => this.setIconName(name),
			onConfirm: (name) => {
				this.setIconName(name);
				this.submit();
			},
			onClearIcon: () => this.setIconName(''),
			onAddCustomIcon: () => this.importCustomIcon(),
		});
		this.picker.render(contentEl);

		this.renderFooter(contentEl);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderTypeField(form: HTMLElement): void {
		const isBuiltin = BUILTIN_TYPES.includes(this.state.type);
		let customField: TextComponent | null = null;

		const setting = new Setting(form)
			.setName('Type')
			.setDesc('Base callout type. Sets the fallback icon and colour.');

		setting.addDropdown((dropdown) => {
			for (const type of BUILTIN_TYPES) {
				dropdown.addOption(type, sentenceCase(type));
			}
			dropdown.addOption(CUSTOM_TYPE, 'Custom…');

			dropdown.setValue(isBuiltin ? this.state.type : CUSTOM_TYPE);

			dropdown.onChange((value) => {
				const custom = value === CUSTOM_TYPE;
				customField?.inputEl.toggleClass('cc-hidden', !custom);

				if (custom) {
					customField?.inputEl.focus();
					this.state.type = normalizeType(customField?.getValue() ?? '');
				} else {
					this.state.type = value;
				}

				this.renderPreview();
			});
		});

		setting.addText((text) => {
			customField = text;
			text.setPlaceholder('My type')
				.setValue(isBuiltin ? '' : this.state.type)
				.onChange((value) => {
					this.state.type = normalizeType(value);
					this.renderPreview();
				});

			text.inputEl.addClass('cc-custom-type');
			text.inputEl.toggleClass('cc-hidden', isBuiltin);
		});
	}

	private renderTitleField(form: HTMLElement): void {
		new Setting(form)
			.setName('Title')
			.setDesc('Leave empty to use the type name.')
			.addText((text) =>
				text
					.setPlaceholder(this.state.type)
					.setValue(this.state.title)
					.onChange((value) => {
						this.state.title = value;
						this.renderPreview();
					}),
			);
	}

	private renderFoldField(form: HTMLElement): void {
		new Setting(form)
			.setName('Fold')
			.setDesc('Collapsible behaviour in reading view.')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('', 'Not collapsible')
					.addOption('+', 'Collapsible, open')
					.addOption('-', 'Collapsible, collapsed')
					.setValue(this.state.fold)
					.onChange((value) => {
						this.state.fold = value as FoldState;
						this.renderPreview();
					}),
			);
	}

	private renderColorFields(form: HTMLElement): void {
		const setting = new Setting(form)
			.setName('Color')
			.setDesc('Pick a swatch, or enter any hex value.');

		setting.addColorPicker((picker) => {
			this.colorPicker = picker;
			picker.setValue(`#${this.state.color || this.fallbackSwatch()}`);
			picker.onChange((value) => this.setColor(normalizeHex(value), { skipPicker: true }));
		});

		setting.addText((text) => {
			this.hexInput = text;
			text.setPlaceholder('Default')
				.setValue(this.state.color ? `#${this.state.color}` : '')
				.onChange((value) => {
					const hex = normalizeHex(value);
					if (hex || !value.trim()) {
						this.setColor(hex, { skipPicker: true, skipHex: true });
					}
				});
			text.inputEl.addClass('cc-hex-input');
		});

		const swatches = form.createDiv({ cls: 'cc-swatches' });

		const defaultButton = swatches.createEl('button', {
			cls: 'cc-swatch cc-swatch-default',
			attr: { 'aria-label': 'Use type default' },
		});
		setIcon(defaultButton, 'ban');
		defaultButton.addEventListener('click', () => this.setColor(''));

		for (const [varName, fallback] of SWATCHES) {
			const hex = resolveSwatch(varName, fallback);
			const button = swatches.createEl('button', {
				cls: 'cc-swatch',
				attr: { 'aria-label': `#${hex}`, 'data-cc-swatch': hex },
			});
			button.style.setProperty('--cc-swatch-color', `#${hex}`);
			button.addEventListener('click', () => this.setColor(hex));
		}
	}

	private renderFooter(container: HTMLElement): void {
		const footer = container.createDiv({ cls: 'cc-footer' });

		const remove = footer.createEl('button', { text: 'Remove styling' });
		remove.addEventListener('click', () => {
			this.state.icon = '';
			this.state.color = '';
			this.submit();
		});

		const save = footer.createEl('button', { text: 'Save look…' });
		save.addEventListener('click', () => {
			const look = { icon: this.state.icon, color: this.state.color };

			new SaveLookModal(this.app, look, (result) => {
				void this.options.onSaveLook(result.name, result.target, look);
			}).open();
		});

		footer.createDiv({ cls: 'cc-spacer' });

		const cancel = footer.createEl('button', { text: 'Cancel' });
		cancel.addEventListener('click', () => this.close());

		const apply = footer.createEl('button', { cls: 'mod-cta', text: 'Apply' });
		apply.addEventListener('click', () => this.submit());
	}

	private fallbackSwatch(): string {
		return resolveSwatch('--color-blue', '#086ddd');
	}

	private importCustomIcon(): void {
		new SvgImportModal(this.app, (result) => {
			void this.options
				.onAddCustomIcon({ slug: result.slug, name: result.name, svg: result.svg })
				.then(() => {
					// Reopen so the picker rebuilds against the new icon set.
					const token = `svg-${result.slug}`;
					this.state.icon = token;
					this.close();
					new CustomizerModal(this.app, {
						...this.options,
						state: { ...this.state },
					}).open();
				});
		}).open();
	}

	private setIconName(name: string): void {
		this.state.icon = name;
		this.picker.setSelected(name);
		this.renderPreview();
	}

	private setColor(
		hex: string,
		opts: { skipPicker?: boolean; skipHex?: boolean } = {},
	): void {
		this.state.color = normalizeHex(hex);

		if (!opts.skipPicker) {
			this.colorPicker?.setValue(`#${this.state.color || this.fallbackSwatch()}`);
		}
		if (!opts.skipHex) {
			this.hexInput?.setValue(this.state.color ? `#${this.state.color}` : '');
		}

		this.renderPreview();
	}

	private renderPreview(): void {
		this.previewWrap.empty();

		const type = this.state.type || 'note';

		// `cc-preview-callout` carries our own colour rules: Obsidian's .callout
		// styles are scoped to markdown containers and do not reach a modal.
		const callout = this.previewWrap.createDiv({
			cls: 'callout cc-preview-callout',
		});
		callout.setAttr('data-callout', type);

		const color = this.state.color
			? hexToCssColor(this.state.color)
			: resolveSwatch(defaultColorVarFor(type), '#086ddd');

		callout.style.setProperty('--callout-color', color);
		callout.style.setProperty('--cc-preview-color', color.startsWith('#') ? color : `#${color}`);

		const title = callout.createDiv({ cls: 'callout-title' });
		const iconEl = title.createDiv({ cls: 'callout-icon' });
		this.options.icons.renderInto(iconEl, this.resolvePreviewIcon(type));
		title.createDiv({
			cls: 'callout-title-inner',
			text: this.state.title || sentenceCase(type),
		});

		callout
			.createDiv({ cls: 'callout-content' })
			.createEl('p', { text: 'Preview of this callout.' });

		this.previewWrap.createDiv({ cls: 'cc-source', text: this.sourceLine(type) });
	}

	private resolvePreviewIcon(type: string): string {
		if (this.state.icon && this.options.icons.has(this.state.icon)) {
			return this.state.icon;
		}

		const fallback = defaultIconFor(type);
		return this.options.icons.has(fallback) ? fallback : 'pencil';
	}

	private sourceLine(type: string): string {
		const meta = buildMeta(this.state);
		return (
			`> [!${type}${meta ? `|${meta}` : ''}]` +
			this.state.fold +
			(this.state.title ? ` ${this.state.title}` : '')
		);
	}

	private submit(): void {
		this.options.onSubmit(this.state);
		this.close();
	}
}

function sentenceCase(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Callout types are case-insensitive and cannot contain `]`, `|` or spaces. */
function normalizeType(value: string): string {
	return value.trim().toLowerCase().replace(/[\]|\s]/g, '') || 'note';
}

/** Obsidian's default accent per callout type, for the preview only. */
function defaultColorVarFor(type: string): string {
	switch (type) {
		case 'abstract': case 'summary': case 'tldr':
		case 'tip': case 'hint': case 'important':
			return '--color-cyan';
		case 'success': case 'check': case 'done':
			return '--color-green';
		case 'question': case 'help': case 'faq':
		case 'warning': case 'caution': case 'attention':
			return '--color-orange';
		case 'failure': case 'fail': case 'missing':
		case 'danger': case 'error': case 'bug':
			return '--color-red';
		case 'example':
			return '--color-purple';
		case 'quote': case 'cite':
			return '--color-gray';
		default:
			return '--color-blue';
	}
}
