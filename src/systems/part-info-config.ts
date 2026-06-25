import { PHONOGRAPH_ABOVE_OFFSET_Y, TaskId } from "./task-config.js";

const NAME_TAG_MAX_WIDTH = 0.14;
const DETAIL_PANEL_MAX_WIDTH = 0.17;
const PANEL_OFFSET_Y = 0.11;
const HORN_PANEL_OFFSET_Y = PANEL_OFFSET_Y * 1.2;

export interface PartNameTagSpec {
  nameTagConfig: string;
  detailConfig: string;
  maxWidth: number;
  detailMaxWidth: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  infoButtonId: string;
  closeButtonId: string;
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
    infoButtonId: `${slug}-info-button`,
    closeButtonId: `${slug}-info-close-button`,
    ...defaults,
    ...overrides,
  };
}

/** Part id → panel config for name tags and detail panels. */
export const PART_NAME_TAG_SPECS: Record<string, PartNameTagSpec> = {
  cylinder: spec("cylinder"),
  recorder: spec("recorder"),
  recording_horn: spec("recording-horn", { offsetY: HORN_PANEL_OFFSET_Y }),
  phonograph: spec("motor", { offsetY: PHONOGRAPH_ABOVE_OFFSET_Y }),
  crank: spec("crank"),
  brake: spec("brake"),
  carriage: spec("carriage"),
  reproducer: spec("reproducer"),
  listening_horn: spec("listening-horn", { offsetY: HORN_PANEL_OFFSET_Y }),
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

/** Task-specific action labels (no info panel) replacing the standard name tag. */
export const TASK_ACTION_NAME_TAG_SPECS: Record<
  string,
  Record<string, PartActionNameTagSpec>
> = {
  [TaskId.RecordingCarriageLower]: {
    carriage: {
      nameTagConfig: "./ui/info/start-recording-tag.json",
      maxWidth: 0.15,
      offsetX: 0,
      offsetY: PANEL_OFFSET_Y,
      offsetZ: 0,
    },
  },
  [TaskId.RecordingSpeak]: {
    brake: {
      nameTagConfig: "./ui/info/stop-recording-tag.json",
      maxWidth: 0.15,
      offsetX: 0,
      offsetY: PANEL_OFFSET_Y,
      offsetZ: 0,
    },
  },
};

export function nameTagSpecForTaskPart(
  taskId: string,
  partId: string,
): PartNameTagSpec | undefined {
  const action = TASK_ACTION_NAME_TAG_SPECS[taskId]?.[partId];
  if (action) {
    return {
      ...action,
      detailConfig: "",
      detailMaxWidth: DETAIL_PANEL_MAX_WIDTH,
      infoButtonId: "",
      closeButtonId: "",
    };
  }
  return partNameTagSpecFor(partId);
}

export { NAME_TAG_MAX_WIDTH, DETAIL_PANEL_MAX_WIDTH, PANEL_OFFSET_Y };
