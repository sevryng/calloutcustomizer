import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type CalloutCustomizer from './main';
import type {
	CalloutPreset,
	CustomCalloutType,
	CustomIcon,
	GridSize,
} from './types';
import { SNIPPET_NAME } from './utils/snippet';
import { SvgImportModal } from './ui/prompts';

export interface CalloutCustomizerSettings {
	/** Add "Customize callout…" to the editor context menu. */
	addContextMenuItem: boolean;
	/** Show a recent-icons submenu in the context menu. */
	showRecentSubmenu: boolean;
	recentLimit: number;
	recentIcons: string[];
	/** Colours seen so far, so their CSS rules exist on the next start. */
	usedColors: string[];
	gridSize: GridSize;
	/** Saved looks applied inline to one callout at a time. */
	presets: CalloutPreset[];
	/** Saved looks promoted to real callout types via the CSS snippet. */
	customTypes: CustomCalloutType[];
	/** User-supplied SVG icons. */
	customIcons: CustomIcon[];
}

export const DEFAULT_SETTINGS: CalloutCustomizerSettings = {
	addContextMenuItem: true,
	showRecentSubmenu: true,
	recentLimit: 12,
	recentIcons: [],
	usedColors: [],
	gridSize: 'medium',
	presets: [],
	customTypes: [],
	customIcons: [],
};

export class CalloutCustomizerSettingTab extends PluginSettingTab {
	plugin: CalloutCustomizer;

	constructor(app: App, plugin: CalloutCustomizer) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Add item to the right-click menu')
			.setDesc(
				'Adds "Customize callout…" to the editor context menu when you right-click inside a callout.',
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.addContextMenuItem)
					.onChange(async (value) => {
						this.plugin.settings.addContextMenuItem = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Recent icons submenu')
			.setDesc('Show recently used icons directly in the right-click menu.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showRecentSubmenu)
					.onChange(async (value) => {
						this.plugin.settings.showRecentSubmenu = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Recent icons to keep')
			.addSlider((slider) =>
				slider
					.setLimits(4, 24, 1)
					.setValue(this.plugin.settings.recentLimit)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.recentLimit = value;
						this.plugin.settings.recentIcons =
							this.plugin.settings.recentIcons.slice(0, value);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName('Icon grid size').addDropdown((dropdown) =>
			dropdown
				.addOption('small', 'Small')
				.addOption('medium', 'Medium')
				.addOption('large', 'Large')
				.setValue(this.plugin.settings.gridSize)
				.onChange(async (value) => {
					this.plugin.settings.gridSize = value as GridSize;
					await this.plugin.saveSettings();
				}),
		);

		new Setting(containerEl).setName('Clear recent icons').addButton((button) =>
			button.setButtonText('Clear').onClick(async () => {
				this.plugin.settings.recentIcons = [];
				await this.plugin.saveSettings();
				new Notice('Recent icons cleared.');
			}),
		);

		this.renderCustomIcons(containerEl);
		this.renderPresets(containerEl);
		this.renderCustomTypes(containerEl);

		new Setting(containerEl).setName('About').setHeading();

		const info = containerEl.createDiv({ cls: 'setting-item-description' });

		info.createEl('p', {
			text:
				'Customizations are written inline into the note, for example ' +
				'> [!note|i:star c:e07b39] Title. They travel with the file, so they ' +
				'survive sync and export.',
		});

		info.createEl('p', {
			text:
				`${this.plugin.icons.names.length} icons indexed across ` +
				`${this.plugin.icons.categoryNames().length} categories. Lucide publishes ` +
				'categories.json only in its GitHub repository, so the grouping here is ' +
				"derived from each icon's official tag metadata. To use the official " +
				'grouping instead, save categories.json as lucide-categories.json in this ' +
				"plugin's folder and reload Obsidian.",
		});
	}

	private renderCustomIcons(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Custom icons').setHeading();

		new Setting(containerEl)
			.setName('Add a custom icon')
			.setDesc('Paste SVG markup or pick an .svg file from your vault.')
			.addButton((button) =>
				button
					.setButtonText('Add icon')
					.setCta()
					.onClick(() => {
						new SvgImportModal(this.app, async (result) => {
							await this.plugin.addCustomIcon(result);
							this.display();
						}).open();
					}),
			);

		for (const icon of this.plugin.settings.customIcons) {
			const setting = new Setting(containerEl)
				.setName(icon.name)
				.setDesc(`Use as i:svg-${icon.slug}`);

			this.plugin.icons.renderInto(
				setting.nameEl.createSpan({ cls: 'cc-inline-icon' }),
				`svg-${icon.slug}`,
			);

			setting.addExtraButton((button) =>
				button
					.setIcon('trash-2')
					.setTooltip('Remove')
					.onClick(async () => {
						await this.plugin.removeCustomIcon(icon.slug);
						this.display();
					}),
			);
		}
	}

	private renderPresets(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Presets').setHeading();

		if (!this.plugin.settings.presets.length) {
			containerEl.createEl('p', {
				cls: 'setting-item-description',
				text: 'Save a look from the customize dialog to reuse it here and in the right-click menu.',
			});
			return;
		}

		for (const preset of this.plugin.settings.presets) {
			new Setting(containerEl)
				.setName(preset.name)
				.setDesc(describeLook(preset))
				.addExtraButton((button) =>
					button
						.setIcon('trash-2')
						.setTooltip('Delete preset')
						.onClick(async () => {
							this.plugin.settings.presets = this.plugin.settings.presets.filter(
								(candidate) => candidate.id !== preset.id,
							);
							await this.plugin.saveSettings();
							this.display();
						}),
				);
		}
	}

	private renderCustomTypes(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Custom callout types').setHeading();

		containerEl.createEl('p', {
			cls: 'setting-item-description',
			text:
				`These are written to the CSS snippet "${SNIPPET_NAME}". The snippet has to ` +
				'be enabled for them to render.',
		});

		new Setting(containerEl)
			.setName('CSS snippet')
			.setDesc(
				this.plugin.snippets.isEnabled()
					? 'Enabled.'
					: 'Not enabled yet - custom callout types will not render until it is.',
			)
			.addButton((button) =>
				button
					.setButtonText(this.plugin.snippets.isEnabled() ? 'Rewrite snippet' : 'Enable snippet')
					.onClick(async () => {
						await this.plugin.writeSnippet();
						if (!this.plugin.snippets.isEnabled()) this.plugin.snippets.enable();
						this.display();
					}),
			);

		for (const type of this.plugin.settings.customTypes) {
			new Setting(containerEl)
				.setName(type.name)
				.setDesc(`> [!${type.id}] · ${describeLook(type)}`)
				.addExtraButton((button) =>
					button
						.setIcon('trash-2')
						.setTooltip('Delete type')
						.onClick(async () => {
							this.plugin.settings.customTypes =
								this.plugin.settings.customTypes.filter(
									(candidate) => candidate.id !== type.id,
								);
							await this.plugin.saveSettings();
							await this.plugin.writeSnippet();
							this.display();
						}),
				);
		}
	}
}

function describeLook(look: { icon: string; color: string }): string {
	const parts: string[] = [];
	if (look.icon) parts.push(look.icon);
	if (look.color) parts.push(`#${look.color}`);
	return parts.join(' · ') || 'no styling';
}
