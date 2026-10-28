import * as L from "obsidian";
import * as x0 from "lunar-javascript";
var r0 = "notes-activity-calendar-view",
  U = L.moment,
  R0 = {
    weekStartMonday: !0,
    excludeFolders: [],
    useFilenameDate: !0,
    frontmatterDateFields: ["date", "created", "创建时间"],
    looseDailyMatch: !1,
    showLunar: !0,
    heatmap: !0,
    showStats: !0,
    hoverPreview: !0,
    showFilter: !1,
    hoverMaxItems: 6
  };
function a0(M) {
  return M.format("YYYY-MM-DD");
}
function K0(M) {
  try {
    let z = x0.Solar.fromYmd(M.year(), M.month() + 1, M.date()),
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
var F0 = class extends L.FuzzySuggestModal {
    constructor(z, l) {
      super(z);
      this.onChoose = l;
      this.setPlaceholder("选择要放入的文件夹…");
    }
    getItems() {
      let z = [],
        l = this.app.vault.getRoot(),
        p = I => {
          z.push(I);
          for (let N of I.children) {
            if (N instanceof L.TFolder) {
              p(N);
            }
          }
        };
      return p(l), z;
    }
    getItemText(z) {
      return z.path === "/" ? "（库根目录）" : z.path;
    }
    onChooseItem(z) {
      this.onChoose(z);
    }
  },
  g0 = class extends L.ItemView {
    constructor(l, p) {
      super(l);
      this.createdMap = new Map();
      this.modifiedMap = new Map();
      this.filter = {
        type: "all",
        value: ""
      };
      this.tooltipEl = null;
      this.statsCardEl = null;
      this.menuEl = null;
      this.titleEl = null;
      this.pickerEl = null;
      this.pickerYear = 0;
      this.refreshTimer = null;
      this.plugin = p;
      this.viewMonth = U().startOf("month");
      this.selected = U().startOf("day");
    }
    getViewType() {
      return r0;
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
    renderError(l) {
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
        text: String(l && (l.stack || l.message) || l)
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
    dismissPopovers(l) {
      if (l.key === "Escape") {
        this.closeMenu();
        this.closePicker();
        this.hideTooltip();
        this.hideStatsCard();
        return;
      }
      let p = l.target;
      if (this.menuEl && !this.menuEl.contains(p)) {
        this.closeMenu();
      }
      if (this.pickerEl && !this.pickerEl.contains(p) && !(this.titleEl && this.titleEl.contains(p))) {
        this.closePicker();
      }
    }
    isExcluded(l) {
      return this.plugin.settings.excludeFolders.some(p => {
        const folder = (0, L.normalizePath)(p.trim());
        return folder && (l === folder || l.startsWith(folder + "/"));
      });
    }
    passesFilter(l) {
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
    createdOf(l) {
      var N;
      let p = this.plugin.settings;
      if (p.useFilenameDate) {
        let G = l.basename.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (G) {
          let Z = U(`${G[1]}-${G[2]}-${G[3]}`, "YYYY-MM-DD", !0);
          if (Z.isValid()) return Z;
        }
      }
      let I = (N = this.app.metadataCache.getFileCache(l)) == null ? void 0 : N.frontmatter;
      if (I) for (let G of p.frontmatterDateFields) {
        let Z = I[G];
        if (Z == null) continue;
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
          I = p.isValid() ? a0(p) : null,
          N = a0(U(l.stat.mtime));
        if (I) {
          if (!this.createdMap.has(I)) {
            this.createdMap.set(I, []);
          }
          this.createdMap.get(I).push(l);
        }
        if (N && N !== I) {
          if (!this.modifiedMap.has(N)) {
            this.modifiedMap.set(N, []);
          }
          this.modifiedMap.get(N).push(l);
        }
      }
      for (const [day, entries] of Object.entries(this.plugin.history || {})) {
        for (const path of Object.keys(entries)) {
          const file = this.app.vault.getAbstractFileByPath(path);
          if (!(file instanceof L.TFile) || this.isExcluded(file.path) || !this.passesFilter(file) || a0(this.createdOf(file)) === day) continue;
          if (!this.modifiedMap.has(day)) this.modifiedMap.set(day, []);
          const list = this.modifiedMap.get(day);
          if (!list.some(existing => existing.path === file.path)) list.push(file);
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
    renderFilter(l) {
      var b, i;
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
      let k = ((i = (b = this.app.metadataCache).getTags) == null ? void 0 : i.call(b)) || {},
        H = Object.keys(k).sort((P, T) => k[T] - k[P]);
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
        let [P, T] = I.value.split("::");
        this.filter = {
          type: P,
          value: T
        };
        this.rebuild();
        this.render();
      };
    }
    countInRange(l, p, I) {
      let N = 0;
      for (let [G, Z] of l) {
        let k = U(G, "YYYY-MM-DD");
        if (k.isSameOrAfter(p, "day") && k.isSameOrBefore(I, "day")) {
          N += Z.length;
        }
      }
      return N;
    }
    showStatsCard(l) {
      this.hideStatsCard();
      let p = this.viewMonth.clone().startOf("month"),
        I = this.viewMonth.clone().endOf("month"),
        N = this.countInRange(this.createdMap, p, I),
        G = this.countInRange(this.modifiedMap, p, I),
        Z = this.plugin.settings.weekStartMonday ? "isoWeek" : "week",
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
      let W = (R, V, s0) => {
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
    heatLevel(l) {
      return l <= 0 ? 0 : l <= 2 ? 1 : l <= 5 ? 2 : l <= 9 ? 3 : 4;
    }
    renderGrid(l) {
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
        k = a0(U()),
        H = this.plugin.settings.heatmap;
      for (let b = 0; b < 42; b++) {
        let i = Z.clone().add(b, "days"),
          P = a0(i),
          T = p.createEl("button", {
            cls: "nc-cell"
          });
        if (i.month() !== this.viewMonth.month()) {
          T.addClass("nc-out");
        }
        if (P === k) {
          T.addClass("nc-today");
        }
        if (P === a0(this.selected)) {
          T.addClass("nc-sel");
        }
        let K = (this.createdMap.get(P) || []).length,
          Q = (this.modifiedMap.get(P) || []).length,
          W = K + Q;
        T.setAttribute("aria-label", `${i.format("YYYY-MM-DD")}，新建 ${K}，修改 ${Q}`);
        T.setAttribute("aria-pressed", P === a0(this.selected) ? "true" : "false");
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
          let J = K0(i);
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
          if (event && event.detail === 0) this.contentEl.querySelector(".nc-cell.nc-sel")?.focus();
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
    renderList(l) {
      let p = l.createDiv({
          cls: "nc-list"
        }),
        I = a0(this.selected),
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
      if (k.onclick = async () => {
        if (Z) {
          await this.plugin.openFile(Z);
        } else {
          await this.plugin.createDailyNote(this.selected);
        }
      }, !N.length && !G.length) {
        p.createDiv({
          cls: "nc-empty",
          text: "这天没有文档活动。"
        });
        return;
      }
      this.section(p, "新建", N, !1, "c");
      this.section(p, "修改", G, !0, "m");
    }
    section(l, p, I, N, G) {
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
            text: U((this.plugin.history[a0(this.selected)] || {})[k.path] || k.stat.mtime).format("HH:mm")
          });
        }
        let b = H.createEl("a", {
          cls: "nc-link",
          text: k.basename
        });
        b.onclick = i => {
          i.preventDefault();
          this.plugin.openFile(k, i.metaKey || i.ctrlKey);
        };
        if (k.parent && k.parent.path !== "/") {
          H.createSpan({
            cls: "nc-fold",
            text: k.parent.path.split("/")[0]
          });
        }
      }
    }
    showDayMenu(l, p) {
      this.closeMenu();
      this.hideTooltip();
      let I = document.body.createDiv({
        cls: "nc-menu"
      });
      this.menuEl = I;
      let N = (k, H, b) => {
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
            b();
          };
        },
        G = this.plugin.getDailyNote(p);
      if (G) {
        N("book-open", "打开当天日记", () => this.plugin.openFile(G));
      } else {
        N("calendar-plus", "新建当天日记", () => this.plugin.createDailyNote(p));
      }
      N("file-plus", "在此日期新建普通笔记…", () => new F0(this.app, k => this.plugin.createPlainNote(p, k)).open());
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
    showMonthPicker(l) {
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
    renderPicker(l) {
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
    showTooltip(l, p, I, N) {
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
      let Z = a0(p),
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
  },
  o0 = class extends L.Plugin {
    async onload() {
      await this.loadSettings();
      this.seedHistory();
      await this.persistData();
      this.registerActivityEvents();
      this.registerView(r0, z => new g0(z, this));
      this.addRibbonIcon("calendar-days", "打开日历", () => this.activateView());
      this.addCommand({
        id: "open-notes-calendar",
        name: "打开日历",
        callback: () => this.activateView()
      });
      this.addSettingTab(new C0(this.app, this));
      this.app.workspace.onLayoutReady(async () => {
        var z;
        for (let l of this.app.workspace.getLeavesOfType(r0)) try {
          let p = l;
          if (typeof p.loadIfDeferred == "function") {
            await p.loadIfDeferred();
          } else {
            if (!(l.view instanceof g0)) {
              await l.setViewState({
                type: r0,
                active: !1
              });
            }
          }
          let I = l.view;
          if (I instanceof g0) {
            if (!((z = I.externalRefresh) == null)) {
              z.call(I);
            }
          }
        } catch (p) {
          console.error("[notes-calendar] deferred load failed:", p);
        }
      });
    }
    registerActivityEvents() {
      let refreshTimer = null;
      const refresh = () => {
        if (refreshTimer !== null) window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => {
          refreshTimer = null;
          this.refreshViews();
        }, 400);
      };
      this.registerEvent(this.app.vault.on("modify", file => {
        this.recordModification(file);
        refresh();
      }));
      this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
        if (file && oldPath) this.renameHistory(oldPath, file.path);
        refresh();
      }));
      for (const event of ["create", "delete"]) this.registerEvent(this.app.vault.on(event, refresh));
      this.registerEvent(this.app.metadataCache.on("changed", refresh));
      this.registerEvent(this.app.metadataCache.on("resolved", refresh));
      this.register(() => {
        if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      });
    }
    seedHistory() {
      for (const file of this.app.vault.getMarkdownFiles()) this.recordModification(file, false);
    }
    recordModification(file, persist = true) {
      if (!file || !(file instanceof L.TFile) || file.extension !== "md" || !Number.isFinite(file.stat.mtime)) return;
      const day = a0(U(file.stat.mtime));
      if (!this.history[day]) this.history[day] = {};
      if (this.history[day][file.path] === file.stat.mtime) return;
      this.history[day][file.path] = file.stat.mtime;
      if (persist) void this.persistData().catch(error => console.error("[notes-calendar] save failed", error));
    }
    renameHistory(oldPath, newPath) {
      let changed = false;
      for (const entries of Object.values(this.history)) {
        for (const path of Object.keys(entries)) {
          if (path === oldPath || path.startsWith(oldPath + "/")) {
            entries[newPath + path.slice(oldPath.length)] = entries[path];
            delete entries[path];
            changed = true;
          }
        }
      }
      if (changed) void this.persistData().catch(error => console.error("[notes-calendar] save failed", error));
    }
    persistData() {
      const snapshot = JSON.parse(JSON.stringify({
        ...this.settings,
        activityHistory: this.history
      }));
      this.saveQueue = (this.saveQueue || Promise.resolve()).catch(error => console.error("[notes-calendar] save failed", error)).then(() => this.saveData(snapshot));
      return this.saveQueue;
    }
    onunload() {}
    async activateView() {
      let z = this.app.workspace.getLeavesOfType(r0);
      if (z.length) {
        this.app.workspace.revealLeaf(z[0]);
        return;
      }
      let l = this.app.workspace.getLeftLeaf(!1);
      await l.setViewState({
        type: r0,
        active: !0
      });
      this.app.workspace.revealLeaf(l);
    }
    refreshViews() {
      for (let z of this.app.workspace.getLeavesOfType(r0)) {
        let l = z.view;
        if (l && l.externalRefresh) {
          l.externalRefresh();
        }
      }
    }
    dailyOptions() {
      var p, I, N;
      let z = (N = (I = (p = this.app.internalPlugins) == null ? void 0 : p.getPluginById) == null ? void 0 : I.call(p, "daily-notes")) == null ? void 0 : N.instance,
        l = (z == null ? void 0 : z.options) || {};
      return {
        folder: (l.folder || "").trim(),
        format: (l.format || "YYYY-MM-DD").trim(),
        template: (l.template || "").trim()
      };
    }
    dailyPath(z) {
      let l = this.dailyOptions(),
        p = z.format(l.format),
        I = l.folder ? `${l.folder}/${p}.md` : `${p}.md`;
      return (0, L.normalizePath)(I);
    }
    getDailyNote(z) {
      let l = this.app.vault.getAbstractFileByPath(this.dailyPath(z));
      if (l instanceof L.TFile) return l;
      if (this.settings.looseDailyMatch) {
        const path = this.dailyPath(z),
          slash = path.lastIndexOf("/");
        const folder = slash < 0 ? "/" : path.slice(0, slash);
        const name = path.slice(slash + 1, -3);
        const Z = this.app.vault.getMarkdownFiles().find(k => k.parent && k.parent.path === folder && k.basename.startsWith(name) && (k.basename.length === name.length || /^[^\p{L}\p{N}]/u.test(k.basename.slice(name.length))));
        if (Z) return Z;
      }
      return null;
    }
    async ensureFolder(z) {
      let l = z.split("/").filter(Boolean),
        p = "";
      for (let I of l) if (p = p ? `${p}/${I}` : I, !this.app.vault.getAbstractFileByPath(p)) try {
        await this.app.vault.createFolder(p);
      } catch (error) {
        if (!this.app.vault.getAbstractFileByPath(p)) throw error;
      }
    }
    applyTemplateTokens(z, l, p) {
      let I = this.dailyOptions();
      return z.replace(/{{\s*title\s*}}/g, p).replace(/{{\s*date\s*:([^}]+)}}/g, (N, G) => l.format(G.trim())).replace(/{{\s*time\s*:([^}]+)}}/g, (N, G) => U().format(G.trim())).replace(/{{\s*date\s*}}/g, l.format(I.format || "YYYY-MM-DD")).replace(/{{\s*time\s*}}/g, U().format("HH:mm"));
    }
    async createDailyNote(z) {
      let l = this.getDailyNote(z);
      if (l) {
        await this.openFile(l);
        return;
      }
      let p = this.dailyOptions(),
        I = this.dailyPath(z),
        N = I.includes("/") ? I.slice(0, I.lastIndexOf("/")) : "";
      if (N) {
        await this.ensureFolder(N);
      }
      let G = "";
      if (p.template) {
        let Z = this.app.vault.getAbstractFileByPath((0, L.normalizePath)(p.template.endsWith(".md") ? p.template : p.template + ".md"));
        if (Z instanceof L.TFile) {
          G = this.applyTemplateTokens(await this.app.vault.read(Z), z, I.slice(I.lastIndexOf("/") + 1, -3));
        }
      }
      try {
        let Z = await this.app.vault.create(I, G);
        await this.openFile(Z);
      } catch (Z) {
        new L.Notice("新建日记失败：" + Z.message);
      }
    }
    async createPlainNote(z, l) {
      let p = z.format("YYYY-MM-DD"),
        I = l.path === "/" ? "" : l.path,
        N = p,
        G = 1;
      for (; this.app.vault.getAbstractFileByPath((0, L.normalizePath)(I ? `${I}/${N}.md` : `${N}.md`));) N = `${p} ${G++}`;
      let Z = (0, L.normalizePath)(I ? `${I}/${N}.md` : `${N}.md`);
      try {
        let k = await this.app.vault.create(Z, "");
        await this.openFile(k);
      } catch (k) {
        new L.Notice("新建笔记失败：" + k.message);
      }
    }
    async openFile(z, l = !1) {
      await this.app.workspace.getLeaf(l).openFile(z);
    }
    async loadSettings() {
      const data = (await this.loadData()) || {};
      this.history = data.activityHistory && typeof data.activityHistory === "object" && !Array.isArray(data.activityHistory) ? data.activityHistory : {};
      this.settings = Object.assign({}, R0, data);
      delete this.settings.activityHistory;
    }
    async saveSettings() {
      await this.persistData();
      this.refreshViews();
    }
  },
  C0 = class extends L.PluginSettingTab {
    constructor(z, l) {
      super(z, l);
      this.plugin = l;
    }
    display() {
      let {
        containerEl: z
      } = this;
      z.empty();
      new L.Setting(z).setName("周一作为一周开始").setDesc("关闭则以周日开始。").addToggle(p => p.setValue(this.plugin.settings.weekStartMonday).onChange(async I => {
        this.plugin.settings.weekStartMonday = I;
        await this.plugin.saveSettings();
      }));
      new L.Setting(z).setName("热力图").setDesc("用颜色深浅表示当天活动量；关闭则用绿/橙圆点。").addToggle(p => p.setValue(this.plugin.settings.heatmap).onChange(async I => {
        this.plugin.settings.heatmap = I;
        await this.plugin.saveSettings();
      }));
      new L.Setting(z).setName("显示筛选下拉").addToggle(p => p.setValue(this.plugin.settings.showFilter).onChange(async I => {
        this.plugin.settings.showFilter = I;
        await this.plugin.saveSettings();
      }));
      new L.Setting(z).setName("显示统计条").addToggle(p => p.setValue(this.plugin.settings.showStats).onChange(async I => {
        this.plugin.settings.showStats = I;
        await this.plugin.saveSettings();
      }));
      new L.Setting(z).setName("悬停预览").addToggle(p => p.setValue(this.plugin.settings.hoverPreview).onChange(async I => {
        this.plugin.settings.hoverPreview = I;
        await this.plugin.saveSettings();
      }));
      new L.Setting(z).setName("用文件名日期作为创建日期").setDesc("文件名以 YYYY-MM-DD 开头时优先用它（对 iCloud 等会重置创建时间的场景更可靠）。").addToggle(p => p.setValue(this.plugin.settings.useFilenameDate).onChange(async I => {
        this.plugin.settings.useFilenameDate = I;
        await this.plugin.saveSettings();
      }));
      new L.Setting(z).setName("frontmatter 日期字段").setDesc("按顺序尝试这些字段作为创建日期，逗号分隔。").addText(p => p.setValue(this.plugin.settings.frontmatterDateFields.join(",")).onChange(async I => {
        this.plugin.settings.frontmatterDateFields = I.split(",").map(N => N.trim()).filter(Boolean);
        await this.plugin.saveSettings();
      }));
      new L.Setting(z).setName("排除文件夹").setDesc("这些文件夹里的笔记不计入活动，逗号或换行分隔。").addTextArea(p => p.setValue(this.plugin.settings.excludeFolders.join(`
`)).onChange(async I => {
        this.plugin.settings.excludeFolders = I.split(/[\n,]/).map(N => N.trim()).filter(Boolean);
        await this.plugin.saveSettings();
      }));
      new L.Setting(z).setName("显示农历").setDesc("在每个日期下显示农历（节气/节日优先，初一显示月份）。").addToggle(p => p.setValue(this.plugin.settings.showLunar).onChange(async I => {
        this.plugin.settings.showLunar = I;
        await this.plugin.saveSettings();
      }));
      new L.Setting(z).setName("宽松匹配日记").setDesc("开启后，日记文件夹里文件名以该日期开头的笔记（如 2026-09-17-反思）也算当天日记，避免误建重复日记。").addToggle(p => p.setValue(this.plugin.settings.looseDailyMatch).onChange(async I => {
        this.plugin.settings.looseDailyMatch = I;
        await this.plugin.saveSettings();
      }));
      z.createEl("p", {
        cls: "setting-item-description"
      }).setText("日记的文件夹/格式/模板沿用「设置 → 核心插件 → 日记」的配置。");
    }
  };
export default o0;
