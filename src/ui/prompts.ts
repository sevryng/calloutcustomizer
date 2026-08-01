/**
 * Small supporting modals: importing a custom SVG, and naming a saved look.
 */

import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import type { TextComponent } from 'obsidian';
import { SvgError, sanitizeSvg, slugify } from '../utils/svg';

/* ------------------------------------------------------------------ *
 * SVG import
 * ------------------------------------------------------------------ */

export interface SvgImportResult {
	name: string;
	slug: string;
	svg: string;
}

export class SvgImportModal extends Modal {
	private name = '';
	private markup = '';
	private recolor = true;
	private previewEl!: HTMLElement;
	private statusEl!: HTMLElement;

	constructor(
		app: App,
		private readonly onSubmit: (result: SvgImportResult) => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.setTitle('Add a custom icon');

		let nameInput!: TextComponent;

		new Setting(contentEl)
			.setName('Name')
			.setDesc('Shown in the icon picker.')
			.addText((text) => {
				nameInput = text;
				text.setPlaceholder('My logo').onChange((value) => {
					this.name = value;
				});
			});

		new Setting(contentEl)
			.setName('Choose an SVG from your vault')
			.setDesc('Any .svg file in the vault.')
			.addDropdown((dropdown) => {
				const files = this.app.vault
					.getFiles()
					.filter((file) => file.extension === 'svg')
					.slice(0, 500);

				dropdown.addOption('', files.length ? 'Select a file…' : 'No .svg files in vault');
				for (const file of files) dropdown.addOption(file.path, file.path);

				dropdown.onChange(async (path) => {
					if (!path) return;
					const file = this.app.vault.getAbstractFileByPath(path);
					if (!(file instanceof TFile)) return;

					this.markup = await this.app.vault.cachedRead(file);
					textarea.value = this.markup;
					if (!this.name) {
						this.name = file.basename;
						nameInput.setValue(this.name);
					}
					this.refreshPreview();
				});
			});

		new Setting(contentEl)
			.setName('Match callout color')
			.setDesc('Recolor the icon to follow the callout, instead of its own colors.')
			.addToggle((toggle) =>
				toggle.setValue(this.recolor).onChange((value) => {
					this.recolor = value;
					this.refreshPreview();
				}),
			);

		contentEl.createEl('p', {
			cls: 'setting-item-description',
			text: 'Or paste SVG markup directly:',
		});

		const textarea = contentEl.createEl('textarea', {
			cls: 'cc-svg-input',
			attr: { rows: '8', placeholder: '<svg viewBox="0 0 24 24">…</svg>' },
		});
		textarea.addEventListener('input', () => {
			this.markup = textarea.value;
			this.refreshPreview();
		});

		const preview = contentEl.createDiv({ cls: 'cc-svg-preview' });
		this.previewEl = preview.createDiv({ cls: 'cc-svg-preview-box' });
		this.statusEl = preview.createDiv({ cls: 'cc-svg-status' });
		this.refreshPreview();

		const footer = contentEl.createDiv({ cls: 'cc-footer' });
		footer.createDiv({ cls: 'cc-spacer' });

		const cancel = footer.createEl('button', { text: 'Cancel' });
		cancel.addEventListener('click', () => this.close());

		const add = footer.createEl('button', { cls: 'mod-cta', text: 'Add icon' });
		add.addEventListener('click', () => this.submit());
	}

	onClose(): void {
		this.contentEl.empty();
	}

	/** Show the sanitized result, or the reason it can't be used, as you type. */
	private refreshPreview(): void {
		this.previewEl.empty();
		this.statusEl.removeClass('cc-svg-status-error');

		if (!this.markup.trim()) {
			this.statusEl.setText('Paste SVG markup or choose a file to see a preview.');
			return;
		}

		try {
			const svg = sanitizeSvg(this.markup, { recolor: this.recolor });
			const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
			const node = this.previewEl.ownerDocument.importNode(parsed.documentElement, true);

			this.previewEl.appendChild(node);
			this.statusEl.setText(`Looks good - ${svg.length} characters after cleanup.`);
		} catch (error) {
			this.statusEl.addClass('cc-svg-status-error');
			this.statusEl.setText(
				error instanceof SvgError ? error.message : 'That SVG could not be parsed.',
			);
		}
	}

	private submit(): void {
		const name = this.name.trim();
		if (!name) {
			new Notice('Give the icon a name.');
			return;
		}

		const slug = slugify(name);
		if (!slug) {
			new Notice('That name has no usable characters. Try letters or numbers.');
			return;
		}

		try {
			const svg = sanitizeSvg(this.markup, { recolor: this.recolor });
			this.onSubmit({ name, slug, svg });
			this.close();
		} catch (error) {
			new Notice(
				error instanceof SvgError ? error.message : 'That SVG could not be imported.',
				10_000,
			);
		}
	}
}

/* ------------------------------------------------------------------ *
 * Save a look
 * ------------------------------------------------------------------ */

export type SaveTarget = 'preset' | 'type';

export interface SaveResult {
	name: string;
	target: SaveTarget;
}

export class SaveLookModal extends Modal {
	private name = '';
	private target: SaveTarget = 'preset';
	private explanationEl!: HTMLElement;

	constructor(
		app: App,
		private readonly look: { icon: string; color: string },
		private readonly onSubmit: (result: SaveResult) => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.setTitle('Save this look');

		new Setting(contentEl).setName('Name').addText((text) =>
			text.setPlaceholder('Corgi').onChange((value) => {
				this.name = value;
				this.renderExplanation();
			}),
		);

		new Setting(contentEl)
			.setName('Save as')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('preset', 'Preset')
					.addOption('type', 'Callout type')
					.setValue(this.target)
					.onChange((value) => {
						this.target = value as SaveTarget;
						this.renderExplanation();
					}),
			);

		this.explanationEl = contentEl.createDiv({ cls: 'cc-explain' });
		this.renderExplanation();

		const footer = contentEl.createDiv({ cls: 'cc-footer' });
		footer.createDiv({ cls: 'cc-spacer' });

		const cancel = footer.createEl('button', { text: 'Cancel' });
		cancel.addEventListener('click', () => this.close());

		const save = footer.createEl('button', { cls: 'mod-cta', text: 'Save' });
		save.addEventListener('click', () => {
			const name = this.name.trim();
			if (!name) {
				new Notice('Give it a name first.');
				return;
			}
			if (this.target === 'type' && !slugify(name)) {
				new Notice('That name has no usable characters for a callout type.');
				return;
			}

			this.onSubmit({ name, target: this.target });
			this.close();
		});
	}

	/** Spell out the consequence of the choice, with the markdown you'd get. */
	private renderExplanation(): void {
		this.explanationEl.empty();

		const isPreset = this.target === 'preset';
		const slug = slugify(this.name) || 'my-type';

		const meta = [
			this.look.icon ? `i:${this.look.icon}` : '',
			this.look.color ? `c:${this.look.color}` : '',
		]
			.filter(Boolean)
			.join(' ');

		const points = isPreset
			? [
					'Stored in this plugin, not in your vault.',
					'Apply it per callout from the right-click menu → Apply preset.',
					'The look is written into that one callout as metadata.',
					'Existing callouts keep whatever look they already had.',
				]
			: [
					`Becomes a real callout type you write as > [!${slug}].`,
					'Written to .obsidian/snippets/callout-customizer.css.',
					'Every callout of this type updates when you change it.',
					'Keeps working even if this plugin is disabled.',
					'Requires the CSS snippet to be enabled.',
				];

		this.explanationEl.createEl('p', {
			cls: 'cc-explain-lead',
			text: isPreset
				? 'A preset styles one callout at a time.'
				: 'A callout type is reusable and applies everywhere at once.',
		});

		const list = this.explanationEl.createEl('ul');
		for (const point of points) list.createEl('li', { text: point });

		this.explanationEl.createEl('p', {
			cls: 'cc-explain-label',
			text: 'You would then write:',
		});
		this.explanationEl.createEl('pre', { cls: 'cc-explain-code' }).createEl('code', {
			text: isPreset
				? `> [!note${meta ? `|${meta}` : ''}] Title`
				: `> [!${slug}] Title`,
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
