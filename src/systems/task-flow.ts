import { createComponent, createSystem, Types } from "@iwsdk/core";
import { playTaskChime } from "../audio/sfx.js";
import { InteractionGate } from "./interaction-gate.js";

export const Task = createComponent("Task", {
  id: { type: Types.String, default: "main_menu" },
});
export const ActiveTask = createComponent("ActiveTask", {});
export const CompletedTask = createComponent("CompletedTask", {});

export interface PlacardSpec {
  panelConfig: string;
  maxWidth?: number;
  offsetX?: number;
  offsetY?: number;
  offsetZ?: number;
  dismissOnGrab?: boolean;
  dismissOnSnap?: boolean;
  autoDismissMs?: number;
}

export interface TaskPanelSpec {
  panelConfig: string;
  maxWidth?: number;
  anchor: "head" | "phonograph";
  offsetX?: number;
  offsetY?: number;
  offsetZ?: number;
  faceTarget?: boolean;
  billboard?: boolean;
  buttonId?: string;
  deferCompleteOnDismiss?: boolean;
  autoCompleteMs?: number;
}

type TaskDef =
  | { id: string; kind: "menu"; panel: TaskPanelSpec }
  | { id: string; kind: "intro"; panel: TaskPanelSpec }
  | { id: string; kind: "mount"; partId: string; snapPointId: string; placard: PlacardSpec }
  | { id: string; kind: "crank"; partId: string; placard: PlacardSpec }
  | { id: string; kind: "unmount"; partId: string; placard: PlacardSpec }
  | { id: string; kind: "brakeShift"; partId: string; placard: PlacardSpec }
  | { id: string; kind: "carriageLower"; partId: string; placard: PlacardSpec }
  | { id: string; kind: "carriageReturn"; partId: string; placard: PlacardSpec }
  | {
      id: string;
      kind: "recording";
      partId: string;
      placard: PlacardSpec;
      panel: TaskPanelSpec;
    }
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
  panelConfig: "./ui/placards/brake-shift-instruction.json",
};

const BRAKE_RECORDING_STOP_PLACARD: PlacardSpec = {
  ...BRAKE_PLACARD_DEFAULTS,
  panelConfig: "./ui/placards/brake-recording-stop-instruction.json",
};

const BRAKE_PLAYBACK_PLACARD: PlacardSpec = {
  ...BRAKE_PLACARD_DEFAULTS,
  panelConfig: "./ui/placards/playback-brake-shift-instruction.json",
};

const CARRIAGE_LOWER_RECORDING_PLACARD: PlacardSpec = {
  ...BRAKE_PLACARD_DEFAULTS,
  panelConfig: "./ui/placards/carriage-lower-recording-instruction.json",
};

const CARRIAGE_LOWER_PLAYBACK_PLACARD: PlacardSpec = {
  ...BRAKE_PLACARD_DEFAULTS,
  panelConfig: "./ui/placards/carriage-lower-playback-instruction.json",
};

const HEAD_MENU_PANEL = {
  maxWidth: 0.455,
  anchor: "head" as const,
  offsetY: -0.15,
  offsetZ: -0.5,
  faceTarget: true,
};

const PHONOGRAPH_MENU_PANEL = {
  maxWidth: 0.35,
  anchor: "phonograph" as const,
  offsetY: 0.55,
  billboard: true,
};

const PHONOGRAPH_INTRO_PANEL_DEFAULTS = {
  maxWidth: 0.35,
  anchor: "phonograph" as const,
  offsetY: 0.55,
  billboard: true,
  autoCompleteMs: 5000,
} as const;

const RECORDING_INDICATOR_PANEL: TaskPanelSpec = {
  panelConfig: "./ui/panels/recording-indicator.json",
  maxWidth: 0.38,
  anchor: "phonograph",
  offsetY: 0.5,
  billboard: true,
};

const TASK_FLOW: TaskDef[] = [
  {
    id: "main_menu",
    kind: "menu",
    panel: {
      ...HEAD_MENU_PANEL,
      panelConfig: "./ui/menus/main-menu.json",
      buttonId: "start-learning-button",
    },
  },
  {
    id: "assembly_intro",
    kind: "intro",
    panel: {
      ...PHONOGRAPH_INTRO_PANEL_DEFAULTS,
      panelConfig: "./ui/intros/assembly-intro.json",
    },
  },
  {
    id: "cylinder_mount",
    kind: "mount",
    partId: "cylinder",
    snapPointId: "cylinder_snap_point",
    placard: {
      ...MOUNT_PLACARD_DEFAULTS,
      panelConfig: "./ui/placards/cylinder-mount-instruction.json",
    },
  },
  {
    id: "recorder_mount",
    kind: "mount",
    partId: "recorder",
    snapPointId: "recorder_snap_point",
    placard: {
      ...MOUNT_PLACARD_DEFAULTS,
      panelConfig: "./ui/placards/recorder-mount-instruction.json",
    },
  },
  {
    id: "recording_horn_mount",
    kind: "mount",
    partId: "recording_horn",
    snapPointId: "horn_snap_point",
    placard: {
      ...MOUNT_PLACARD_DEFAULTS,
      panelConfig: "./ui/placards/recording-horn-mount-instruction.json",
      offsetZ: 0.25,
    },
  },
  {
    id: "crank_cranking",
    kind: "crank",
    partId: "crank",
    placard: {
      panelConfig: "./ui/placards/crank-cranking-instruction.json",
      offsetX: 0.1,
      offsetY: 0.2,
      offsetZ: 0,
      dismissOnGrab: false,
      dismissOnSnap: true,
      autoDismissMs: 0,
    },
  },
  {
    id: "recording_intro",
    kind: "intro",
    panel: {
      ...PHONOGRAPH_INTRO_PANEL_DEFAULTS,
      panelConfig: "./ui/intros/recording-intro.json",
    },
  },
  {
    id: "brake_shift",
    kind: "brakeShift",
    partId: "brake",
    placard: BRAKE_RECORDING_PLACARD,
  },
  {
    id: "recording_carriage_lower",
    kind: "carriageLower",
    partId: "carriage",
    placard: CARRIAGE_LOWER_RECORDING_PLACARD,
  },
  {
    id: "recording",
    kind: "recording",
    partId: "brake",
    placard: BRAKE_RECORDING_STOP_PLACARD,
    panel: RECORDING_INDICATOR_PANEL,
  },
  {
    id: "reassembly_intro",
    kind: "intro",
    panel: {
      ...PHONOGRAPH_INTRO_PANEL_DEFAULTS,
      panelConfig: "./ui/intros/reassembly-intro.json",
    },
  },
  {
    id: "recording_horn_unmount",
    kind: "unmount",
    partId: "recording_horn",
    placard: {
      ...MOUNT_PLACARD_DEFAULTS,
      dismissOnGrab: true,
      dismissOnSnap: false,
      panelConfig: "./ui/placards/recording-horn-unmount-instruction.json",
      offsetZ: 0.25,
    },
  },
  {
    id: "recorder_unmount",
    kind: "unmount",
    partId: "recorder",
    placard: {
      ...MOUNT_PLACARD_DEFAULTS,
      dismissOnGrab: true,
      dismissOnSnap: false,
      panelConfig: "./ui/placards/recorder-unmount-instruction.json",
    },
  },
  {
    id: "carriage_return",
    kind: "carriageReturn",
    partId: "carriage",
    placard: {
      ...BRAKE_PLACARD_DEFAULTS,
      panelConfig: "./ui/placards/carriage-return-instruction.json",
    },
  },
  {
    id: "reproducer_mount",
    kind: "mount",
    partId: "reproducer",
    snapPointId: "recorder_snap_point",
    placard: {
      ...MOUNT_PLACARD_DEFAULTS,
      panelConfig: "./ui/placards/reproducer-mount-instruction.json",
    },
  },
  {
    id: "listening_horn_mount",
    kind: "mount",
    partId: "listening_horn",
    snapPointId: "horn_snap_point",
    placard: {
      ...MOUNT_PLACARD_DEFAULTS,
      panelConfig: "./ui/placards/listening-horn-mount-instruction.json",
      offsetZ: 0.25,
    },
  },
  {
    id: "playback_intro",
    kind: "intro",
    panel: {
      ...PHONOGRAPH_INTRO_PANEL_DEFAULTS,
      panelConfig: "./ui/intros/playback-intro.json",
    },
  },
  {
    id: "playback_brake_shift",
    kind: "brakeShift",
    partId: "brake",
    placard: BRAKE_PLAYBACK_PLACARD,
  },
  {
    id: "playback_carriage_lower",
    kind: "carriageLower",
    partId: "carriage",
    placard: CARRIAGE_LOWER_PLAYBACK_PLACARD,
  },
  { id: "playback", kind: "playback" },
  {
    id: "done",
    kind: "menu",
    panel: {
      ...PHONOGRAPH_MENU_PANEL,
      panelConfig: "./ui/menus/end-menu.json",
      buttonId: "end-menu-restart-button",
      deferCompleteOnDismiss: false,
    },
  },
];

export const TASK_ORDER: string[] = TASK_FLOW.map((task) => task.id);

export interface MountBinding {
  partId: string;
  snapPointId: string;
}

export const MOUNT_BY_TASK: Record<string, MountBinding> = {};
export const PLACARD_BY_TASK: Record<string, { partId: string; placard: PlacardSpec }> =
  {};
export const TASK_PANEL_BY_TASK: Record<string, TaskPanelSpec> = {};
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
    case "carriageLower":
    case "carriageReturn":
      PLACARD_BY_TASK[task.id] = { partId: task.partId, placard: task.placard };
      break;
    case "recording":
      PLACARD_BY_TASK[task.id] = { partId: task.partId, placard: task.placard };
      TASK_PANEL_BY_TASK[task.id] = task.panel;
      break;
    case "unmount":
      UNMOUNT_BY_TASK[task.id] = { partId: task.partId };
      PLACARD_BY_TASK[task.id] = { partId: task.partId, placard: task.placard };
      break;
    case "intro":
    case "menu":
      TASK_PANEL_BY_TASK[task.id] = task.panel;
      break;
    default:
      break;
  }
}

const INTERACTIVE_TASK_KINDS = new Set<TaskDef["kind"]>([
  "mount",
  "crank",
  "unmount",
  "brakeShift",
  "carriageLower",
  "carriageReturn",
  "recording",
]);

export class TaskFlowSystem extends createSystem({
  completedActiveTask: { required: [Task, ActiveTask, CompletedTask] },
  activeTask: { required: [Task, ActiveTask], excluded: [CompletedTask] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.activeTask.subscribe("qualify", (entity) => {
        const taskId = entity.getValue(Task, "id")!;
        if (this.isInteractiveTask(taskId)) {
          this.world.sceneEntity.addComponent(InteractionGate);
        } else {
          this.world.sceneEntity.removeComponent(InteractionGate);
        }
      }),

      this.queries.completedActiveTask.subscribe("qualify", (entity) => {
        const completedId = entity.getValue(Task, "id")!;
        playTaskChime();
        this.advance(completedId);
        entity.dispose();
      }),
    );
  }

  private advance(completedId: string): void {
    const nextId = this.nextTaskId(completedId);
    if (!nextId) return;

    this.world
      .createEntity()
      .addComponent(ActiveTask)
      .addComponent(Task, { id: nextId });
  }

  private nextTaskId(currentId: string): string | undefined {
    const index = TASK_ORDER.indexOf(currentId);
    if (index < 0) return undefined;
    return TASK_ORDER[(index + 1) % TASK_ORDER.length];
  }

  private isInteractiveTask(taskId: string): boolean {
    const task = TASK_FLOW.find((entry) => entry.id === taskId);
    return task != null && INTERACTIVE_TASK_KINDS.has(task.kind);
  }
}
