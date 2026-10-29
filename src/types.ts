import { moment } from "./date";

export interface CalendarSettings {
  weekStartMonday: boolean;
  excludeFolders: string[];
  useFilenameDate: boolean;
  frontmatterDateFields: string[];
  looseDailyMatch: boolean;
  showLunar: boolean;
  heatmap: boolean;
  showStats: boolean;
  hoverPreview: boolean;
  showFilter: boolean;
  hoverMaxItems: number;
}
export type ActivityHistory = Record<string, Record<string, number>>;
export interface DailyOptions { folder: string; format: string; template: string }

export const DEFAULT_SETTINGS: CalendarSettings = {
  weekStartMonday: true, excludeFolders: [], useFilenameDate: true,
  frontmatterDateFields: ["date", "created", "创建时间"], looseDailyMatch: false,
  showLunar: true, heatmap: true, showStats: true, hoverPreview: true,
  showFilter: false, hoverMaxItems: 6
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Vault paths are relative; history keys must additionally end in .md. */
export function isSafePath(value: string): boolean {
  return value.length > 0 && !value.startsWith("/") && !value.includes("\\") &&
    !value.includes(":") && ![...value].some(character => character.charCodeAt(0) < 32) && value.split("/").every(part =>
      part.length > 0 && part !== "." && part !== "..");
}

function strings(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) ? value.filter((item: unknown): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean) : [...fallback];
}

export function parseSettings(value: unknown): CalendarSettings {
  const data = isRecord(value) ? value : {};
  const bool = (key: keyof CalendarSettings): boolean => {
    const value = data[key];
    return typeof value === "boolean" ? value : DEFAULT_SETTINGS[key] === true;
  };
  return {
    weekStartMonday: bool("weekStartMonday"),
    excludeFolders: strings(data.excludeFolders, []).map(path => path.replace(/\/$/u, "")).filter(isSafePath),
    useFilenameDate: bool("useFilenameDate"),
    frontmatterDateFields: strings(data.frontmatterDateFields, DEFAULT_SETTINGS.frontmatterDateFields),
    looseDailyMatch: bool("looseDailyMatch"), showLunar: bool("showLunar"),
    heatmap: bool("heatmap"), showStats: bool("showStats"),
    hoverPreview: bool("hoverPreview"), showFilter: bool("showFilter"),
    hoverMaxItems: typeof data.hoverMaxItems === "number" && Number.isInteger(data.hoverMaxItems) && data.hoverMaxItems >= 1 && data.hoverMaxItems <= 50 ? data.hoverMaxItems : DEFAULT_SETTINGS.hoverMaxItems
  };
}

export function parseHistory(value: unknown): ActivityHistory {
  const history: ActivityHistory = {};
  if (!isRecord(value)) return history;
  for (const [day, entries] of Object.entries(value)) {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(day) || !moment(day, "YYYY-MM-DD", true).isValid() || !isRecord(entries)) continue;
    const valid: Record<string, number> = {};
    for (const [path, stamp] of Object.entries(entries)) {
      if (isSafePath(path) && path.endsWith(".md") && typeof stamp === "number" && Number.isFinite(stamp) && stamp >= 0 && moment(stamp).isValid()) valid[path] = stamp;
    }
    if (Object.keys(valid).length) history[day] = valid;
  }
  return history;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : typeof error === "string" ? error : "未知错误";
}
