/** Placard attached to a part while a mount/crank task is active. */
export interface PlacardSpec {
  panelConfig: string;
  offsetX?: number;
  offsetY?: number;
  offsetZ?: number;
  dismissOnGrab?: boolean;
  dismissOnSnap?: boolean;
  autoDismissMs?: number;
}

export interface PanelCopy {
  title: string;
  body: string;
}

export type TaskDef =
  | { id: string; kind: "menu" }
  | { id: string; kind: "info"; copy: PanelCopy }
  | { id: string; kind: "mount"; partId: string; snapPointId: string; placard: PlacardSpec }
  | { id: string; kind: "crank"; partId: string; placard: PlacardSpec }
  | { id: string; kind: "unmount"; partId: string }
  | { id: string; kind: "brakeShift" }
  | { id: string; kind: "recording" }
  | { id: string; kind: "playback" };

const MOUNT_PLACARD_DEFAULTS = {
  offsetY: 0.2,
  dismissOnGrab: false,
  dismissOnSnap: true,
  autoDismissMs: 0,
} as const;

/**
 * The full ordered experience. `TaskFlowSystem` walks this list to advance;
 * every other system derives the data it needs from the maps below, so task
 * ids and per-task data live in exactly one place.
 */
export const TASK_FLOW: TaskDef[] = [
  { id: "main_menu", kind: "menu" },
  {
    id: "recording_setup_info",
    kind: "info",
    copy: {
      title: "Recording setup",
      body: "First we need to assemble the phonograph for recording.",
    },
  },
  {
    id: "cylinder_mount",
    kind: "mount",
    partId: "cylinder",
    snapPointId: "cylinder_snap_point",
    placard: {
      ...MOUNT_PLACARD_DEFAULTS,
      panelConfig: "./ui/cylinder-mount-instruction.json",
    },
  },
  {
    id: "recording_diaphragm_mount",
    kind: "mount",
    partId: "recording_diaphragm",
    snapPointId: "diaphragm_snap_point",
    placard: {
      ...MOUNT_PLACARD_DEFAULTS,
      panelConfig: "./ui/recording-diaphragm-mount-instruction.json",
    },
  },
  {
    id: "recording_trumpet_mount",
    kind: "mount",
    partId: "recording_trumpet",
    snapPointId: "trumpet_snap_point",
    placard: {
      ...MOUNT_PLACARD_DEFAULTS,
      panelConfig: "./ui/recording-trumpet-mount-instruction.json",
      offsetZ: 0.25,
    },
  },
  {
    id: "crank_cranking",
    kind: "crank",
    partId: "crank",
    placard: {
      panelConfig: "./ui/crank-cranking-instruction.json",
      offsetX: 0.1,
      offsetY: 0.2,
      offsetZ: 0,
      dismissOnGrab: false,
      dismissOnSnap: true,
      autoDismissMs: 0,
    },
  },
  {
    id: "recording_ready_info",
    kind: "info",
    copy: {
      title: "Ready to record",
      body: "The phonograph is now ready to record. Get ready to talk into the horn, then press Continue to start the countdown.",
    },
  },
  { id: "brake_shift", kind: "brakeShift" },
  { id: "recording", kind: "recording" },
  {
    id: "playback_setup_info",
    kind: "info",
    copy: {
      title: "Playback setup",
      body: "To playback our recording we need to remove the recording parts and assemble the playback parts.",
    },
  },
  { id: "recording_trumpet_unmount", kind: "unmount", partId: "recording_trumpet" },
  { id: "recording_diaphragm_unmount", kind: "unmount", partId: "recording_diaphragm" },
  {
    id: "playback_diaphragm_mount",
    kind: "mount",
    partId: "playback_diaphragm",
    snapPointId: "diaphragm_snap_point",
    placard: {
      ...MOUNT_PLACARD_DEFAULTS,
      panelConfig: "./ui/playback-diaphragm-mount-instruction.json",
    },
  },
  {
    id: "playback_trumpet_mount",
    kind: "mount",
    partId: "playback_trumpet",
    snapPointId: "trumpet_snap_point",
    placard: {
      ...MOUNT_PLACARD_DEFAULTS,
      panelConfig: "./ui/playback-trumpet-mount-instruction.json",
      offsetZ: 0.25,
    },
  },
  {
    id: "playback_ready_info",
    kind: "info",
    copy: {
      title: "Playback ready",
      body: "Phonograph is ready to play your recording.",
    },
  },
  { id: "playback_brake_shift", kind: "brakeShift" },
  { id: "playback", kind: "playback" },
  { id: "done", kind: "menu" },
];

export const TASK_ORDER: string[] = TASK_FLOW.map((task) => task.id);

/** Next task id, wrapping `done` back to `main_menu`. */
export function nextTaskId(currentId: string): string | undefined {
  const index = TASK_ORDER.indexOf(currentId);
  if (index < 0) return undefined;
  return TASK_ORDER[(index + 1) % TASK_ORDER.length];
}

export interface MountBinding {
  partId: string;
  snapPointId: string;
}

export const MOUNT_BY_TASK: Record<string, MountBinding> = {};
export const PLACARD_BY_TASK: Record<string, { partId: string; placard: PlacardSpec }> =
  {};
export const PANEL_COPY_BY_TASK: Record<string, PanelCopy> = {};
export const UNMOUNT_BY_TASK: Record<string, { partId: string }> = {};

for (const task of TASK_FLOW) {
  switch (task.kind) {
    case "mount":
      MOUNT_BY_TASK[task.id] = {
        partId: task.partId,
        snapPointId: task.snapPointId,
      };
      PLACARD_BY_TASK[task.id] = { partId: task.partId, placard: task.placard };
      break;
    case "crank":
      PLACARD_BY_TASK[task.id] = { partId: task.partId, placard: task.placard };
      break;
    case "unmount":
      UNMOUNT_BY_TASK[task.id] = { partId: task.partId };
      break;
    case "info":
      PANEL_COPY_BY_TASK[task.id] = task.copy;
      break;
    default:
      break;
  }
}

export const MOUNT_TASK_IDS = Object.keys(MOUNT_BY_TASK);
export const PLACARD_TASK_IDS = Object.keys(PLACARD_BY_TASK);
export const UNMOUNT_TASK_IDS = Object.keys(UNMOUNT_BY_TASK);
export const INFO_TASK_IDS = Object.keys(PANEL_COPY_BY_TASK);
