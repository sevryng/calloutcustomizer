/**
 * Round-trip tests for the callout parser, colour helpers, and stylesheet
 * manager.
 *
 * These modules are pure (no `obsidian` imports), so they can be bundled and
 * run under plain node:  npm test
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const outDir = mkdtempSync(join(tmpdir(), 'cc-test-'));
const outFile = join(outDir, 'bundle.mjs');

// A virtual barrel module, so both files land in one bundle.
await esbuild.build({
	stdin: {
		contents: [
			"export * from './src/utils/callout';",
			"export * from './src/utils/colors';",
			"export * from './src/utils/styles';",
			"export * from './src/utils/dedupe';",
		].join('\n'),
		resolveDir: process.cwd(),
		loader: 'ts',
	},
	bundle: true,
	format: 'esm',
	target: 'es2021',
	outfile: outFile,
	logLevel: 'silent',
});

const {
	parseCalloutLine,
	serializeCalloutLine,
	buildMeta,
	parseMeta,
	defaultIconFor,
	isBlockquoteLine,
	normalizeHex,
	hexToCssColor,
	hexToRgbTriplet,
	cssColorToHex,
	StyleManager,
	dedupeById,
} = await import(pathToFileURL(outFile).href);

let passed = 0;
const failures = [];

function check(label, fn) {
	try {
		fn();
		passed++;
	} catch (error) {
		failures.push(`${label}: ${error.message}`);
	}
}

/* ---------- parsing ---------- */

check('plain callout', () => {
	const state = parseCalloutLine('> [!note] Hello');
	assert.equal(state.type, 'note');
	assert.equal(state.title, 'Hello');
	assert.equal(state.fold, '');
	assert.equal(state.icon, '');
	assert.equal(state.color, '');
});

check('callout with no title', () => {
	const state = parseCalloutLine('> [!warning]');
	assert.equal(state.type, 'warning');
	assert.equal(state.title, '');
});

check('fold states', () => {
	assert.equal(parseCalloutLine('> [!tip]- Collapsed').fold, '-');
	assert.equal(parseCalloutLine('> [!tip]+ Open').fold, '+');
	assert.equal(parseCalloutLine('> [!tip] Plain').fold, '');
});

check('icon and colour metadata', () => {
	const state = parseCalloutLine('> [!note|i:star c:e07b39] Titled');
	assert.equal(state.icon, 'star');
	assert.equal(state.color, 'e07b39');
	assert.equal(state.title, 'Titled');
});

check('uppercase hex is normalized', () => {
	assert.equal(parseCalloutLine('> [!note|c:E07B39] x').color, 'e07b39');
});

check('unknown metadata is preserved', () => {
	const state = parseCalloutLine('> [!note|left i:star] T');
	assert.deepEqual(state.extraMeta, ['left']);
	assert.equal(serializeCalloutLine(state), '> [!note|i:star left] T');
});

check('nested callouts keep their prefix', () => {
	const state = parseCalloutLine('> > [!info|i:bug] Nested');
	assert.equal(state.prefix, '> > ');
	assert.equal(state.type, 'info');
	assert.equal(serializeCalloutLine(state), '> > [!info|i:bug] Nested');
});

check('indented callouts parse', () => {
	assert.equal(parseCalloutLine('  > [!note] Indented').type, 'note');
});

check('hyphenated custom types parse', () => {
	assert.equal(parseCalloutLine('> [!my-custom] Hi').type, 'my-custom');
});

check('non-callouts are rejected', () => {
	for (const line of [
		'> just a quote',
		'plain text',
		'',
		'> [not a callout]',
		'- [ ] a task',
	]) {
		assert.equal(parseCalloutLine(line), null, `should reject: ${line}`);
	}
});

check('blockquote detection', () => {
	assert.equal(isBlockquoteLine('> body'), true);
	assert.equal(isBlockquoteLine('   > body'), true);
	assert.equal(isBlockquoteLine('body'), false);
});

/* ---------- round trip ---------- */

check('round trip is lossless', () => {
	const samples = [
		'> [!note] Hello',
		'> [!note]',
		'> [!tip]- Collapsed',
		'> [!tip]+ Open',
		'> [!note|i:star] Titled',
		'> [!note|i:star c:e07b39] Titled',
		'> [!danger|c:ff0000]- Watch out',
		'> > [!info|i:bug] Nested',
		'   > [!note|i:flame] Indented',
	];

	for (const line of samples) {
		assert.equal(serializeCalloutLine(parseCalloutLine(line)), line, line);
	}
});

check('round trip is idempotent', () => {
	const once = serializeCalloutLine(parseCalloutLine('> [!note|i:star c:E07B39] X'));
	const twice = serializeCalloutLine(parseCalloutLine(once));
	assert.equal(once, '> [!note|i:star c:e07b39] X');
	assert.equal(twice, once);
});

check('clearing styling drops the pipe entirely', () => {
	const state = parseCalloutLine('> [!note|i:star c:e07b39] X');
	state.icon = '';
	state.color = '';
	assert.equal(serializeCalloutLine(state), '> [!note] X');
});

check('metadata token order is stable', () => {
	assert.equal(
		buildMeta({ icon: 'star', color: 'e07b39', extraMeta: [] }),
		'i:star c:e07b39',
	);
});

check('metadata tokens are space separated for ~= matching', () => {
	// The generated CSS relies on whole-token matching, so a token must never
	// contain a space and the separator must be a single space.
	const meta = buildMeta({ icon: 'star', color: 'e07b39', extraMeta: ['left'] });
	assert.deepEqual(meta.split(' '), ['i:star', 'c:e07b39', 'left']);
});

check('parseMeta ignores empty input', () => {
	assert.deepEqual(parseMeta(''), { icon: '', color: '', extra: [] });
});

/* ---------- colours ---------- */

check('hex normalization', () => {
	assert.equal(normalizeHex('#E07B39'), 'e07b39');
	assert.equal(normalizeHex('abc'), 'aabbcc');
	assert.equal(normalizeHex('#abc'), 'aabbcc');
	assert.equal(normalizeHex('nope'), '');
	assert.equal(normalizeHex(''), '');
	assert.equal(normalizeHex(null), '');
});

check('callout colours are emitted as CSS colours, not RGB triplets', () => {
	// Regression guard: Obsidian ignores a bare "r, g, b" here, which reads as
	// "colours silently do nothing while icons work".
	assert.equal(hexToCssColor('e41bde'), '#e41bde');
	assert.equal(hexToCssColor('#E41BDE'), '#e41bde');
	assert.equal(hexToCssColor('abc'), '#aabbcc');
	assert.equal(hexToCssColor('garbage'), '');
	assert.match(hexToCssColor('e41bde'), /^#[0-9a-f]{6}$/);
});

check('rgb triplet conversion', () => {
	assert.equal(hexToRgbTriplet('#e07b39'), '224, 123, 57');
	assert.equal(hexToRgbTriplet('#000000'), '0, 0, 0');
	assert.equal(hexToRgbTriplet('#ffffff'), '255, 255, 255');
	assert.equal(hexToRgbTriplet('garbage'), '');
});

check('css colour parsing', () => {
	assert.equal(cssColorToHex('#e07b39'), 'e07b39');
	assert.equal(cssColorToHex('224, 123, 57'), 'e07b39');
	assert.equal(cssColorToHex('rgb(224 123 57)'), 'e07b39');
	assert.equal(cssColorToHex('300, -5, 57'), 'ff0039');
	assert.equal(cssColorToHex(''), '');
});

/* ---------- defaults ---------- */

check('default icons resolve', () => {
	assert.equal(defaultIconFor('note'), 'pencil');
	assert.equal(defaultIconFor('WARNING'), 'alert-triangle');
	assert.equal(defaultIconFor('totally-unknown'), 'pencil');
});

/* ---------- stylesheet manager ---------- */

/** Minimal `document`-shaped stub: a head that tracks appended elements. */
function makeDocStub() {
	const head = {
		children: [],
		appendChild(el) {
			head.children.push(el);
		},
	};

	function createElement() {
		const el = { id: '', textContent: '' };
		el.remove = () => {
			const index = head.children.indexOf(el);
			if (index >= 0) head.children.splice(index, 1);
		};
		return el;
	}

	return { head, createElement };
}

check('StyleManager.load appends exactly one style element to head', () => {
	globalThis.activeDocument = makeDocStub();
	const manager = new StyleManager();
	manager.load({ names: ['star', 'bug'], customSvg: new Map() }, []);
	assert.equal(activeDocument.head.children.length, 1);
	assert.equal(activeDocument.head.children[0].id, 'callout-customizer-styles');
});

check('StyleManager.load writes an icon rule for each icon name', () => {
	globalThis.activeDocument = makeDocStub();
	const manager = new StyleManager();
	manager.load({ names: ['star', 'bug'], customSvg: new Map() }, []);
	const css = activeDocument.head.children[0].textContent;
	assert.match(css, /\[data-callout-metadata~="i:star"\]\{--callout-icon:lucide-star;\}/);
	assert.match(css, /\[data-callout-metadata~="i:bug"\]\{--callout-icon:lucide-bug;\}/);
});

check('StyleManager.load writes a colour rule for each known colour', () => {
	globalThis.activeDocument = makeDocStub();
	const manager = new StyleManager();
	manager.load({ names: [], customSvg: new Map() }, ['e07b39']);
	const css = activeDocument.head.children[0].textContent;
	assert.match(css, /\[data-callout-metadata~="c:e07b39"\]\{--callout-color:#e07b39;\}/);
});

check('StyleManager.registerColor adds a new rule once and reports duplicates', () => {
	globalThis.activeDocument = makeDocStub();
	const manager = new StyleManager();
	manager.load({ names: [], customSvg: new Map() }, []);
	assert.equal(manager.registerColor('ff0000'), true);
	assert.equal(manager.registerColor('ff0000'), false);
	assert.match(activeDocument.head.children[0].textContent, /c:ff0000/);
});

check('StyleManager.unload removes the style element from head', () => {
	globalThis.activeDocument = makeDocStub();
	const manager = new StyleManager();
	manager.load({ names: [], customSvg: new Map() }, []);
	manager.unload();
	assert.equal(activeDocument.head.children.length, 0);
});

/* ---------- dedupe ---------- */

check('dedupeById drops earlier duplicates, keeping the last write', () => {
	const result = dedupeById([
		{ id: 'test-3', name: 'test 3 (old)' },
		{ id: 'test', name: 'test' },
		{ id: 'test-3', name: 'test 3 (new)' },
	]);
	assert.deepEqual(result, [
		{ id: 'test-3', name: 'test 3 (new)' },
		{ id: 'test', name: 'test' },
	]);
});

check('dedupeById leaves an array with no duplicates unchanged', () => {
	const items = [{ id: 'a' }, { id: 'b' }];
	assert.deepEqual(dedupeById(items), items);
});

rmSync(outDir, { recursive: true, force: true });

if (failures.length) {
	for (const failure of failures) console.error('FAIL:', failure);
	console.error(`\n${failures.length} failed, ${passed} passed`);
	process.exit(1);
}

console.log(`${passed} checks passed`);
