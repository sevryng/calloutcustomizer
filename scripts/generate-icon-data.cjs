// Generates the compact icon dataset blob that gets inlined into main.js
const fs = require('fs');
const tags = require(process.cwd() + '/node_modules/lucide-static/tags.json');
const nodes = require(process.cwd() + '/node_modules/lucide-static/icon-nodes.json');

const names = Object.keys(nodes).sort();

// Official Lucide category names (lucide.dev/icons). Lucide does not publish
// categories.json to npm, so assignments below are derived from each icon's
// name + official tag metadata. Users can drop the official categories.json
// into the plugin folder to override this entirely.
const RULES = {
  accessibility: ['accessibility', 'wheelchair', 'ear', 'eye-off', 'braille', 'sign-language', 'assistive', 'blind', 'deaf', 'ear-off', 'hearing'],
  account: ['user', 'person', 'profile', 'account', 'avatar', 'login', 'logout', 'log-in', 'log-out', 'id-card', 'contact', 'badge', 'sign-in', 'sign-out'],
  animals: ['dog', 'cat', 'bird', 'fish', 'rabbit', 'turtle', 'snail', 'bug', 'squirrel', 'rat', 'mouse-pointer-ban', 'worm', 'shrimp', 'egg', 'feather', 'paw', 'panda', 'origami', 'cow', 'horse', 'pig', 'shell', 'bone', 'ham'],
  arrows: ['arrow', 'chevron', 'caret', 'move-', 'corner-', 'redo', 'undo', 'refresh', 'rotate', 'repeat', 'shuffle', 'iteration', 'step-forward', 'step-back', 'fold', 'unfold', 'expand', 'shrink', 'maximize', 'minimize', 'import', 'export'],
  brands: ['github', 'gitlab', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'twitch', 'slack', 'figma', 'chrome', 'codepen', 'dribbble', 'framer', 'trello', 'codesandbox', 'gitea', 'nfc', 'bitcoin', 'ethereum', 'apple', 'paypal'],
  buildings: ['building', 'house', 'home', 'hotel', 'church', 'castle', 'factory', 'store', 'school', 'university', 'hospital', 'warehouse', 'landmark', 'tent', 'construction', 'fence', 'door', 'stairs', 'elevator', 'roof', 'brick', 'city', 'apartment'],
  charts: ['chart', 'graph', 'trending', 'analytics', 'histogram', 'gauge', 'activity', 'sigma', 'presentation', 'kanban', 'diagram'],
  communication: ['message', 'chat', 'phone', 'call', 'mail', 'inbox', 'send', 'reply', 'forward', 'megaphone', 'speech', 'voicemail', 'rss', 'at-sign', 'headset', 'mic', 'quote', 'comment', 'conversation'],
  connectivity: ['wifi', 'bluetooth', 'signal', 'network', 'antenna', 'radio', 'cast', 'router', 'ethernet', 'cable', 'link', 'unlink', 'plug', 'satellite', 'radar', 'rss', 'globe', 'cloud-off', 'server', 'share'],
  cursors: ['cursor', 'pointer', 'click', 'grab', 'hand', 'drag', 'crosshair', 'text-cursor', 'select'],
  currency: ['dollar', 'euro', 'pound', 'yen', 'rupee', 'ruble', 'franc', 'shekel', 'bitcoin', 'currency', 'banknote', 'coins', 'cash', 'money', 'philippine-peso', 'saudi-riyal', 'indian-rupee'],
  design: ['brush', 'palette', 'paint', 'pen', 'pencil', 'eraser', 'ruler', 'pipette', 'layers', 'crop', 'blend', 'vector', 'bezier', 'spline', 'frame', 'grid', 'align', 'stroke', 'fill', 'swatch', 'stamp', 'lasso', 'wand', 'gradient', 'contrast', 'droplet', 'shapes', 'pentool', 'bring-to-front', 'send-to-back', 'flip', 'group', 'ungroup', 'mask', 'guides'],
  development: ['code', 'terminal', 'git-', 'bug', 'binary', 'braces', 'brackets', 'variable', 'function', 'command', 'regex', 'api', 'webhook', 'container', 'component', 'sql', 'database', 'file-code', 'square-code', 'bot', 'cpu', 'blocks', 'package', 'library', 'test-tube', 'parentheses', 'chevrons-left-right', 'hash', 'sigma', 'pilcrow'],
  devices: ['phone', 'tablet', 'laptop', 'monitor', 'smartphone', 'watch', 'keyboard', 'mouse', 'printer', 'scanner', 'projector', 'tv', 'speaker', 'headphone', 'camera', 'webcam', 'gamepad', 'joystick', 'hard-drive', 'usb', 'sd-card', 'memory', 'cpu', 'server', 'router', 'battery', 'plug', 'power', 'disc', 'floppy', 'microchip', 'device', 'screen', 'appliance', 'refrigerator', 'washing-machine', 'microwave', 'air-vent', 'fan', 'lamp'],
  emoji: ['smile', 'frown', 'laugh', 'angry', 'annoyed', 'meh', 'emoji', 'face', 'heart', 'thumbs', 'party-popper', 'sparkle', 'skull', 'ghost', 'poop', 'kiss'],
  files: ['file', 'folder', 'document', 'archive', 'paperclip', 'clipboard', 'copy', 'save', 'download', 'upload', 'trash', 'binder', 'notebook', 'sheet', 'book-copy', 'newspaper', 'scroll'],
  finance: ['bank', 'wallet', 'credit-card', 'receipt', 'invoice', 'chart-candlestick', 'piggy', 'landmark', 'calculator', 'percent', 'coins', 'banknote', 'hand-coins', 'badge-dollar', 'trending', 'vault', 'safe'],
  'food-beverage': ['coffee', 'cup', 'beer', 'wine', 'martini', 'pizza', 'cake', 'apple', 'banana', 'cherry', 'grape', 'carrot', 'salad', 'sandwich', 'soup', 'egg', 'milk', 'ice-cream', 'cookie', 'croissant', 'donut', 'popcorn', 'candy', 'utensils', 'chef', 'fork', 'spoon', 'knife', 'wheat', 'bean', 'nut', 'citrus', 'dessert', 'hamburger', 'hop', 'drumstick', 'fish-', 'ham', 'torus', 'lollipop', 'bottle', 'glass-water', 'refrigerator', 'microwave', 'cooking', 'food'],
  furniture: ['sofa', 'armchair', 'bed', 'lamp', 'table', 'chair', 'door', 'shower', 'bath', 'toilet', 'blinds', 'curtain', 'closet', 'cabinet', 'mirror'],
  gaming: ['gamepad', 'joystick', 'dice', 'puzzle', 'sword', 'shield-half', 'trophy', 'target', 'crown', 'gem', 'wand', 'castle', 'ghost', 'chess', 'club', 'spade', 'diamond', 'heart-', 'rocket', 'skull', 'medal'],
  home: ['house', 'home', 'lamp', 'sofa', 'bed', 'bath', 'shower', 'toilet', 'door', 'key', 'washing', 'refrigerator', 'microwave', 'oven', 'cooking', 'vacuum', 'iron', 'blinds', 'thermometer', 'air-vent', 'fan', 'lightbulb', 'plug', 'garage', 'mailbox'],
  layout: ['layout', 'grid', 'columns', 'rows', 'panel', 'sidebar', 'table', 'align', 'split', 'stretch', 'space-', 'gallery', 'dock', 'frame', 'square-dashed', 'proportions', 'ratio', 'between'],
  mail: ['mail', 'inbox', 'send', 'envelope', 'at-sign', 'reply', 'forward', 'archive', 'spam', 'newsletter', 'mailbox', 'stamp'],
  maps: ['map', 'pin', 'location', 'navigation', 'compass', 'route', 'globe', 'flag', 'milestone', 'signpost', 'waypoint', 'earth', 'landmark', 'tent-tree', 'mountain', 'trees'],
  math: ['calculator', 'plus', 'minus', 'divide', 'equal', 'percent', 'sigma', 'pi', 'infinity', 'radical', 'superscript', 'subscript', 'variable', 'function-square', 'omega', 'square-root', 'diameter', 'chart-scatter', 'binary', 'parentheses', 'braces'],
  medical: ['pill', 'syringe', 'stethoscope', 'heart-pulse', 'hospital', 'ambulance', 'bandage', 'thermometer', 'dna', 'microscope', 'virus', 'brain', 'bone', 'tooth', 'cross', 'first-aid', 'activity', 'lungs', 'eye', 'accessibility', 'medical', 'health', 'pulse', 'clipboard-plus', 'scan-heart'],
  multimedia: ['play', 'pause', 'stop', 'skip', 'rewind', 'fast-forward', 'volume', 'music', 'audio', 'video', 'film', 'camera', 'image', 'photo', 'mic', 'headphone', 'speaker', 'disc', 'radio', 'podcast', 'subtitles', 'captions', 'clapperboard', 'tv', 'monitor-play', 'youtube', 'repeat', 'shuffle', 'list-music', 'guitar', 'piano', 'drum'],
  nature: ['tree', 'leaf', 'flower', 'sprout', 'seed', 'mountain', 'sun', 'moon', 'cloud', 'wind', 'waves', 'droplet', 'flame', 'snowflake', 'earth', 'globe', 'bug', 'bird', 'fish', 'shell', 'feather', 'cactus', 'palm', 'clover', 'forest', 'volcano', 'rainbow'],
  navigation: ['navigation', 'compass', 'map', 'route', 'menu', 'search', 'locate', 'milestone', 'signpost', 'external-link', 'anchor', 'waypoints', 'directions'],
  notifications: ['bell', 'alert', 'notification', 'badge', 'flag', 'megaphone', 'siren', 'info', 'circle-alert', 'triangle-alert', 'octagon-alert', 'message-square-warning', 'vibrate', 'bell-off'],
  people: ['user', 'users', 'person', 'people', 'baby', 'child', 'group', 'team', 'contact', 'venus', 'mars', 'transgender', 'accessibility', 'handshake', 'footprints', 'hand', 'brain', 'smile', 'crown', 'graduation'],
  photography: ['camera', 'aperture', 'focus', 'image', 'photo', 'gallery', 'film', 'flash', 'zoom', 'crop', 'exposure', 'iso', 'lens', 'scan', 'sun-medium', 'contrast', 'pipette'],
  science: ['atom', 'flask', 'test-tube', 'microscope', 'telescope', 'dna', 'magnet', 'orbit', 'rocket', 'satellite', 'radiation', 'biohazard', 'beaker', 'molecule', 'brain', 'infinity', 'radical', 'sigma', 'pi', 'thermometer', 'weight', 'scale'],
  seasons: ['snowflake', 'sun', 'leaf', 'flower', 'gift', 'party', 'candy', 'ghost', 'skull', 'tree-pine', 'sparkles', 'umbrella', 'thermometer', 'calendar'],
  security: ['lock', 'unlock', 'shield', 'key', 'fingerprint', 'scan-face', 'eye-off', 'password', 'vault', 'safe', 'user-check', 'file-lock', 'folder-lock', 'bug-off', 'siren', 'cctv', 'firewall', 'ban', 'verified', 'badge-check'],
  shapes: ['circle', 'square', 'triangle', 'hexagon', 'octagon', 'pentagon', 'diamond', 'star', 'heart', 'shape', 'rectangle', 'cylinder', 'cone', 'pyramid', 'torus', 'box', 'spline', 'slash', 'dot'],
  shopping: ['shopping', 'cart', 'basket', 'bag', 'store', 'tag', 'ticket', 'gift', 'package', 'truck', 'barcode', 'qr-code', 'receipt', 'credit-card', 'percent', 'wallet', 'shirt', 'scan-barcode'],
  social: ['share', 'heart', 'thumbs', 'star', 'bookmark', 'users', 'message', 'at-sign', 'hash', 'rss', 'link', 'send', 'follow', 'like', 'repeat', 'megaphone', 'smile', 'group'],
  sports: ['trophy', 'medal', 'goal', 'dumbbell', 'bike', 'volleyball', 'football', 'basketball', 'tennis', 'baseball', 'golf', 'ski', 'skate', 'swim', 'run', 'timer', 'stopwatch', 'flag-triangle', 'target', 'activity', 'heart-pulse', 'waves', 'sailboat', 'shirt'],
  sustainability: ['recycle', 'leaf', 'sprout', 'tree', 'wind', 'sun', 'droplet', 'battery-charging', 'bike', 'earth', 'globe', 'trash', 'fuel', 'plug-zap', 'solar', 'eco', 'biohazard', 'compost'],
  text: ['text', 'type', 'font', 'bold', 'italic', 'underline', 'strikethrough', 'heading', 'align', 'list', 'quote', 'indent', 'case', 'letter', 'spell', 'pilcrow', 'wrap', 'baseline', 'superscript', 'subscript', 'highlighter', 'whole-word', 'a-arrow', 'languages', 'signature'],
  time: ['clock', 'time', 'timer', 'alarm', 'watch', 'calendar', 'date', 'hourglass', 'history', 'stopwatch', 'schedule', 'sunrise', 'sunset'],
  tools: ['wrench', 'hammer', 'screwdriver', 'drill', 'saw', 'axe', 'pickaxe', 'shovel', 'toolcase', 'settings', 'cog', 'sliders', 'ruler', 'tape', 'paintbrush', 'scissors', 'pliers', 'nut', 'bolt', 'construction', 'hard-hat', 'gauge', 'magnet', 'wand', 'flashlight', 'ladder', 'brush'],
  transportation: ['car', 'truck', 'bus', 'train', 'bike', 'plane', 'ship', 'boat', 'sailboat', 'tram', 'taxi', 'ambulance', 'rocket', 'fuel', 'traffic', 'road', 'parking', 'anchor', 'caravan', 'forklift', 'tractor', 'scooter', 'helicopter', 'cable-car', 'wheel', 'container', 'railway'],
  travel: ['plane', 'luggage', 'briefcase', 'map', 'compass', 'passport', 'ticket', 'hotel', 'bed', 'tent', 'backpack', 'globe', 'palmtree', 'sun', 'camera', 'landmark', 'caravan', 'ship', 'train', 'earth', 'route'],
  weather: ['cloud', 'sun', 'moon', 'rain', 'snow', 'storm', 'thunder', 'lightning', 'wind', 'tornado', 'umbrella', 'thermometer', 'haze', 'fog', 'droplet', 'rainbow', 'sunrise', 'sunset', 'hurricane'],
};

const catNames = Object.keys(RULES).sort();
const assign = {};
for (const name of names) {
  const hay = name + ' ' + (tags[name] || []).join(' ');
  // Word-level tokens so short keywords ("ear") don't match "search"/"gear".
  const tokens = new Set(hay.split(/[\s-]+/).filter(Boolean));
  const match = (kw) => (kw.includes('-') ? hay.includes(kw) : tokens.has(kw) || tokens.has(kw + 's'));
  const hits = [];
  for (const cat of catNames) {
    if (RULES[cat].some(match)) hits.push(cat);
  }
  if (hits.length) assign[name] = hits;
}

const byCat = {};
for (const cat of catNames) byCat[cat] = [];
for (const [name, cats] of Object.entries(assign)) {
  for (const c of cats) byCat[c].push(name);
}
for (const c of catNames) if (!byCat[c].length) delete byCat[c];

const uncategorized = names.filter((n) => !assign[n]);

// Compact tag blob: "name:tag tag|name:tag tag"
const tagBlob = names
  .filter((n) => (tags[n] || []).length)
  .map((n) => n + ':' + tags[n].join(' '))
  .join('|');

const catBlob = Object.keys(byCat)
  .map((c) => c + ':' + byCat[c].join(' '))
  .join('|');

const header = [
  '/**',
  ' * GENERATED FILE - do not edit by hand.',
  ' *',
  ' * Regenerate with:  npm run generate:icons',
  ' * Source: the `lucide-static` npm package (dev dependency).',
  ' *',
  ' * Blobs are "key:value|key:value" strings rather than object literals purely',
  ' * for bundle size - the parsed form costs several times as much minified.',
  ' *',
  ' * LUCIDE_CATEGORY_BLOB is derived from each icon\'s official Lucide tag',
  ' * metadata, because Lucide ships categories.json only in its GitHub repo and',
  ' * not to npm. Users can override it at runtime with lucide-categories.json.',
  ' */',
  '',
  '/** icon name -> space-separated official Lucide tags. */',
  'export const LUCIDE_TAG_BLOB = ' + JSON.stringify(tagBlob) + ';',
  '',
  '/** category -> space-separated icon names. */',
  'export const LUCIDE_CATEGORY_BLOB = ' + JSON.stringify(catBlob) + ';',
  '',
  '/** Fallback list, used only when getIconIds() returns nothing. */',
  'export const LUCIDE_ALL_NAMES = ' + JSON.stringify(names.join(' ')) + ';',
  '',
].join('\n');

fs.writeFileSync(process.cwd() + '/src/utils/icon-data.ts', header);

console.log('icons:', names.length);
console.log('categories:', Object.keys(byCat).length);
console.log('uncategorized:', uncategorized.length);
console.log('blob KB:', Math.round(fs.statSync(process.cwd() + '/src/utils/icon-data.ts').size / 1024));
console.log('sample coverage:', Object.keys(byCat).map((c) => c + '=' + byCat[c].length).join(', '));
