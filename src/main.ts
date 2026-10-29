import { Plugin, TFile, Notice, normalizePath } from "obsidian";
import type { TFolder } from "obsidian";
import type { Moment } from "moment";
import { moment } from "./date";
import { CalendarView, VIEW_TYPE } from "./calendar";
import { CalendarSettingTab } from "./settings-tab";
import { errorMessage, isRecord, isSafePath, parseHistory, parseSettings } from "./types";
import type { ActivityHistory, CalendarSettings, DailyOptions } from "./types";

// Daily notes has no public settings API. Keep the compatibility boundary small:
// validate every level at runtime, never trust arbitrary persisted options.
function hasPluginLookup(value: unknown): value is { getPluginById(id: string): unknown } {
  return isRecord(value) && typeof value.getPluginById === "function";
}

export default class CalendarPlugin extends Plugin {
  settings: CalendarSettings = parseSettings({});
  history: ActivityHistory = {};
  saveQueue: Promise<void> = Promise.resolve();
  private stopped = false;

  async onload(): Promise<void> {
    this.stopped = false;
    await this.loadSettings();
    this.seedHistory();
    await this.persistData();
    this.registerActivityEvents();
    this.registerView(VIEW_TYPE, leaf => new CalendarView(leaf, this));
    this.addRibbonIcon("calendar-days", "打开日历", () => this.runAction(() => this.activateView()));
    this.addCommand({ id: "open-notes-calendar", name: "打开日历", callback: () => this.runAction(() => this.activateView()) });
    this.addSettingTab(new CalendarSettingTab(this.app, this));
    this.app.workspace.onLayoutReady(() => this.runAction(async () => {
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
        if (this.stopped) return;
        await leaf.loadIfDeferred();
        if (!this.stopped && leaf.view instanceof CalendarView) leaf.view.externalRefresh();
      }
    }));
  }

  /** Run UI actions with a visible failure rather than an unhandled rejection. */
  runAction(action: () => void | Promise<void>): void {
    try {
      const result = action();
      if (result) void result.catch(error => this.reportError(error));
    } catch (error) { this.reportError(error); }
  }

  private reportError(error: unknown): void {
    console.error("[notes-calendar] action failed", error);
    new Notice("日历操作失败：" + errorMessage(error));
  }

  registerActivityEvents(): void {
    let refreshTimer: number | null = null;
    const refresh = (): void => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        if (!this.stopped) this.refreshViews();
      }, 400);
    };
    this.registerEvent(this.app.vault.on("modify", file => { this.recordModification(file); refresh(); }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      if (file && oldPath) this.renameHistory(oldPath, file.path);
      refresh();
    }));
    this.registerEvent(this.app.vault.on("create", refresh));
    this.registerEvent(this.app.vault.on("delete", refresh));
    this.registerEvent(this.app.metadataCache.on("changed", refresh));
    this.registerEvent(this.app.metadataCache.on("resolved", refresh));
    this.register(() => { if (refreshTimer !== null) window.clearTimeout(refreshTimer); });
  }

  seedHistory(): void {
    for (const file of this.app.vault.getMarkdownFiles()) this.recordModification(file, false);
  }

  recordModification(file: unknown, persist = true): void {
    if (!(file instanceof TFile) || file.extension !== "md" || !isSafePath(file.path) || !Number.isFinite(file.stat.mtime) || file.stat.mtime < 0) return;
    const date = moment(file.stat.mtime);
    if (!date.isValid()) return;
    const day = date.format("YYYY-MM-DD");
    if (!this.history[day]) this.history[day] = {};
    if (this.history[day][file.path] === file.stat.mtime) return;
    this.history[day][file.path] = file.stat.mtime;
    if (persist) this.runAction(() => this.persistData());
  }

  renameHistory(oldPath: string, newPath: string): void {
    if (!isSafePath(oldPath) || !isSafePath(newPath)) return;
    let changed = false;
    for (const entries of Object.values(this.history)) {
      for (const path of Object.keys(entries)) {
        if (path === oldPath || path.startsWith(oldPath + "/")) {
          const target = newPath + path.slice(oldPath.length);
          if (target.endsWith(".md")) entries[target] = entries[path];
          delete entries[path];
          changed = true;
        }
      }
    }
    if (changed) this.runAction(() => this.persistData());
  }

  persistData(): Promise<void> {
    const snapshot = {
      ...this.settings,
      excludeFolders: [...this.settings.excludeFolders],
      frontmatterDateFields: [...this.settings.frontmatterDateFields],
      activityHistory: Object.fromEntries(Object.entries(this.history).map(([day, entries]) => [day, { ...entries }]))
    };
    this.saveQueue = this.saveQueue.catch(error => console.error("[notes-calendar] save failed", error)).then(() => this.saveData(snapshot));
    return this.saveQueue;
  }

  onunload(): void { this.stopped = true; }

  async activateView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (existing) { await this.app.workspace.revealLeaf(existing); return; }
    const leaf = this.app.workspace.getLeftLeaf(false);
    if (!leaf) { new Notice("无法打开日历侧栏。"); return; }
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  refreshViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof CalendarView) leaf.view.externalRefresh();
    }
  }

  dailyOptions(): DailyOptions {
    let options: Record<string, unknown> = {};
    if ("internalPlugins" in this.app && hasPluginLookup(this.app.internalPlugins)) {
      const plugin = this.app.internalPlugins.getPluginById("daily-notes");
      if (isRecord(plugin) && isRecord(plugin.instance) && isRecord(plugin.instance.options)) options = plugin.instance.options;
    }
    const safeOption = (value: unknown): string => {
      if (typeof value !== "string") return "";
      const path = value.trim().replace(/\/+$/u, "");
      if (path && !isSafePath(path)) throw new Error("日记配置包含无效路径，请检查核心日记设置。");
      return path;
    };
    return {
      folder: safeOption(options.folder),
      format: typeof options.format === "string" && options.format.trim() ? options.format.trim() : "YYYY-MM-DD",
      template: safeOption(options.template)
    };
  }

  dailyPath(date: Moment): string {
    const options = this.dailyOptions();
    const name = date.format(options.format);
    const path = options.folder ? `${options.folder}/${name}.md` : `${name}.md`;
    if (!date.isValid() || !isSafePath(path)) throw new Error("日记日期格式或文件夹路径无效。");
    return normalizePath(path);
  }

  getDailyNote(date: Moment): TFile | null {
    // Invalid core settings must not prevent the activity calendar from rendering.
    // A user-triggered create still fails visibly, without writing to another path.
    let path: string;
    try { path = this.dailyPath(date); }
    catch { return null; }
    const exact = this.app.vault.getAbstractFileByPath(path);
    if (exact instanceof TFile) return exact;
    if (this.settings.looseDailyMatch) {
      const slash = path.lastIndexOf("/");
      const folder = slash < 0 ? "/" : path.slice(0, slash);
      const name = path.slice(slash + 1, -3);
      return this.app.vault.getMarkdownFiles().find(file => file.parent?.path === folder && file.basename.startsWith(name) && (file.basename.length === name.length || /^[^\p{L}\p{N}]/u.test(file.basename.slice(name.length)))) ?? null;
    }
    return null;
  }

  async ensureFolder(path: string): Promise<void> {
    if (!isSafePath(path)) throw new Error("文件夹路径无效。");
    let current = "";
    for (const part of path.split("/")) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        try { await this.app.vault.createFolder(current); }
        catch (error) { if (!this.app.vault.getAbstractFileByPath(current)) throw error; }
      }
    }
  }

  applyTemplateTokens(text: string, date: Moment, title: string): string {
    return text.replace(/{{\s*title\s*}}/g, () => title)
      .replace(/{{\s*date\s*:([^}]+)}}/g, (_match: string, format: string) => date.format(format.trim()))
      .replace(/{{\s*time\s*:([^}]+)}}/g, (_match: string, format: string) => moment().format(format.trim()))
      .replace(/{{\s*date\s*}}/g, () => date.format(this.dailyOptions().format))
      .replace(/{{\s*time\s*}}/g, () => moment().format("HH:mm"));
  }

  async createDailyNote(date: Moment): Promise<void> {
    const existing = this.getDailyNote(date);
    if (existing) { await this.openFile(existing); return; }
    const options = this.dailyOptions();
    const path = this.dailyPath(date);
    const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    if (folder) await this.ensureFolder(folder);
    let contents = "";
    if (options.template) {
      const template = this.app.vault.getAbstractFileByPath(normalizePath(options.template.endsWith(".md") ? options.template : options.template + ".md"));
      if (template instanceof TFile) contents = this.applyTemplateTokens(await this.app.vault.read(template), date, path.slice(path.lastIndexOf("/") + 1, -3));
    }
    try { await this.openFile(await this.app.vault.create(path, contents)); }
    catch (error) { new Notice("新建日记失败：" + errorMessage(error)); }
  }

  async createPlainNote(date: Moment, folder: TFolder): Promise<void> {
    const base = date.format("YYYY-MM-DD");
    const prefix = folder.path === "/" ? "" : folder.path + "/";
    if (!date.isValid() || !isSafePath(prefix + base + ".md")) throw new Error("笔记日期或文件夹路径无效。");
    let name = base;
    let suffix = 1;
    while (this.app.vault.getAbstractFileByPath(prefix + name + ".md")) name = `${base} ${suffix++}`;
    try { await this.openFile(await this.app.vault.create(normalizePath(prefix + name + ".md"), "")); }
    catch (error) { new Notice("新建笔记失败：" + errorMessage(error)); }
  }

  async openFile(file: TFile, newLeaf = false): Promise<void> {
    await this.app.workspace.getLeaf(newLeaf).openFile(file);
  }

  async loadSettings(): Promise<void> {
    const data: unknown = await this.loadData();
    this.settings = parseSettings(data);
    this.history = parseHistory(isRecord(data) ? data.activityHistory : undefined);
  }

  async saveSettings(): Promise<void> {
    await this.persistData();
    this.refreshViews();
  }
}
