/**
 * Searchable Lucide icon grid with category filtering.
 *
 * Results render in pages as the user scrolls; rendering all ~1,750 buttons at
 * once is noticeably slow on mobile.
 */

import type { IconIndex } from '../utils/icons';
import type { GridSize } from '../types';

const PAGE_SIZE = 180;
const SCROLL_THRESHOLD_PX = 240;

export interface IconPickerOptions {
	icons: IconIndex;
	gridSize: GridSize;
	recents: readonly string[];
	selected: string;
	onSelect: (name: string) => void;
	/** Double-click: pick and confirm in one gesture. */
	onConfirm: (name: string) => void;
	onClearIcon: () => void;
	/** Opens the custom-SVG importer. */
	onAddCustomIcon: () => void;
}

export class IconPicker {
	private readonly options: IconPickerOptions;
	private grid!: HTMLElement;
	private countEl!: HTMLElement;

	private results: string[] = [];
	private rendered = 0;
	private query = '';
	private category = '';
	private selected: string;

	constructor(options: IconPickerOptions) {
		this.options = options;
		this.selected = options.selected;
	}

	render(container: HTMLElement): void {
		const { icons } = this.options;

		const head = container.createDiv({ cls: 'cc-picker-head' });

		const search = head.createEl('input', {
			cls: 'cc-search',
			attr: {
				type: 'search',
				placeholder: `Search ${icons.names.length} Lucide icons…`,
			},
		});
		search.addEventListener('input', () => {
			this.query = search.value;
			this.refresh();
		});

		const categorySelect = head.createEl('select', { cls: 'dropdown cc-category' });
		categorySelect.createEl('option', { value: '', text: 'All categories' });
		for (const name of icons.categoryNames()) {
			categorySelect.createEl('option', {
				value: name,
				text: icons.prettyCategory(name),
			});
		}
		categorySelect.addEventListener('change', () => {
			this.category = categorySelect.value;
			this.refresh();
		});

		const clear = head.createEl('button', { cls: 'cc-clear-icon', text: 'Default icon' });
		clear.addEventListener('click', () => {
			this.setSelected('');
			this.options.onClearIcon();
		});

		const addCustom = head.createEl('button', {
			cls: 'cc-clear-icon',
			text: 'Custom SVG…',
			attr: { 'aria-label': 'Import a custom SVG icon' },
		});
		addCustom.addEventListener('click', () => this.options.onAddCustomIcon());

		this.renderRecents(container);

		this.grid = container.createDiv({
			cls: `cc-grid cc-grid-${this.options.gridSize}`,
		});
		this.grid.addEventListener('scroll', () => {
			const remaining =
				this.grid.scrollHeight - this.grid.scrollTop - this.grid.clientHeight;
			if (remaining < SCROLL_THRESHOLD_PX) this.renderPage();
		});

		this.countEl = container.createDiv({ cls: 'cc-count' });

		this.refresh();
		window.setTimeout(() => search.focus(), 30);
	}

	setSelected(name: string): void {
		this.selected = name;
		for (const child of Array.from(this.grid.children)) {
			if (child instanceof HTMLElement) {
				child.toggleClass('is-selected', child.dataset.icon === name);
			}
		}
	}

	private renderRecents(container: HTMLElement): void {
		const usable = this.options.recents.filter((name) => this.options.icons.has(name));
		if (!usable.length) return;

		const row = container.createDiv({ cls: 'cc-recents' });
		row.createSpan({ cls: 'cc-recents-label', text: 'Recent' });

		for (const name of usable) {
			const button = row.createEl('button', {
				cls: 'cc-icon-btn',
				attr: { 'aria-label': name },
			});
			this.options.icons.renderInto(button, name);
			button.addEventListener('click', () => {
				this.setSelected(name);
				this.options.onSelect(name);
			});
		}
	}

	private refresh(): void {
		this.results = this.options.icons.search(this.query, this.category || undefined);
		this.rendered = 0;
		this.grid.empty();
		this.grid.scrollTop = 0;
		this.renderPage();
	}

	private renderPage(): void {
		const end = Math.min(this.results.length, this.rendered + PAGE_SIZE);

		for (let i = this.rendered; i < end; i++) {
			const name = this.results[i];
			if (!name) continue;
			this.renderButton(name);
		}

		this.rendered = end;
		this.countEl.setText(
			this.results.length
				? `Showing ${this.rendered} of ${this.results.length} icons`
				: 'No icons match that search.',
		);
	}

	private renderButton(name: string): void {
		const button = this.grid.createEl('button', {
			cls: 'cc-icon-btn',
			attr: { 'aria-label': name, title: name },
		});
		button.dataset.icon = name;
		if (name === this.selected) button.addClass('is-selected');

		this.options.icons.renderInto(button, name);

		button.addEventListener('click', () => {
			this.setSelected(name);
			this.options.onSelect(name);
		});
		button.addEventListener('dblclick', () => {
			this.setSelected(name);
			this.options.onConfirm(name);
		});
	}
}
