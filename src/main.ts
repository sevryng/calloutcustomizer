import { Notice, Plugin } from 'obsidian';
import type { Editor } from 'obsidian';
import {
	CalloutCustomizerSettingTab,
	DEFAULT_SETTINGS,
	type CalloutCustomizerSettings,
} from './settings';
import { CalloutService } from './callout-service';
import { registerCommands } from './commands';
import { registerContextMenu } from './ui/context-menu';
import { CustomizerModal } from './ui/customizer-modal';
import { parseMeta } from './utils/callout';
import { hexToCssColor } from './utils/colors';
import { IconIndex } from './utils/icons';
import { StyleManager } from './utils/styles';
import { SnippetWriter } from './utils/snippet';
import { slugify } from './utils/svg';
import type {
	CalloutPreset,
	CategoryOverride,
	CustomIcon,
	LocatedCallout,
} from './types';

const CATEGORY_OVERRIDE_FILE = 'lucide-categories.json';

export default class CalloutCustomizer extends Plugin {
	settings!: CalloutCustomizerSettings;
	icons!: IconIndex;
	styles!: StyleManager;
	snippets!: SnippetWriter;
	calloutService!: CalloutService;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.snippets = new SnippetWriter(this.app);
		this.icons = new IconIndex();
		this.styles = new StyleManager();
		this.calloutService = new CalloutService(this);

		// Register UI before anything that can throw: a failure in icon or
		// style setup should cost styling, not the settings tab and menus.
		this.addSettingTab(new CalloutCustomizerSettingTab(this.app, this));
		registerContextMenu(this);
		registerCommands(this);

		// Reading view is rendered outside the editor, so apply icon and colour
		// directly there rather than relying solely on the generated stylesheet.
		this.registerMarkdownPostProcessor((el) => this.decorateCallouts(el));

		try {
			this.icons.build(
				await this.loadCategoryOverride(),
				this.settings.customIcons,
			);
			this.styles.onNewColor = (hex) => void this.rememberColor(hex);
			this.styles.load(this.icons, this.settings.usedColors);
		} catch (err) {
			console.error('Callout Customizer: style setup failed', err);
			new Notice('Callout Customizer: styling failed to load - see console.');
		}
	}

	onunload(): void {
		this.styles.unload();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<CalloutCustomizerSettings>,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	openCustomizer(editor: Editor, found: LocatedCallout): void {
		new CustomizerModal(this.app, {
			icons: this.icons,
			gridSize: this.settings.gridSize,
			recents: this.settings.recentIcons,
			state: found.state,
			onSubmit: (state) => this.calloutService.apply(editor, found.line, state),
			onAddCustomIcon: (icon) => this.addCustomIcon(icon),
			onSaveLook: (name, target, look) => this.saveLook(name, target, look),
		}).open();
	}

	/** Add a sanitized SVG icon and rebuild everything that indexes icons. */
	async addCustomIcon(icon: CustomIcon): Promise<void> {
		this.settings.customIcons = [
			...this.settings.customIcons.filter((existing) => existing.slug !== icon.slug),
			icon,
		];

		await this.saveSettings();
		await this.refreshIcons();
	}

	async removeCustomIcon(slug: string): Promise<void> {
		this.settings.customIcons = this.settings.customIcons.filter(
			(icon) => icon.slug !== slug,
		);

		await this.saveSettings();
		await this.refreshIcons();
		await this.writeSnippet();
	}

	/** Persist a look as a reusable preset or as a real callout type. */
	async saveLook(
		name: string,
		target: 'preset' | 'type',
		look: { icon: string; color: string },
	): Promise<void> {
		if (target === 'preset') {
			const preset: CalloutPreset = {
				id: `${slugify(name)}-${Date.now().toString(36)}`,
				name,
				icon: look.icon,
				color: look.color,
			};
			this.settings.presets = [...this.settings.presets, preset];
			await this.saveSettings();
			new Notice(`Preset "${name}" saved.`);
			return;
		}

		const id = slugify(name);
		this.settings.customTypes = [
			...this.settings.customTypes.filter((type) => type.id !== id),
			{ id, name, icon: look.icon, color: look.color },
		];

		await this.saveSettings();
		await this.writeSnippet();

		if (this.snippets.isEnabled()) {
			new Notice(`Callout type saved. Use > [!${id}]`);
		} else {
			new Notice(
				`Callout type saved as > [!${id}], but the CSS snippet is not enabled yet. ` +
					'Enable it in this plugin\'s settings.',
				10_000,
			);
		}
	}

	async writeSnippet(): Promise<void> {
		await this.snippets.write(this.settings.customTypes, this.settings.customIcons);
	}

	private async refreshIcons(): Promise<void> {
		this.icons.build(await this.loadCategoryOverride(), this.settings.customIcons);
		this.styles.load(this.icons, this.settings.usedColors);
	}

	async rememberIcon(name: string): Promise<void> {
		const limit = Math.max(1, this.settings.recentLimit);
		const next = [name, ...this.settings.recentIcons.filter((n) => n !== name)];

		this.settings.recentIcons = next.slice(0, limit);
		await this.saveSettings();
	}

	private async rememberColor(hex: string): Promise<void> {
		if (this.settings.usedColors.includes(hex)) return;

		this.settings.usedColors.push(hex);
		await this.saveSettings();
	}

	/**
	 * Optional override: the official Lucide categories.json, saved next to
	 * main.js. Read through the adapter because the plugin folder lives under
	 * `.obsidian` and so is not part of the vault file tree.
	 */
	private async loadCategoryOverride(): Promise<CategoryOverride | null> {
		const dir = this.manifest.dir;
		if (!dir) return null;

		const path = `${dir}/${CATEGORY_OVERRIDE_FILE}`;

		try {
			if (!(await this.app.vault.adapter.exists(path))) return null;
			const raw = await this.app.vault.adapter.read(path);
			return JSON.parse(raw) as CategoryOverride;
		} catch {
			// A malformed override should never stop the plugin loading.
			return null;
		}
	}

	private decorateCallouts(el: HTMLElement): void {
		const callouts = Array.from(el.querySelectorAll<HTMLElement>('.callout'));
		if (el.hasClass('callout')) callouts.push(el);

		for (const callout of callouts) {
			const meta = callout.getAttribute('data-callout-metadata');
			if (!meta) continue;

			const { icon, color } = parseMeta(meta);

			if (color) {
				this.styles.registerColor(color);
				callout.style.setProperty('--callout-color', hexToCssColor(color));
			}

			if (icon && this.icons.has(icon)) {
				const holder = callout.querySelector<HTMLElement>('.callout-icon');
				if (holder) this.icons.renderInto(holder, icon);
			}
		}
	}
}
