import * as L from "obsidian";
import type CalendarPlugin from "./main";

export class CalendarSettingTab extends L.PluginSettingTab {
    plugin: CalendarPlugin;
    constructor(z: L.App, l: CalendarPlugin) {
      super(z, l);
      this.plugin = l;
    }
    display() {
      let {
        containerEl: z
      } = this;
      z.empty();
      new L.Setting(z).setName("周一作为一周开始").setDesc("关闭则以周日开始。").addToggle(p => p.setValue(this.plugin.settings.weekStartMonday).onChange(I => this.plugin.runAction(async () => {
        this.plugin.settings.weekStartMonday = I;
        await this.plugin.saveSettings();
      })));
      new L.Setting(z).setName("热力图").setDesc("用颜色深浅表示当天活动量；关闭则用绿/橙圆点。").addToggle(p => p.setValue(this.plugin.settings.heatmap).onChange(I => this.plugin.runAction(async () => {
        this.plugin.settings.heatmap = I;
        await this.plugin.saveSettings();
      })));
      new L.Setting(z).setName("显示筛选下拉").addToggle(p => p.setValue(this.plugin.settings.showFilter).onChange(I => this.plugin.runAction(async () => {
        this.plugin.settings.showFilter = I;
        await this.plugin.saveSettings();
      })));
      new L.Setting(z).setName("显示统计条").addToggle(p => p.setValue(this.plugin.settings.showStats).onChange(I => this.plugin.runAction(async () => {
        this.plugin.settings.showStats = I;
        await this.plugin.saveSettings();
      })));
      new L.Setting(z).setName("悬停预览").addToggle(p => p.setValue(this.plugin.settings.hoverPreview).onChange(I => this.plugin.runAction(async () => {
        this.plugin.settings.hoverPreview = I;
        await this.plugin.saveSettings();
      })));
      new L.Setting(z).setName("用文件名日期作为创建日期").setDesc("文件名以年-月-日格式开头时优先用它（对云同步等会重置创建时间的场景更可靠）。").addToggle(p => p.setValue(this.plugin.settings.useFilenameDate).onChange(I => this.plugin.runAction(async () => {
        this.plugin.settings.useFilenameDate = I;
        await this.plugin.saveSettings();
      })));
      new L.Setting(z).setName("前置属性日期字段").setDesc("按顺序尝试这些字段作为创建日期，逗号分隔。").addText(p => p.setValue(this.plugin.settings.frontmatterDateFields.join(",")).onChange(I => this.plugin.runAction(async () => {
        this.plugin.settings.frontmatterDateFields = I.split(",").map(N => N.trim()).filter(Boolean);
        await this.plugin.saveSettings();
      })));
      new L.Setting(z).setName("排除文件夹").setDesc("这些文件夹里的笔记不计入活动，逗号或换行分隔。").addTextArea(p => p.setValue(this.plugin.settings.excludeFolders.join(`
`)).onChange(I => this.plugin.runAction(async () => {
        this.plugin.settings.excludeFolders = I.split(/[\n,]/).map(N => N.trim()).filter(Boolean);
        await this.plugin.saveSettings();
      })));
      new L.Setting(z).setName("显示农历").setDesc("在每个日期下显示农历（节气/节日优先，初一显示月份）。").addToggle(p => p.setValue(this.plugin.settings.showLunar).onChange(I => this.plugin.runAction(async () => {
        this.plugin.settings.showLunar = I;
        await this.plugin.saveSettings();
      })));
      new L.Setting(z).setName("宽松匹配日记").setDesc("开启后，日记文件夹里文件名以该日期开头的笔记（如 2026-09-17-反思）也算当天日记，避免误建重复日记。").addToggle(p => p.setValue(this.plugin.settings.looseDailyMatch).onChange(I => this.plugin.runAction(async () => {
        this.plugin.settings.looseDailyMatch = I;
        await this.plugin.saveSettings();
      })));
      z.createEl("p", {
        cls: "setting-item-description"
      }).setText("日记的文件夹/格式/模板沿用「设置 → 核心插件 → 日记」的配置。");
    }
  }
