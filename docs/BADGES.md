# 徽章来源 / Badge sources

这些是 Markdown 图片链接加 Shields.io，不是必须安装的模板。语言入口是两个 README 之间的普通链接，不是插件界面的语言开关。

## 已采用 / Included

- 版本 / Release: `https://img.shields.io/github/v/release/Norman-lawyer/notes-activity-calendar`，来自 GitHub 已发布版本，不是本地未发布提交。
- 下载 / Downloads: 链接到 [Obsidian 官方插件页](https://community.obsidian.md/plugins/notes-activity-calendar)，目前显示“查看官方数据”，不冒充自动数字计数器。
- 许可证 / License: MIT，链接到仓库 LICENSE。

## 为什么暂时不放数字下载徽章？ / Why no numeric download badge yet?

不同读取方式对官方统计 JSON 返回了不同快照：一个已验证读数为本插件 3 次下载，本次云环境抓取的较旧快照却没有该条目。Shields 徽章的远端返回值也未能在当前环境验证，因此交付版使用官方统计入口，不断言条目不存在，也不把过期快照当成实时结果。

Different retrieval paths returned different snapshots of the official stats JSON. One verified reading reported 3 plugin downloads, while this cloud fetch returned an older snapshot without the entry. The numeric badge response could not be verified here, so the documentation uses a source link and does not claim that the official entry is absent.

发布前可以启用官方数据动态徽章，但应先验证返回的 SVG 数值，再替换 README 中的链接型徽章：

```text
Data URL: https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugin-stats.json
JSONPath: $["notes-activity-calendar"].downloads
Shields endpoint: https://img.shields.io/badge/dynamic/json
```

参考 / References:
- [Shields Dynamic JSON Badge](https://shields.io/badges/dynamic-json-badge)
- [Obsidian developer badge example](https://marcusolsson.github.io/obsidian-plugin-docs/developer-tools#badges)

图片和语言链接在 GitHub 中使用标准 Markdown；Obsidian 内嵌页面的缓存、图片显示与跳转方式由宿主决定。只有实际发布文档后才能在用户设备上验证内嵌体验，不能保证原位切换。

## 图片来源 / Image provenance

`docs/images/*` 是根据实际功能与样式绘制的矢量功能示意图，使用虚构笔记，明确标注不是软件截图。英文图翻译了说明标签，不代表插件新增了英文界面。未发布或复用用户提供的手机截图。

The illustrations reflect existing calendar/date-menu features with fictional data. They are not screenshots, not a claim of end-to-end UI testing, and do not contain private vault content.
