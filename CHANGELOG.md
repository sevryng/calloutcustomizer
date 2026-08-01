# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.2] - 2026-08-01

### Fixed

- Plugin failing to load: replaced constructable stylesheet injection with an
  injected `<style>` element, and reordered startup so the settings tab and
  context menu register before the fallible icon and style setup - a failure
  there can no longer take the whole plugin down.

## [1.0.1] - 2026-08-01

### Fixed

- Point `authorUrl` at the GitHub profile.

## [1.0.0] - 2026-08-01

Initial release.

### Added

- Right-click a callout to change its icon, color, title, and fold state.
- Icon picker covering every Lucide icon the running Obsidian build ships,
  searchable by name and by Lucide's official tag metadata, grouped into 46
  categories.
- Theme-aware color swatches, a color picker, and a hex field.
- Custom SVG icons, imported by pasting markup or picking an `.svg` file from
  the vault. Input is sanitized to a whitelist of shape elements and attributes.
- Presets: save a look and reapply it from the right-click menu.
- Custom callout types: promote a look to a real `[!type]`, written to
  `.obsidian/snippets/callout-customizer.css` so it survives the plugin being
  disabled.
- Commands for customizing the callout at the cursor, cycling fold state, and
  removing customization.
- Settings for the context menu, recent icons, icon grid size, and management of
  custom icons, presets, and custom types.

### Notes

- Customizations are stored as inline callout metadata (`> [!note|i:star c:e41bde]`),
  so they travel with the file and survive sync and export.
- Metadata tokens the plugin does not own are preserved unchanged.

[Unreleased]: ../../compare/1.0.2...HEAD
[1.0.2]: ../../compare/1.0.1...1.0.2
[1.0.1]: ../../compare/1.0.0...1.0.1
[1.0.0]: ../../releases/tag/1.0.0
