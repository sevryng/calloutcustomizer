/**
 * Build the plugin and install it into the local test vault under a
 * separate id (callout-customizer-dev), so it can never collide with the
 * real, community-listed "callout-customizer" plugin id in that vault.
 *
 * Usage: npm run sync:dev-vault
 */

import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const VAULT_PLUGIN_DIR = join(
	'dev-sandbox-obs',
	'.obsidian',
	'plugins',
	'callout-customizer-dev',
);

execSync('npm run build', { stdio: 'inherit' });

mkdirSync(VAULT_PLUGIN_DIR, { recursive: true });

copyFileSync('main.js', join(VAULT_PLUGIN_DIR, 'main.js'));
copyFileSync('styles.css', join(VAULT_PLUGIN_DIR, 'styles.css'));

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
manifest.id = 'callout-customizer-dev';
manifest.name = 'Callout Customizer (DEV)';
writeFileSync(join(VAULT_PLUGIN_DIR, 'manifest.json'), JSON.stringify(manifest, null, '\t'));

console.log(`Synced to ${VAULT_PLUGIN_DIR}. Reload the plugin (or the app) in Obsidian to pick it up.`);
