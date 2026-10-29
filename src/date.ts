import { moment as obsidianMoment } from "obsidian";
import type { Moment, MomentInput } from "moment";

/**
 * Obsidian exposes Moment as a callable runtime function. Its API declarations
 * use a namespace import, which TypeScript 6 no longer treats as callable.
 * Validate the runtime boundary and describe only the documented overload used
 * here, rather than bundling a second Moment or leaking error/any types.
 */
type MomentFactory = (input?: MomentInput, format?: string, strict?: boolean) => Moment;
function isMomentFactory(value: unknown): value is MomentFactory {
  return typeof value === "function";
}
const factory: unknown = obsidianMoment;
if (!isMomentFactory(factory)) throw new Error("Obsidian Moment API is unavailable.");
export const moment: MomentFactory = factory;
