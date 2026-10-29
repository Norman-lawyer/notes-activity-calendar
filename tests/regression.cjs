// Read-only diagnostic harness. The installed bundle runs against an in-memory vault.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
// Use the same pinned Moment version as Obsidian's public API types.
const { createRequire } = require('node:module');
const moment = createRequire(require.resolve('obsidian/package.json'))('moment');
const assert = require('node:assert/strict');
process.env.TZ = 'Asia/Shanghai';
moment.now = () => Date.parse('2026-10-28T12:00:00+08:00');
const installed = path.join(__dirname, '..', 'main.js');
class Element {
  constructor(tag = 'div', options = {}) { this.tagName = tag.toUpperCase(); this.children = []; this.parent = null; this.className = options.cls || ''; this.text = options.text || ''; this.style = {}; this.attrs = {}; this.offsetWidth = 160; }
  setAttribute(name, value) { this.attrs[name] = value; }
  createEl(tag, options = {}) { const child = new Element(tag, options); child.parent = this; this.children.push(child); return child; }
  createDiv(options) { return this.createEl('div', options); }
  createSpan(options) { return this.createEl('span', options); }
  empty() { for (const child of this.children) child.parent = null; this.children = []; }
  addClass(name) { this.className += ' ' + name; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
  contains(target) { return this === target || this.children.some(child => child.contains(target)); }
  querySelector(selector) { const names = selector.split('.').filter(Boolean); for (const child of this.children) { if (names.every(name => child.className.split(' ').includes(name))) return child; const match = child.querySelector(selector); if (match) return match; } return null; }
  focus() { this.focused = true; }
  get isConnected() { return this.root || !!this.parent?.isConnected; }
  getBoundingClientRect() { return { left: 30, right: 190, top: 70, bottom: 100, width: 160, height: 30 }; }
}
class Events { constructor() { this.handlers = new Map(); } on(name, fn) { const ref = { e: this, name, fn }; if (!this.handlers.has(name)) this.handlers.set(name, new Set()); this.handlers.get(name).add(ref); return ref; } offref(ref) { this.handlers.get(ref.name)?.delete(ref); } emit(name, ...args) { for (const ref of this.handlers.get(name) || []) ref.fn(...args); } }
class TFile {
  constructor(filePath, content = '') { this.path = filePath; this.name = filePath.split('/').pop(); this.basename = this.name.replace(/\.md$/, ''); this.extension = 'md'; this.parent = { path: filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '/' }; this.content = content; this.stat = { ctime: moment.now(), mtime: moment.now(), size: content.length }; }
}
class TFolder { constructor(folderPath) { this.path = folderPath; this.name = folderPath.split('/').pop(); this.children = []; } }
class Plugin {
  constructor(app) { this.app = app; this.disposers = []; }
  register(fn) { this.disposers.push(fn); }
  registerEvent(ref) { this.register(() => ref.e.offref(ref)); }
  registerView(type, factory) { this.viewFactory = factory; }
  addRibbonIcon() {} addCommand() {} addSettingTab() {}
  async loadData() { return {}; }
  async saveData(value) { this.saved = value; }
}
class ItemView { constructor(leaf) { this.app = leaf.app; this.contentEl = new Element(); this.contentEl.root = true; } registerDomEvent() {} }
const body = new Element('body'); body.root = true;
const notices = [];
const clipboardWrites = [];
const clipboard = { async writeText(value) { clipboardWrites.push(value); } };
const obsidian = { Plugin, ItemView, TFile, TFolder, PluginSettingTab: class {}, FuzzySuggestModal: class {}, Notice: class { constructor(message) { notices.push(message); } }, moment, normalizePath: value => value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, ''), getAllTags: cache => cache.tags || [], setIcon() {} };
const sandbox = { module: { exports: {} }, require: name => { if (name !== 'obsidian') throw Error('Unexpected module: '+name); return obsidian; }, document: { body }, Node: Element, navigator: { clipboard }, window: { innerWidth: 1024, innerHeight: 768, setTimeout, clearTimeout }, console };
vm.runInNewContext(fs.readFileSync(installed, 'utf8'), sandbox);
const Calendar = sandbox.module.exports.default;
async function fixture(files = [], options = {}, savedData = {}) {
  const records = new Map(files.map(file => [file.path, file]));
  const vault = Object.assign(new Events(), {
    getAbstractFileByPath: key => records.get(key) || null,
    getMarkdownFiles: () => [...records.values()].filter(file => file instanceof TFile),
    getRoot: () => ({ path: '/', children: [] }),
    create: async (filePath, content) => { if (records.has(filePath)) throw Error('Already exists'); const file = new TFile(filePath, content); records.set(filePath, file); return file; },
    createFolder: async filePath => records.set(filePath, new TFolder(filePath)),
    read: async file => file.content
  });
  const metadataCache = Object.assign(new Events(), { getFileCache: file => file.cache || {}, getTags: () => ({}) });
  const opened = [];
  const app = { vault, metadataCache, internalPlugins: { getPluginById: () => ({ instance: { options } }) }, workspace: { onLayoutReady() {}, getLeavesOfType: () => [], getLeaf: () => ({ openFile: async file => opened.push(file.path) }) } };
  const plugin = new Calendar(app); plugin.loadData = async () => savedData; await plugin.onload(); plugin.settings.looseDailyMatch = true;
  const view = plugin.viewFactory({ app });
  return { plugin, view, app, records, opened };
}
const results = [];
function check(id, scenario, actual, expected) { results.push({ id, scenario, expected, actual, passed: JSON.stringify(actual) === JSON.stringify(expected) }); }
(async () => {
  let f = await fixture([new TFile('Journal/Archive/2026-10-28-old.md'), new TFile('Journal/Current/2026-10-28-entry.md')], { folder: 'Journal/Current', format: 'YYYY-MM-DD' });
  check('daily-folder-scope', 'Loose matching must stay in the configured daily-note folder', f.plugin.getDailyNote(moment('2026-10-28')).path, 'Journal/Current/2026-10-28-entry.md');
  f = await fixture([new TFile('Journal/2025/10-28-old.md'), new TFile('Journal/2026/10-28-entry.md')], { folder: 'Journal', format: 'YYYY/MM-DD' });
  check('daily-year-scope', 'A year folder in the date format must not match a different year', f.plugin.getDailyNote(moment('2026-10-28')).path, 'Journal/2026/10-28-entry.md');
  f = await fixture(); f.plugin.settings.excludeFolders = ['Archive/'];
  check('exclude-trailing-slash', 'An excluded folder with a trailing slash must exclude its descendants', f.view.isExcluded('Archive/entry.md'), true);
  f = await fixture(); f.plugin.settings.useFilenameDate = false;
  await f.plugin.createPlainNote(moment('2026-10-01'), { path: '/' });
  const created = f.records.get('2026-10-01.md');
  check('selected-day-create', 'Without filename date recognition, a note is counted on its creation day', f.view.createdOf(created).format('YYYY-MM-DD'), '2026-10-28');
  f = await fixture([new TFile('Templates/daily.md', '# {{title}}')], { folder: 'Journal', format: 'YYYY/MM-DD', template: 'Templates/daily' });
  await f.plugin.createDailyNote(moment('2026-10-28'));
  check('template-title', 'The title token should use the filename rather than its year-folder path', f.records.get('Journal/2026/10-28.md').content, '# 10-28');
  f = await fixture([new TFile('2026-10-28-entry.md')]); f.view.rebuild(); f.view.render();
  const grid = f.view.contentEl.children[0].children.find(child => child.className.includes('nc-grid'));
  const cell = grid.children.find(child => child.className.includes('nc-today'));
  cell.onmouseenter(); const tooltip = f.view.tooltipEl; cell.onclick();
  check('tooltip-after-rerender', 'Clicking a hovered date must remove the tooltip anchored to the removed cell', tooltip.isConnected, false);
  f.view.dismissPopovers({ key: 'Escape', target: body });
  check('tooltip-escape', 'Escape must dismiss the visible tooltip', tooltip.isConnected, false);
  f.view.onunload();
  f = await fixture([new TFile('old-note.md')]);
  const file = f.records.get('old-note.md'); file.stat.ctime = moment('2026-10-01').valueOf(); file.stat.mtime = moment('2026-10-27').valueOf(); f.view.rebuild();
  const priorCount = f.view.modifiedMap.get('2026-10-27')?.length || 0;
  f.plugin.recordModification(file); file.stat.mtime = moment('2026-10-28').valueOf(); f.plugin.recordModification(file); await f.plugin.saveQueue; f.view.rebuild();
  results.push({ id: 'history-limit', scenario: 'Previous modification date remains after a later edit', before: priorCount, after: f.view.modifiedMap.get('2026-10-27')?.length || 0, today: f.view.modifiedMap.get('2026-10-28')?.length || 0, classification: 'history retention' });
  check('history-retained', 'Prior day remains after a later edit', f.view.modifiedMap.get('2026-10-27')?.length || 0, 1);
  check('history-persisted', 'Both days are saved', Object.keys(f.plugin.saved.activityHistory).sort(), ['2026-10-27','2026-10-28']);
  f.plugin.renameHistory('old-note.md', 'renamed.md'); await f.plugin.saveQueue;
  check('history-rename', 'Renaming moves every day of history', Object.values(f.plugin.history).every(entries => entries['renamed.md'] && !entries['old-note.md']), true);
  const saved = JSON.parse(JSON.stringify(f.plugin.saved));
  const restarted = await fixture(); restarted.plugin.loadData = async () => saved; await restarted.plugin.loadSettings();
  check('history-restart', 'History survives plugin restart', restarted.plugin.history, saved.activityHistory);
  f = await fixture([new TFile('2026-10-28-entry.md')]); f.view.rebuild(); f.view.render();
  const title = f.view.contentEl.children[0].children[0].children.find(child => child.className.includes('nc-title'));
  const grid2 = f.view.contentEl.children[0].children.find(child => child.className.includes('nc-grid'));
  const day = grid2.children.find(child => child.className.includes('nc-today'));
  check('semantic-buttons', 'Month picker and dates are keyboard-accessible buttons', [title.tagName, day.tagName, !!day.attrs['aria-label']], ['BUTTON', 'BUTTON', true]);
  day.onmouseenter(); const freshTip = f.view.tooltipEl; f.view.dismissPopovers({ key: 'Escape', target: body });
  check('escape-active-tooltip', 'Escape closes an active tooltip', freshTip.isConnected, false);
  // Verify that the preserved lunar feature still renders a bundled-library result.
  const lunarCell = day.children.find(child => child.className.includes('nc-lunar'));
  check('lunar-preserved', 'A lunar label is rendered for a normal calendar date', !!lunarCell?.text, true);

  day.onclick({ detail: 0 });
  check('keyboard-focus', 'Keyboard date activation restores focus after rerendering the grid', f.view.contentEl.querySelector('.nc-cell.nc-sel').focused, true);

  f = await fixture([new TFile('Journal::2026/entry.md')]);
  const taggedFile = f.records.get('Journal::2026/entry.md');
  taggedFile.cache = { tags: ['#topic::detail'], frontmatter: { date: { unsafe: 'object' }, created: ['not-a-date'] } };
  check('frontmatter-nonscalar', 'Object and array frontmatter cannot become invalid date coercions', f.view.createdOf(taggedFile).format('YYYY-MM-DD'), '2026-10-28');
  const filterRoot = new Element(); f.view.renderFilter(filterRoot);
  const selector = filterRoot.children[0].children[0];
  selector.value = 'tag::#topic::detail'; selector.onchange();
  check('tag-delimiter', 'A tag containing the filter delimiter is preserved and matches', [f.view.filter.value, f.view.passesFilter(taggedFile)], ['#topic::detail', true]);
  selector.value = 'folder::Journal::2026'; selector.onchange();
  check('folder-delimiter', 'A folder containing the filter delimiter is preserved and matches', [f.view.filter.value, f.view.passesFilter(taggedFile)], ['Journal::2026', true]);

  // Persisted plugin data is an untrusted boundary, including data synced from another device.
  const badSettings = {
    weekStartMonday: 'false', useFilenameDate: null, looseDailyMatch: [], showLunar: 0,
    heatmap: {}, showStats: 'yes', hoverPreview: 1, showFilter: null,
    excludeFolders: [null, 123, {}, 'Archive'],
    frontmatterDateFields: [false, null, 'date'], hoverMaxItems: 2.5,
    surprise: 'must not survive loading', activityHistory: []
  };
  f = await fixture([], {}, badSettings);
  check('settings-booleans', 'Nonboolean saved settings use defaults instead of truthiness coercion',
    [f.plugin.settings.weekStartMonday, f.plugin.settings.useFilenameDate, f.plugin.settings.showLunar,
      f.plugin.settings.heatmap, f.plugin.settings.showStats, f.plugin.settings.hoverPreview, f.plugin.settings.showFilter],
    [true, true, true, true, true, true, false]);
  check('settings-arrays', 'Only string values enter list settings',
    [f.plugin.settings.excludeFolders, f.plugin.settings.frontmatterDateFields], [['Archive'], ['date']]);
  check('settings-limit', 'A fractional hover limit falls back to the safe default', f.plugin.settings.hoverMaxItems, 6);
  check('settings-unknown-fields', 'Unknown settings and history are not retained inside settings',
    ['surprise' in f.plugin.settings, 'activityHistory' in f.plugin.settings], [false, false]);
  for (const value of [null, false, 4, 'bad', []]) {
    f.plugin.loadData = async () => value; await f.plugin.loadSettings();
    check('settings-top-level-' + JSON.stringify(value), 'Malformed top-level saved data does not break defaults',
      [f.plugin.settings.weekStartMonday, Object.keys(f.plugin.history).length], [true, 0]);
  }
  for (const value of [-1, 0, 51, Infinity, NaN, '6']) {
    f.plugin.loadData = async () => ({ hoverMaxItems: value }); await f.plugin.loadSettings();
    check('settings-hover-' + String(value), 'Out-of-range or nonnumeric hover limits use the default', f.plugin.settings.hoverMaxItems, 6);
  }
  const poison = JSON.parse('{' +
    '"__proto__":{"polluted":true},' +
    '"2026-02-30":{"invalid-date.md":123},' +
    '"not-a-date":{"invalid-key.md":123},' +
    '"2026-10-27":{' +
      '"good.md":1793066400000,"../escape.md":123,"/absolute.md":123,' +
      '"C:/outside.md":123,"__proto__/evil.md":123,"constructor/evil.md":123,' +
      '"prototype/evil.md":123,"__proto__":{"polluted":true},"wrong-type.md":"123","negative.md":-1,' +
      '"not-markdown.txt":123,"nested.md":{"mtime":123}}}');
  poison['2026-10-27']['infinite.md'] = Infinity;
  poison['2026-10-27']['nan.md'] = NaN;
  f.plugin.loadData = async () => ({ activityHistory: poison }); await f.plugin.loadSettings();
  check('history-sanitize', 'Only valid day, safe Markdown path and finite nonnegative timestamp records survive',
    f.plugin.history, { '2026-10-27': { 'good.md': 1793066400000, '__proto__/evil.md': 123, 'constructor/evil.md': 123, 'prototype/evil.md': 123 } });
  check('history-prototype-keys', 'Loaded history rejects dangerous exact prototype keys while preserving normal flat file paths',
    [Object.prototype.hasOwnProperty.call(f.plugin.history, '__proto__'),
      Object.prototype.hasOwnProperty.call(f.plugin.history['2026-10-27'], '__proto__')], [false, false]);
  check('history-no-pollution', 'Untrusted history cannot pollute ordinary object prototypes', {}.polluted, undefined);

  // Malformed host/plugin payloads must not become a vault-relative escape or template read.
  f = await fixture([], { folder: '../outside', format: '../YYYY-MM-DD', template: '../secret' });
  let templateReads = 0;
  f.app.vault.read = async () => { templateReads++; return 'secret'; };
  await assert.rejects(f.plugin.createDailyNote(moment('2026-10-28')), 'Unsafe string options must reject, not silently write at the vault root');
  check('daily-invalid-no-writes', 'Invalid daily settings never silently redirect creation to the vault root', [...f.records.keys()], []);
  check('daily-path-escape', 'Malformed configured paths cannot escape the vault or create traversal segments',
    [...f.records.keys()].some(key => key.startsWith('/') || key.split('/').some(part => part === '..' || part === '.')), false);
  check('daily-template-escape', 'An invalid template location is never read', templateReads, 0);
  f = await fixture([], { folder: 'Journal/', format: 'YYYY-MM-DD' });
  check('daily-trailing-folder', 'A harmless trailing folder slash preserves the configured journal directory', f.plugin.dailyOptions().folder, 'Journal');
  await f.plugin.createDailyNote(moment('2026-10-28'));
  check('daily-trailing-folder-write', 'Daily note creation stays in the configured directory', f.records.has('Journal/2026-10-28.md'), true);
  for (const options of [
    { format: '[..]/YYYY-MM-DD' }, { folder: '../outside' }, { template: '../secret' }
  ]) {
    f = await fixture([], options);
    check('daily-invalid-lookup-' + JSON.stringify(options), 'Invalid configured or rendered paths do not crash daily note lookup', f.plugin.getDailyNote(moment('2026-10-28')), null);
    f.view.rebuild();
    assert.doesNotThrow(() => f.view.render(), 'Invalid daily-note configuration must not crash the whole calendar');
    await assert.rejects(f.plugin.createDailyNote(moment('2026-10-28')), 'Invalid daily configuration must reject before creating files');
    check('daily-invalid-create-' + JSON.stringify(options), 'Invalid configurations produce no note or folder writes', [...f.records.keys()], []);
  }
  const reservedPaths = ['constructor/note.md', 'prototype/note.md', '__proto__/note.md'];
  f = await fixture(reservedPaths.map(filePath => new TFile(filePath)));
  check('history-reserved-folder-names', 'Legitimate folders named after prototype properties remain indexed', Object.keys(f.plugin.history['2026-10-28']).sort(), reservedPaths.slice().sort());

  for (const options of [null, 'bad', [], { folder: {}, format: 123, template: false }]) {
    f.app.internalPlugins = { getPluginById: () => ({ instance: { options } }) };
    check('daily-options-' + JSON.stringify(options), 'Malformed core daily-note options fall back safely',
      f.plugin.dailyOptions(), { folder: '', format: 'YYYY-MM-DD', template: '' });
  }
  for (const registry of [null, {}, { getPluginById: 'not callable' }]) {
    f.app.internalPlugins = registry;
    check('daily-registry-' + JSON.stringify(registry), 'A missing or malformed core plugin registry does not throw',
      f.plugin.dailyOptions(), { folder: '', format: 'YYYY-MM-DD', template: '' });
  }

  // Nonfinite timestamps and invalid event payloads must not be written to persistent history.
  f = await fixture();
  const invalidFile = new TFile('invalid.md');
  for (const timestamp of [NaN, Infinity, -1]) {
    invalidFile.stat.mtime = timestamp; f.plugin.recordModification(invalidFile);
  }
  f.plugin.recordModification(null); f.plugin.recordModification({ path: 'fake.md', stat: { mtime: moment.now() } });
  await f.plugin.saveQueue;
  check('history-invalid-event', 'Invalid modification events are ignored', Object.keys(f.plugin.history), []);

  // A rejected disk save must not permanently poison the serialized save queue.
  const originalError = console.error;
  const expectedErrors = [];
  console.error = (...args) => expectedErrors.push(args.map(String).join(' '));
  try {
    let saveCalls = 0;
    const snapshots = [];
    f.plugin.saveData = async snapshot => {
      saveCalls++;
      if (saveCalls === 1) throw new Error('Simulated transient write failure');
      snapshots.push(snapshot);
    };
    f.plugin.settings.showLunar = false;
    const failedSave = f.plugin.persistData();
    f.plugin.settings.showLunar = true;
    const recoveredSave = f.plugin.persistData();
    const outcomes = await Promise.allSettled([failedSave, recoveredSave]);
    check('save-queue-recovery', 'The next save succeeds after an earlier disk write failed',
      outcomes.map(result => result.status), ['rejected', 'fulfilled']);
    check('save-queue-latest', 'The recovered save includes the latest settings', snapshots[0].showLunar, true);
    f.plugin.runAction(() => Promise.reject(new Error('Simulated UI failure')));
    await new Promise(resolve => setImmediate(resolve));
    check('action-rejection-handled', 'An asynchronous UI failure is logged instead of becoming an unhandled rejection',
      expectedErrors.some(message => message.includes('Simulated UI failure')), true);
  } finally { console.error = originalError; }

  // Reading/rendering a calendar never touches the clipboard; copy is a user-triggered write only.
  f = await fixture(); f.view.rebuild(); f.view.render();
  check('clipboard-passive', 'Rendering does not access or overwrite the clipboard', clipboardWrites.length, 0);
  f.view.showDayMenu({ clientX: 20, clientY: 30 }, moment('2026-10-28'));
  check('clipboard-menu', 'Opening a context menu does not overwrite the clipboard', clipboardWrites.length, 0);
  const copyItem = f.view.menuEl.children.find(item => item.children.some(child => child.text.startsWith('复制日期')));
  assert.ok(copyItem, 'The date-copy feature must remain available');
  copyItem.onclick({ stopPropagation() {} });
  await new Promise(resolve => setImmediate(resolve));
  check('clipboard-explicit-copy', 'Only an explicit copy action writes the selected ISO date', clipboardWrites, ['2026-10-28']);
  const noticesBeforeDeniedCopy = notices.length;
  clipboard.writeText = async () => { throw new Error('Clipboard permission denied'); };
  console.error = () => {};
  try {
    f.view.showDayMenu({ clientX: 20, clientY: 30 }, moment('2026-10-28'));
    const deniedCopy = f.view.menuEl.children.find(item => item.children.some(child => child.text.startsWith('复制日期')));
    deniedCopy.onclick({ stopPropagation() {} });
    await new Promise(resolve => setImmediate(resolve));
    check('clipboard-denied', 'A denied clipboard write is handled and reported without an unhandled rejection', notices.length > noticesBeforeDeniedCopy, true);
  } finally { console.error = originalError; }

  const report = { source: installed, usesStagedBundle: true, vaultIsInMemory: true, results };
  if (results.some(result => result.passed === false && !result.classification)) process.exitCode = 1;
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
