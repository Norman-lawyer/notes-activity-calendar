const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

class Events {
  constructor() { this.listeners = new Map(); }
  on(name, callback) {
    const ref = { e: this, name, callback };
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(ref);
    return ref;
  }
  offref(ref) { this.listeners.get(ref.name)?.delete(ref); }
  emit(name) { for (const ref of this.listeners.get(name) || []) ref.callback(); }
  count() { return [...this.listeners.values()].reduce((n, refs) => n + refs.size, 0); }
}
class Plugin {
  constructor(app) { this.app = app; this.disposers = []; }
  register(callback) { this.disposers.push(callback); }
  registerEvent(ref) { this.register(() => ref.e.offref(ref)); }
  registerView(type, factory) { this.viewFactory = factory; }
  addRibbonIcon() {}
  addCommand() {}
  addSettingTab() {}
  loadData() { return Promise.resolve({}); }
  saveData() { return Promise.resolve(); }
  unload() { for (const dispose of this.disposers.splice(0)) dispose(); this.onunload(); }
}
class PluginSettingTab { constructor(app, plugin) {} }
class ItemView {
  constructor(leaf) { this.app = leaf.app; this.disposers = []; }
  registerEvent(ref) { this.disposers.push(() => ref.e.offref(ref)); }
  registerDomEvent() {}
  unload() { for (const dispose of this.disposers.splice(0)) dispose(); }
}
const moment = () => ({ startOf() { return this; } });

async function verify(sourceFile) {
  let nextTimer = 1;
  const timers = new Map();
  const fakeWindow = {
    setTimeout(callback) { const id = nextTimer++; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  const flush = () => {
    const callbacks = [...timers.values()]; timers.clear();
    for (const callback of callbacks) callback();
  };
  const vault = new Events(); vault.getMarkdownFiles = () => [];
  const metadataCache = new Events();
  const views = [];
  const app = { vault, metadataCache, workspace: {
    onLayoutReady() {}, getLeavesOfType() { return views.map(view => ({ view })); }
  }};
  const obsidian = { Plugin, PluginSettingTab, ItemView, FuzzySuggestModal: class {}, moment };
  const context = { module: { exports: {} }, require(name) {
    assert.equal(name, "obsidian"); return obsidian;
  }, window: fakeWindow, document: {}, console };
  vm.runInNewContext(fs.readFileSync(sourceFile, "utf8"), context);
  const Calendar = context.module.exports.default;
  const plugin = new Calendar(app);
  await plugin.onload();
  const view = plugin.viewFactory({ app });
  let rebuilds = 0;
  let renders = 0;
  view.rebuild = () => rebuilds++;
  view.render = () => renders++;
  if (typeof view.onload === "function") await view.onload();
  else await view.onOpen();
  assert.equal(rebuilds, 1, "view must build its initial calendar");
  views.push(view);
  // Match the observed failure: the visible view remains, but its subscriptions are gone.
  view.unload();
  const baseline = rebuilds;
  vault.emit("create"); flush();
  assert.equal(rebuilds, baseline + 1, "new notes must refresh even after view subscriptions are removed");
  for (const [emitter, name] of [[vault,"modify"],[vault,"rename"],[vault,"delete"],[metadataCache,"changed"],[metadataCache,"resolved"]]) {
    const before = rebuilds; emitter.emit(name); flush();
    assert.equal(rebuilds, before + 1, name + " should refresh");
  }
  const beforeBurst = rebuilds;
  vault.emit("create"); vault.emit("modify"); metadataCache.emit("changed");
  assert.equal(timers.size, 1, "coalesce an event burst");
  flush(); assert.equal(rebuilds, beforeBurst + 1);
  views.length = 0;
  vault.emit("modify"); flush(); // No visible calendar is valid.
  views.push(view);
  vault.emit("modify");
  const beforeUnload = rebuilds;
  plugin.unload();
  assert.equal(vault.count(), 0, "vault subscriptions should be disposed");
  assert.equal(metadataCache.count(), 0, "metadata subscriptions should be disposed");
  assert.equal(timers.size, 0, "pending refresh must be cancelled on unload");
  flush(); assert.equal(rebuilds, beforeUnload);
  assert.equal(rebuilds, renders);
  console.log("PASS: view lifecycle, six change events, debounce, absent view, unload cleanup");
}
verify(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
