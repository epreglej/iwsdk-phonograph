import { TaskId } from "./task-config.js";

const PANEL_OFFSET_Y = 0.11;
const HORN_PANEL_OFFSET_Y = PANEL_OFFSET_Y * 1.2;

/** uikitml width of `.outer-layer` name tags (px). */
const NAME_TAG_UI_WIDTH_PX = 140;
/** uikitml width of `*-detail` panels (px). */
const DETAIL_PANEL_UI_WIDTH_PX = 200;
/**
 * World meters per uikitml pixel for part info panels.
 * Calibrated from ~0.14m at 130px on the prior name-tag layout.
 */
const INFO_PANEL_METERS_PER_PX = 0.14 / 130;

/** World-space max width for floating part name tags (meters). */
const NAME_TAG_MAX_WIDTH = NAME_TAG_UI_WIDTH_PX * INFO_PANEL_METERS_PER_PX;
/** World-space max width for part detail / info panels (meters). */
const DETAIL_PANEL_MAX_WIDTH = DETAIL_PANEL_UI_WIDTH_PX * INFO_PANEL_METERS_PER_PX;

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
    detailConfig: `./ui/info/${slug}-detail.json`,
    detailNarration: `./audio/${slug}-1.wav`,
    infoButtonId: `${slug}-info-button`,
    ...defaults,
    ...overrides,
  };
}

/** Part id → panel config for name tags and detail panels. */
export const PART_NAME_TAG_SPECS: Record<string, PartNameTagSpec> = {
  phonograph: spec("phonograph", { offsetY: 0.44 }),
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
> = {
  [TaskId.RecordingCarriageLower]: {
    carriage: {
      ...spec("carriage", { offsetY: 0.17 }),
      nameTagConfig: "./ui/info/carriage-start-recording-name-tag.json",
      infoButtonId: "",
    },
  },
  [TaskId.RecordingSpeak]: {
    brake: {
      ...spec("brake"),
      nameTagConfig: "./ui/info/brake-stop-recording-name-tag.json",
      infoButtonId: "",
    },
  },
};

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

export const MICRO_INSTRUCTION_MAX_WIDTH = DETAIL_PANEL_MAX_WIDTH;
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
> = {
  [TaskId.AssemblyPhonographInfo]: {
    phonograph: {
      steps: [
        {
          panelConfig: "./ui/instructions/phonograph-info-tutorial.json",
          maxWidth: MICRO_INSTRUCTION_MAX_WIDTH,
          offsetX: 0,
          offsetY: 0.56,
          offsetZ: 0,
        },
      ],
      flow: "info-tutorial",
      completeTaskOnInfoClose: true,
    },
  },
};

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
