import { PANEL_MAX_WIDTH } from "./task-config.js";

const NAME_TAG_MAX_WIDTH = 0.15;
const DETAIL_PANEL_MAX_WIDTH = PANEL_MAX_WIDTH;
const PANEL_OFFSET_Y = 0.11;
const HORN_PANEL_OFFSET_Y = PANEL_OFFSET_Y * 1.2;

export interface PartNameTagSpec {
  nameTagConfig: string;
  detailConfig: string;
  detailNarration: string;
  maxWidth: number;
  detailMaxWidth: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  infoButtonId: string;
}

const defaults = {
  maxWidth: NAME_TAG_MAX_WIDTH,
  detailMaxWidth: DETAIL_PANEL_MAX_WIDTH,
  offsetX: 0,
  offsetY: PANEL_OFFSET_Y,
  offsetZ: 0,
} as const;

function spec(
  slug: string,
  overrides: Partial<PartNameTagSpec> = {},
): PartNameTagSpec {
  return {
    nameTagConfig: `./ui/info/${slug}-name-tag.json`,
    detailConfig: "",
    detailNarration: "",
    infoButtonId: "",
    ...defaults,
    ...overrides,
  };
}

/** Part id → panel config for name tags and detail panels. */
export const PART_NAME_TAG_SPECS: Record<string, PartNameTagSpec> = {
  cylinder: spec("cylinder", { offsetY: 0.16 }),
  recorder: spec("recorder"),
  recording_horn: spec("recording-horn", { offsetY: HORN_PANEL_OFFSET_Y }),
  crank: spec("crank", { offsetX: 0.15 }),
  brake: spec("brake"),
  carriage: spec("carriage", { offsetY: 0.17 }),
  reproducer: spec("reproducer"),
  listening_horn: spec("listening-horn", { offsetY: HORN_PANEL_OFFSET_Y }),
};

/** Task-specific name tag overrides (e.g. phonograph intro above the body). */
export const TASK_NAME_TAG_SPECS: Record<
  string,
  Record<string, PartNameTagSpec>
> = {};

export function partNameTagSpecFor(partId: string): PartNameTagSpec | undefined {
  return PART_NAME_TAG_SPECS[partId];
}

export interface PartActionNameTagSpec {
  nameTagConfig: string;
  maxWidth: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
}

/** Extra action-only labels shown alongside the standard info name tag. */
export const TASK_ACTION_NAME_TAG_SPECS: Record<
  string,
  Record<string, PartActionNameTagSpec>
> = {};

export function nameTagSpecForTaskPart(
  taskId: string,
  partId: string,
): PartNameTagSpec | undefined {
  const taskSpec = TASK_NAME_TAG_SPECS[taskId]?.[partId];
  if (taskSpec) return taskSpec;
  return partNameTagSpecFor(partId);
}

export function actionNameTagSpecForTaskPart(
  taskId: string,
  partId: string,
): PartActionNameTagSpec | undefined {
  return TASK_ACTION_NAME_TAG_SPECS[taskId]?.[partId];
}

export const MICRO_INSTRUCTION_MAX_WIDTH = PANEL_MAX_WIDTH;
/** World-space offset above the part; keep clear of name tags at PANEL_OFFSET_Y. */
export const MICRO_INSTRUCTION_OFFSET_Y = 0.28;
/** World-space offset below the part (negative Y). */
export const MICRO_INSTRUCTION_OFFSET_Y_BELOW = -0.13;

export interface MicroInstructionStep {
  panelConfig: string;
  maxWidth: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
}

export type MicroInstructionFlow = "single" | "info-tutorial";

export interface MicroInstructionBinding {
  steps: MicroInstructionStep[];
  flow?: MicroInstructionFlow;
  /** Complete the active task when the narrated info panel auto-closes. */
  completeTaskOnInfoClose?: boolean;
}

/** Task-specific micro instructions shown above a part during interactive steps. */
export const TASK_MICRO_INSTRUCTION_SPECS: Record<
  string,
  Record<string, MicroInstructionBinding>
> = {};

export function microInstructionBindingForTaskPart(
  taskId: string,
  partId: string,
): MicroInstructionBinding | undefined {
  return TASK_MICRO_INSTRUCTION_SPECS[taskId]?.[partId];
}

/** Part ids that show a micro instruction panel for each task. */
export const MICRO_INSTRUCTIONS_BY_TASK: Record<string, string[]> = {};
for (const [taskId, bindings] of Object.entries(TASK_MICRO_INSTRUCTION_SPECS)) {
  MICRO_INSTRUCTIONS_BY_TASK[taskId] = Object.keys(bindings);
}

export { NAME_TAG_MAX_WIDTH, DETAIL_PANEL_MAX_WIDTH, PANEL_OFFSET_Y };
