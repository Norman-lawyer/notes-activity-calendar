// Read-only diagnostic harness. The installed bundle runs against an in-memory vault.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const moment = require('moment');
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
  get isConnected() { return this.root || !!this.parent?.isConnected; }
  getBoundingClientRect() { return { left: 30, right: 190, top: 70, bottom: 100, width: 160, height: 30 }; }
}
class Events { constructor() { this.handlers = new Map(); } on(name, fn) { const ref = { e: this, name, fn }; if (!this.handlers.has(name)) this.handlers.set(name, new Set()); this.handlers.get(name).add(ref); return ref; } offref(ref) { this.handlers.get(ref.name)?.delete(ref); } }
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
const obsidian = { Plugin, ItemView, TFile, TFolder, PluginSettingTab: class {}, FuzzySuggestModal: class {}, Notice: class {}, moment, normalizePath: value => value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, ''), getAllTags: cache => cache.tags || [], setIcon() {} };
const sandbox = { module: { exports: {} }, require: name => { if (name !== 'obsidian') throw Error('Unexpected module: '+name); return obsidian; }, document: { body }, window: { innerWidth: 1024, innerHeight: 768, setTimeout, clearTimeout }, console };
vm.runInNewContext(fs.readFileSync(installed, 'utf8'), sandbox);
const Calendar = sandbox.module.exports.default;
async function fixture(files = [], options = {}) {
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
  const plugin = new Calendar(app); await plugin.onload(); plugin.settings.looseDailyMatch = true;
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
  const report = { source: installed, usesStagedBundle: true, vaultIsInMemory: true, results };
  if (results.some(result => result.passed === false && !result.classification)) process.exitCode = 1;
  console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
