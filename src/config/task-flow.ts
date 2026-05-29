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
  | { id: string; kind: "unmount"; partId: string; placard: PlacardSpec }
  | { id: string; kind: "brakeShift"; partId: string; placard: PlacardSpec }
  | { id: string; kind: "recording"; partId: string; placard: PlacardSpec }
  | { id: string; kind: "playback" };

const MOUNT_PLACARD_DEFAULTS = {
  offsetY: 0.2,
  dismissOnGrab: false,
  dismissOnSnap: true,
  autoDismissMs: 0,
} as const;

const BRAKE_PLACARD_DEFAULTS = {
  offsetX: 0,
  offsetY: 0.2,
  offsetZ: 0,
  dismissOnGrab: false,
  dismissOnSnap: false,
  autoDismissMs: 0,
} as const;

const BRAKE_RECORDING_PLACARD: PlacardSpec = {
  ...BRAKE_PLACARD_DEFAULTS,
  panelConfig: "./ui/brake-shift-instruction.json",
};

const BRAKE_RECORDING_STOP_PLACARD: PlacardSpec = {
  ...BRAKE_PLACARD_DEFAULTS,
  panelConfig: "./ui/brake-recording-stop-instruction.json",
};

const BRAKE_PLAYBACK_PLACARD: PlacardSpec = {
  ...BRAKE_PLACARD_DEFAULTS,
  panelConfig: "./ui/playback-brake-shift-instruction.json",
};

export const TASK_FLOW: TaskDef[] = [
  { id: "main_menu", kind: "menu" },
  {
    id: "recording_setup_info",
    kind: "info",
    copy: {
      title: "Recording setup",
      body: "To make a recording, the phonograph first needs to be assembled with its recording parts. Each piece — the wax cylinder, diaphragm, horn, and crank — prepares the machine to capture sound in the groove.",
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
      body: "The machine is wound and ready. Your voice will travel through the horn and into the wax — the brake lever is what brings the recording stylus into the groove.",
    },
  },
  {
    id: "brake_shift",
    kind: "brakeShift",
    partId: "brake",
    placard: BRAKE_RECORDING_PLACARD,
  },
  { id: "recording", kind: "recording", partId: "brake", placard: BRAKE_RECORDING_STOP_PLACARD },
  {
    id: "playback_setup_info",
    kind: "info",
    copy: {
      title: "Playback setup",
      body: "To hear what was recorded, the phonograph must be reconfigured for playback. The recording parts come off and lighter reproducer parts take their place.",
    },
  },
  { id: "recording_trumpet_unmount", kind: "unmount", partId: "recording_trumpet", placard: {
      ...MOUNT_PLACARD_DEFAULTS,
      dismissOnGrab: true,
      dismissOnSnap: false,
      panelConfig: "./ui/recording-trumpet-unmount-instruction.json",
      offsetZ: 0.25,
    },
  },
  { id: "recording_diaphragm_unmount", kind: "unmount", partId: "recording_diaphragm", placard: {
      ...MOUNT_PLACARD_DEFAULTS,
      dismissOnGrab: true,
      dismissOnSnap: false,
      panelConfig: "./ui/recording-diaphragm-unmount-instruction.json",
    },
  },
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
      body: "The playback reproducer is in place. Engaging the brake lets a lighter stylus trace the groove and send the sound back out through the horn.",
    },
  },
  {
    id: "playback_brake_shift",
    kind: "brakeShift",
    partId: "brake",
    placard: BRAKE_PLAYBACK_PLACARD,
  },
  { id: "playback", kind: "playback" },
  { id: "done", kind: "menu" },
];

export const TASK_ORDER: string[] = TASK_FLOW.map((task) => task.id);

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
    case "brakeShift":
      PLACARD_BY_TASK[task.id] = { partId: task.partId, placard: task.placard };
      break;
    case "recording":
      PLACARD_BY_TASK[task.id] = { partId: task.partId, placard: task.placard };
      break;
    case "unmount":
      UNMOUNT_BY_TASK[task.id] = { partId: task.partId };
      PLACARD_BY_TASK[task.id] = { partId: task.partId, placard: task.placard };
      break;
    case "info":
      PANEL_COPY_BY_TASK[task.id] = task.copy;
      break;
    default:
      break;
  }
}

export const INFO_TASK_IDS = Object.keys(PANEL_COPY_BY_TASK);

const INTERACTIVE_TASK_KINDS = new Set<TaskDef["kind"]>([
  "mount",
  "crank",
  "unmount",
  "brakeShift",
  "recording",
]);

export function isInteractiveTask(taskId: string): boolean {
  const task = TASK_FLOW.find((entry) => entry.id === taskId);
  return task != null && INTERACTIVE_TASK_KINDS.has(task.kind);
}
