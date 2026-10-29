import * as L from "obsidian";
import { Solar } from "lunar-javascript";
import type { Moment } from "moment";
import { moment as U } from "./date";
import type CalendarPlugin from "./main";

export const VIEW_TYPE = "notes-activity-calendar-view";

function dateKey(M: Moment): string {
  return M.format("YYYY-MM-DD");
}
function lunarLabel(M: Moment): { text: string; hl: boolean } {
  try {
    let z = Solar.fromYmd(M.year(), M.month() + 1, M.date()),
      l = z.getLunar(),
      p = l.getJieQi();
    if (p) return {
      text: p,
      hl: !0
    };
    let I = l.getFestivals();
    if (I && I.length) return {
      text: String(I[0]),
      hl: !0
    };
    let G = (z.getFestivals() || []).map(k => String(k)).find(k => k === "元旦" || k.endsWith("节"));
    if (G) return {
      text: G,
      hl: !0
    };
    let Z = l.getDayInChinese();
    return Z === "初一" ? {
      text: l.getMonthInChinese() + "月",
      hl: !1
    } : {
      text: Z,
      hl: !1
    };
  } catch {
    return {
      text: "",
      hl: !1
    };
  }
}
class FolderSuggestModal extends L.FuzzySuggestModal<L.TFolder> {
    onChoose: (folder: L.TFolder) => void;
    constructor(z: L.App, l: (folder: L.TFolder) => void) {
      super(z);
      this.onChoose = l;
      this.setPlaceholder("选择要放入的文件夹…");
    }
    getItems(): L.TFolder[] {
      let z: L.TFolder[] = [],
        l = this.app.vault.getRoot(),
        p = (I: L.TFolder): void => {
          z.push(I);
          for (let N of I.children) {
            if (N instanceof L.TFolder) {
              p(N);
            }
          }
        };
      return p(l), z;
    }
    getItemText(z: L.TFolder) {
      return z.path === "/" ? "（库根目录）" : z.path;
    }
    onChooseItem(z: L.TFolder) {
      this.onChoose(z);
    }
  }

export class CalendarView extends L.ItemView {
    createdMap = new Map<string, L.TFile[]>();
    modifiedMap = new Map<string, L.TFile[]>();
    filter: { type: "all" | "folder" | "tag"; value: string } = { type: "all", value: "" };
    tooltipEl: HTMLDivElement | null = null;
    statsCardEl: HTMLDivElement | null = null;
    menuEl: HTMLDivElement | null = null;
    titleEl: HTMLButtonElement | null = null;
    pickerEl: HTMLDivElement | null = null;
    pickerYear = 0;
    plugin: CalendarPlugin;
    viewMonth: Moment;
    selected: Moment;

    constructor(l: L.WorkspaceLeaf, p: CalendarPlugin) {
      super(l);
      this.plugin = p;
      this.viewMonth = U().startOf("month");
      this.selected = U().startOf("day");
    }
    getViewType() {
      return VIEW_TYPE;
    }
    getDisplayText() {
      return "日历";
    }
    getIcon() {
      return "calendar-days";
    }
    onload() {
      try {
        this.registerDomEvent(document, "mousedown", l => this.dismissPopovers(l), !0);
        this.registerDomEvent(document, "contextmenu", l => this.dismissPopovers(l), !0);
        this.registerDomEvent(document, "keydown", l => {
          if (l.key === "Escape") {
            this.dismissPopovers(l);
          }
        }, !0);
        this.registerDomEvent(window, "scroll", () => {
          this.closeMenu();
          this.closePicker();
          this.hideStatsCard();
        }, !0);
      } catch (l) {
        console.error("[notes-calendar] listener registration failed:", l);
      }
      try {
        this.rebuild();
        this.render();
      } catch (l) {
        this.renderError(l);
      }
    }
    renderError(l: unknown) {
      let p = this.contentEl;
      p.empty();
      p.addClass("notes-calendar");
      let I = p.createDiv({
        cls: "nc-root"
      });
      I.createDiv({
        cls: "nc-list-title",
        text: "日历渲染出错"
      });
      I.createEl("pre", {
        cls: "nc-render-error",
        text: l instanceof Error ? l.stack || l.message : String(l)
      });
      console.error("[notes-calendar] render failed:", l);
    }
    onunload() {
      if (this.tooltipEl) {
        this.tooltipEl.remove();
        this.tooltipEl = null;
      }
      this.hideStatsCard();
      this.closeMenu();
      this.closePicker();
    }
    dismissPopovers(l: MouseEvent | KeyboardEvent) {
      if ("key" in l && l.key === "Escape") {
        this.closeMenu();
        this.closePicker();
        this.hideTooltip();
        this.hideStatsCard();
        return;
      }
      let p = l.target;
      if (!(p instanceof Node)) return;
      if (this.menuEl && !this.menuEl.contains(p)) {
        this.closeMenu();
      }
      if (this.pickerEl && !this.pickerEl.contains(p) && !(this.titleEl && this.titleEl.contains(p))) {
        this.closePicker();
      }
    }
    isExcluded(l: string) {
      return this.plugin.settings.excludeFolders.some(p => {
        const folder = (0, L.normalizePath)(p.trim());
        return folder && (l === folder || l.startsWith(folder + "/"));
      });
    }
    passesFilter(l: L.TFile) {
      if (this.filter.type === "all") return !0;
      if (this.filter.type === "folder") {
        let p = this.filter.value;
        return l.path === p || l.path.startsWith(p + "/");
      }
      if (this.filter.type === "tag") {
        let p = this.app.metadataCache.getFileCache(l);
        return (p ? (0, L.getAllTags)(p) || [] : []).includes(this.filter.value);
      }
      return !0;
    }
    createdOf(l: L.TFile): Moment {
      let p = this.plugin.settings;
      if (p.useFilenameDate) {
        let G = l.basename.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (G) {
          let Z = U(`${G[1]}-${G[2]}-${G[3]}`, "YYYY-MM-DD", !0);
          if (Z.isValid()) return Z;
        }
      }
      const I = this.app.metadataCache.getFileCache(l)?.frontmatter;
      if (I) for (let G of p.frontmatterDateFields) {
        const Z: unknown = I[G];
        if (typeof Z !== "string" && typeof Z !== "number") continue;
        let k = String(Z).trim();
        if (!k || /invalid/i.test(k)) continue;
        let H = U(k);
        if (H.isValid()) return H;
      }
      return U(l.stat.ctime);
    }
    rebuild() {
      this.createdMap = new Map();
      this.modifiedMap = new Map();
      for (let l of this.app.vault.getMarkdownFiles()) {
        if (this.isExcluded(l.path) || !this.passesFilter(l)) continue;
        let p = this.createdOf(l),
          I = p.isValid() ? dateKey(p) : null,
          N = dateKey(U(l.stat.mtime));
        if (I) {
          if (!this.createdMap.has(I)) {
            this.createdMap.set(I, []);
          }
          this.createdMap.get(I)?.push(l);
        }
        if (N && N !== I) {
          if (!this.modifiedMap.has(N)) {
            this.modifiedMap.set(N, []);
          }
          this.modifiedMap.get(N)?.push(l);
        }
      }
      for (const [day, entries] of Object.entries(this.plugin.history || {})) {
        for (const path of Object.keys(entries)) {
          const file = this.app.vault.getAbstractFileByPath(path);
          if (!(file instanceof L.TFile) || this.isExcluded(file.path) || !this.passesFilter(file) || dateKey(this.createdOf(file)) === day) continue;
          if (!this.modifiedMap.has(day)) this.modifiedMap.set(day, []);
          const list = this.modifiedMap.get(day);
          if (list && !list.some(existing => existing.path === file.path)) list.push(file);
        }
      }
    }
    render() {
      this.hideTooltip();
      this.hideStatsCard();
      this.closeMenu();
      this.closePicker();
      let l = this.contentEl;
      l.empty();
      l.addClass("notes-calendar");
      let p = l.createDiv({
          cls: "nc-root"
        }),
        I = p.createDiv({
          cls: "nc-head"
        }),
        N = I.createEl("button", {
          cls: "nc-btn",
          text: "‹"
        }),
        G = I.createEl("button", {
          cls: "nc-title nc-title-clickable",
          text: this.viewMonth.format("YYYY 年 M 月")
        });
      this.titleEl = G;
      if (this.plugin.settings.showStats) {
        G.onmouseenter = () => {
          if (!this.pickerEl) {
            this.showStatsCard(G);
          }
        };
        G.onmouseleave = () => this.hideStatsCard();
      }
      G.onclick = () => {
        if (this.pickerEl) {
          this.closePicker();
          return;
        }
        this.hideStatsCard();
        this.showMonthPicker(G);
      };
      let Z = I.createEl("button", {
          cls: "nc-btn",
          text: "今天"
        }),
        k = I.createEl("button", {
          cls: "nc-btn",
          text: "›"
        });
      N.onclick = () => {
        this.viewMonth = this.viewMonth.clone().subtract(1, "month");
        this.render();
      };
      k.onclick = () => {
        this.viewMonth = this.viewMonth.clone().add(1, "month");
        this.render();
      };
      Z.onclick = () => {
        this.viewMonth = U().startOf("month");
        this.selected = U().startOf("day");
        this.render();
      };
      if (this.plugin.settings.showFilter) {
        this.renderFilter(p);
      }
      this.renderGrid(p);
      this.renderList(p);
    }
    renderFilter(l: HTMLElement) {
      let I = l.createDiv({
          cls: "nc-filter"
        }).createEl("select", {
          cls: "nc-select"
        }),
        Z = this.app.vault.getRoot().children.filter(P => P instanceof L.TFolder);
      I.createEl("option", { text: "全部", value: "all::" });
      if (Z.length) {
        let P = I.createEl("optgroup");
        P.label = "文件夹";
        for (let T of Z.sort((K, Q) => K.name.localeCompare(Q.name))) P.createEl("option", {
          text: "📁 " + T.name,
          value: "folder::" + T.path
        });
      }
      const tagCounts = new Map<string, number>();
      for (const file of this.app.vault.getMarkdownFiles()) {
        if (this.isExcluded(file.path)) continue;
        const cache = this.app.metadataCache.getFileCache(file);
        for (const tag of cache ? L.getAllTags(cache) ?? [] : []) {
          tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
        }
      }
      const H = [...tagCounts.keys()].sort((a, b) => (tagCounts.get(b) ?? 0) - (tagCounts.get(a) ?? 0));
      if (H.length) {
        let P = I.createEl("optgroup");
        P.label = "标签";
        for (let T of H) P.createEl("option", {
          text: T,
          value: "tag::" + T
        });
      }
      I.value = this.filter.type === "all" ? "all::" : this.filter.type + "::" + this.filter.value;
      I.onchange = () => {
        const separator = I.value.indexOf("::");
        const type = I.value.slice(0, separator);
        this.filter = {
          type: type === "folder" || type === "tag" ? type : "all",
          value: I.value.slice(separator + 2)
        };
        this.rebuild();
        this.render();
      };
    }
    countInRange(l: Map<string, L.TFile[]>, p: Moment, I: Moment) {
      let N = 0;
      for (let [G, Z] of l) {
        let k = U(G, "YYYY-MM-DD");
        if (k.isSameOrAfter(p, "day") && k.isSameOrBefore(I, "day")) {
          N += Z.length;
        }
      }
      return N;
    }
    showStatsCard(l: HTMLElement) {
      this.hideStatsCard();
      let p = this.viewMonth.clone().startOf("month"),
        I = this.viewMonth.clone().endOf("month"),
        N = this.countInRange(this.createdMap, p, I),
        G = this.countInRange(this.modifiedMap, p, I),
        Z: "isoWeek" | "week" = this.plugin.settings.weekStartMonday ? "isoWeek" : "week",
        k = U().startOf(Z),
        H = U().endOf(Z),
        b = this.countInRange(this.createdMap, k, H),
        i = this.countInRange(this.modifiedMap, k, H),
        P = document.body.createDiv({
          cls: "nc-statcard"
        });
      this.statsCardEl = P;
      P.createDiv({
        cls: "nc-statcard-title",
        text: this.viewMonth.format("YYYY 年 M 月 · 活动概览")
      });
      let T = P.createDiv({
        cls: "nc-sc-table"
      });
      T.createDiv({
        cls: "nc-sc-corner"
      });
      let K = T.createDiv({
        cls: "nc-sc-head"
      });
      K.createSpan({
        cls: "nc-legend-dot nc-dot-c"
      });
      K.createSpan({
        text: "新建"
      });
      let Q = T.createDiv({
        cls: "nc-sc-head"
      });
      Q.createSpan({
        cls: "nc-legend-dot nc-dot-m"
      });
      Q.createSpan({
        text: "修改"
      });
      let W = (R: string, V: number, s0: number) => {
        T.createDiv({
          cls: "nc-sc-period",
          text: R
        });
        T.createDiv({
          cls: "nc-sc-val",
          text: String(V)
        });
        T.createDiv({
          cls: "nc-sc-val",
          text: String(s0)
        });
      };
      W("本月", N, G);
      W("本周", b, i);
      let J = l.getBoundingClientRect();
      P.style.left = J.left + "px";
      P.style.top = J.bottom + 8 + "px";
      let e0 = P.getBoundingClientRect();
      if (e0.right > window.innerWidth - 8) {
        P.style.left = Math.max(8, window.innerWidth - e0.width - 8) + "px";
      }
    }
    hideStatsCard() {
      if (this.statsCardEl) {
        this.statsCardEl.remove();
        this.statsCardEl = null;
      }
    }
    heatLevel(l: number) {
      return l <= 0 ? 0 : l <= 2 ? 1 : l <= 5 ? 2 : l <= 9 ? 3 : 4;
    }
    renderGrid(l: HTMLElement) {
      let p = l.createDiv({
          cls: "nc-grid"
        }),
        I = this.plugin.settings.weekStartMonday ? ["一", "二", "三", "四", "五", "六", "日"] : ["日", "一", "二", "三", "四", "五", "六"];
      for (let b of I) p.createDiv({
        cls: "nc-wd",
        text: b
      });
      let N = this.viewMonth.clone().startOf("month"),
        G = this.plugin.settings.weekStartMonday ? N.isoWeekday() - 1 : N.day(),
        Z = N.clone().subtract(G, "days"),
        k = dateKey(U()),
        H = this.plugin.settings.heatmap;
      for (let b = 0; b < 42; b++) {
        let i = Z.clone().add(b, "days"),
          P = dateKey(i),
          T = p.createEl("button", {
            cls: "nc-cell"
          });
        if (i.month() !== this.viewMonth.month()) {
          T.addClass("nc-out");
        }
        if (P === k) {
          T.addClass("nc-today");
        }
        if (P === dateKey(this.selected)) {
          T.addClass("nc-sel");
        }
        let K = (this.createdMap.get(P) || []).length,
          Q = (this.modifiedMap.get(P) || []).length,
          W = K + Q;
        T.setAttribute("aria-label", `${i.format("YYYY-MM-DD")}，新建 ${K}，修改 ${Q}`);
        T.setAttribute("aria-pressed", P === dateKey(this.selected) ? "true" : "false");
        if (H) {
          let J = this.heatLevel(W);
          if (J > 0) {
            T.addClass("nc-heat-" + J);
          }
        }
        if (T.createDiv({
          cls: "nc-daynum",
          text: String(i.date())
        }), this.plugin.settings.showLunar) {
          let J = lunarLabel(i);
          if (J.text) {
            T.createDiv({
              cls: "nc-lunar" + (J.hl ? " nc-lunar-hl" : ""),
              text: J.text
            });
          }
        }
        if (!H) {
          let J = T.createDiv({
            cls: "nc-dots"
          });
          if (K) {
            J.createDiv({
              cls: "nc-dot nc-dot-c"
            });
          }
          if (Q) {
            J.createDiv({
              cls: "nc-dot nc-dot-m"
            });
          }
        }
        T.onclick = event => {
          this.selected = i.clone().startOf("day");
          if (i.month() !== this.viewMonth.month()) {
            this.viewMonth = i.clone().startOf("month");
          }
          this.render();
          if (event && event.detail === 0) this.contentEl.querySelector<HTMLButtonElement>(".nc-cell.nc-sel")?.focus();
        };
        T.oncontextmenu = J => {
          J.preventDefault();
          this.showDayMenu(J, i.clone().startOf("day"));
        };
        if (this.plugin.settings.hoverPreview) {
          T.onmouseenter = () => this.showTooltip(T, i, K, Q);
          T.onmouseleave = () => this.hideTooltip();
        }
      }
    }
    renderList(l: HTMLElement) {
      let p = l.createDiv({
          cls: "nc-list"
        }),
        I = dateKey(this.selected),
        N = (this.createdMap.get(I) || []).slice().sort((H, b) => H.basename.localeCompare(b.basename)),
        G = (this.modifiedMap.get(I) || []).slice().sort((H, b) => ((this.plugin.history[I] || {})[b.path] || b.stat.mtime) - ((this.plugin.history[I] || {})[H.path] || H.stat.mtime));
      p.createDiv({
        cls: "nc-list-title",
        text: `${this.selected.format("M 月 D 日")} \xB7 \u65B0\u5EFA ${N.length} \xB7 \u4FEE\u6539 ${G.length}`
      });
      let Z = this.plugin.getDailyNote(this.selected),
        k = p.createEl("button", {
          cls: "nc-btn nc-daily",
          text: Z ? "📓 打开当天日记" : "➕ 新建当天日记"
        });
      if (k.onclick = () => this.plugin.runAction(async () => {
        if (Z) {
          await this.plugin.openFile(Z);
        } else {
          await this.plugin.createDailyNote(this.selected);
        }
      }), !N.length && !G.length) {
        p.createDiv({
          cls: "nc-empty",
          text: "这天没有文档活动。"
        });
        return;
      }
      this.section(p, "新建", N, !1, "c");
      this.section(p, "修改", G, !0, "m");
    }
    section(l: HTMLElement, p: string, I: L.TFile[], N: boolean, G: "c" | "m") {
      if (!I.length) return;
      let Z = l.createDiv({
        cls: "nc-sec"
      });
      Z.createSpan({
        cls: "nc-legend-dot " + (G === "c" ? "nc-dot-c" : "nc-dot-m")
      });
      Z.createSpan({
        text: `${p}\uFF08${I.length}\uFF09`
      });
      for (let k of I) {
        let H = l.createDiv({
          cls: "nc-item"
        });
        if (N) {
          H.createSpan({
            cls: "nc-meta",
            text: U((this.plugin.history[dateKey(this.selected)] || {})[k.path] || k.stat.mtime).format("HH:mm")
          });
        }
        let b = H.createEl("a", {
          cls: "nc-link",
          text: k.basename
        });
        b.onclick = i => {
          i.preventDefault();
          this.plugin.runAction(() => this.plugin.openFile(k, i.metaKey || i.ctrlKey));
        };
        if (k.parent && k.parent.path !== "/") {
          H.createSpan({
            cls: "nc-fold",
            text: k.parent.path.split("/")[0]
          });
        }
      }
    }
    showDayMenu(l: MouseEvent, p: Moment) {
      this.closeMenu();
      this.hideTooltip();
      let I = document.body.createDiv({
        cls: "nc-menu"
      });
      this.menuEl = I;
      let N = (k: string, H: string, b: () => void | Promise<void>) => {
          let i = I.createDiv({
              cls: "nc-menu-item"
            }),
            P = i.createSpan({
              cls: "nc-menu-ic"
            });
          (0, L.setIcon)(P, k);
          i.createSpan({
            cls: "nc-menu-label",
            text: H
          });
          i.onclick = T => {
            T.stopPropagation();
            this.closeMenu();
            this.plugin.runAction(b);
          };
        },
        G = this.plugin.getDailyNote(p);
      if (G) {
        N("book-open", "打开当天日记", () => this.plugin.openFile(G));
      } else {
        N("calendar-plus", "新建当天日记", () => this.plugin.createDailyNote(p));
      }
      N("file-plus", "在此日期新建普通笔记…", () => new FolderSuggestModal(this.app, k => this.plugin.runAction(() => this.plugin.createPlainNote(p, k))).open());
      I.createDiv({
        cls: "nc-menu-sep"
      });
      N("copy", "复制日期 " + p.format("YYYY-MM-DD"), async () => {
        await navigator.clipboard.writeText(p.format("YYYY-MM-DD"));
        new L.Notice("已复制 " + p.format("YYYY-MM-DD"));
      });
      I.style.left = l.clientX + "px";
      I.style.top = l.clientY + "px";
      let Z = I.getBoundingClientRect();
      if (Z.right > window.innerWidth - 6) {
        I.style.left = Math.max(6, l.clientX - Z.width) + "px";
      }
      if (Z.bottom > window.innerHeight - 6) {
        I.style.top = Math.max(6, l.clientY - Z.height) + "px";
      }
    }
    closeMenu() {
      if (this.menuEl) {
        this.menuEl.remove();
        this.menuEl = null;
      }
    }
    showMonthPicker(l: HTMLElement) {
      this.closePicker();
      this.closeMenu();
      this.pickerYear = this.viewMonth.year();
      let p = document.body.createDiv({
        cls: "nc-picker"
      });
      this.pickerEl = p;
      this.renderPicker(p);
      let I = l.getBoundingClientRect();
      p.style.top = I.bottom + 6 + "px";
      let N = I.left,
        G = p.getBoundingClientRect();
      if (N + G.width > window.innerWidth - 8) {
        N = Math.max(8, window.innerWidth - G.width - 8);
      }
      p.style.left = N + "px";
    }
    renderPicker(l: HTMLElement) {
      l.empty();
      let p = l.createDiv({
          cls: "nc-picker-head"
        }),
        I = p.createEl("button", {
          cls: "nc-picker-nav",
          text: "‹"
        });
      p.createDiv({
        cls: "nc-picker-year",
        text: this.pickerYear + " 年"
      });
      let N = p.createEl("button", {
        cls: "nc-picker-nav",
        text: "›"
      });
      I.onclick = H => {
        H.stopPropagation();
        this.pickerYear -= 1;
        this.renderPicker(l);
      };
      N.onclick = H => {
        H.stopPropagation();
        this.pickerYear += 1;
        this.renderPicker(l);
      };
      let G = l.createDiv({
          cls: "nc-picker-grid"
        }),
        Z = U().year(),
        k = U().month();
      for (let H = 0; H < 12; H++) {
        let b = G.createEl("button", {
          cls: "nc-picker-month",
          text: H + 1 + " 月"
        });
        if (this.pickerYear === this.viewMonth.year() && H === this.viewMonth.month()) {
          b.addClass("is-selected");
        } else {
          if (this.pickerYear === Z && H === k) {
            b.addClass("is-today");
          }
        }
        b.onclick = i => {
          i.stopPropagation();
          this.viewMonth = U().year(this.pickerYear).month(H).startOf("month");
          this.closePicker();
          this.render();
        };
      }
    }
    closePicker() {
      if (this.pickerEl) {
        this.pickerEl.remove();
        this.pickerEl = null;
      }
    }
    showTooltip(l: HTMLElement, p: Moment, I: number, N: number) {
      this.hideTooltip();
      if (I + N === 0) return;
      let G = document.body.createDiv({
        cls: "nc-tooltip"
      });
      this.tooltipEl = G;
      G.createDiv({
        cls: "nc-tt-title",
        text: `${p.format("M月D日")} \xB7 \u65B0\u5EFA ${I} \xB7 \u4FEE\u6539 ${N}`
      });
      let Z = dateKey(p),
        k = [];
      for (let i of this.createdMap.get(Z) || []) k.push({
        name: i.basename,
        kind: "c"
      });
      for (let i of this.modifiedMap.get(Z) || []) k.push({
        name: i.basename,
        kind: "m"
      });
      let H = this.plugin.settings.hoverMaxItems;
      for (let i of k.slice(0, H)) {
        let P = G.createDiv({
          cls: "nc-tt-item"
        });
        P.createSpan({
          cls: "nc-legend-dot " + (i.kind === "c" ? "nc-dot-c" : "nc-dot-m")
        });
        P.createSpan({
          cls: "nc-tt-name",
          text: i.name
        });
      }
      if (k.length > H) {
        G.createDiv({
          cls: "nc-tt-more",
          text: `\u2026\u8FD8\u6709 ${k.length - H} \u6761`
        });
      }
      let b = l.getBoundingClientRect();
      G.style.left = Math.min(b.left, window.innerWidth - G.offsetWidth - 12) + "px";
      G.style.top = b.bottom + 6 + "px";
    }
    hideTooltip() {
      if (this.tooltipEl) {
        this.tooltipEl.remove();
        this.tooltipEl = null;
      }
    }
    externalRefresh() {
      this.rebuild();
      this.render();
    }
  }
