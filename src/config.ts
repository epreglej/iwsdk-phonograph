import { Object3D, Quaternion, Vector3 } from "@iwsdk/core";

export type Vec3 = [number, number, number];
type Quat = [number, number, number, number];

const IDENTITY_QUAT: Quat = [0, 0, 0, 1];

export const BRAKE_PLAY = { x: -0.1, y: 0.16, z: 0.0725 };
const BRAKE_SHIFT_X = 0.035;
export const BRAKE_STOP = {
  x: BRAKE_PLAY.x + BRAKE_SHIFT_X,
  y: BRAKE_PLAY.y,
  z: BRAKE_PLAY.z,
};

export type PartBehaviorTag = "cylinder" | "crank" | "brake";

export interface PartLayout {
  id: string;
  assetKey: string;
  position: Vec3;
  quaternion: Quat;
  visible: boolean;
  behaviorTag?: PartBehaviorTag;
}

export interface SnapPointLayout {
  id: string;
  ghostAssetKey: string;
  position: Vec3;
  quaternion: Quat;
}

export const PART_LAYOUT: PartLayout[] = [
  {
    id: "cylinder",
    assetKey: "cylinder",
    position: [0.4, 0.05, 0.1],
    quaternion: IDENTITY_QUAT,
    visible: false,
    behaviorTag: "cylinder",
  },
  {
    id: "recorder",
    assetKey: "recorder",
    position: [-0.4, 0.015, 0.1],
    quaternion: IDENTITY_QUAT,
    visible: false,
  },
  {
    id: "reproducer",
    assetKey: "reproducer",
    position: [-0.4, 0.015, 0.1],
    quaternion: IDENTITY_QUAT,
    visible: false,
  },
  {
    id: "recording_horn",
    assetKey: "recording_horn",
    position: [-0.4, 0.1225, 0.1],
    quaternion: [-0.766, 0, 0, 0.6428],
    visible: false,
  },
  {
    id: "listening_horn",
    assetKey: "listening_horn",
    position: [-0.4, 0.1225, 0.1],
    quaternion: [-0.766, 0, 0, 0.6428],
    visible: false,
  },
  {
    id: "crank",
    assetKey: "crank",
    position: [0.185, 0.085, -0.0365],
    quaternion: IDENTITY_QUAT,
    visible: false,
    behaviorTag: "crank",
  },
  {
    id: "brake",
    assetKey: "brake",
    position: [BRAKE_STOP.x, BRAKE_STOP.y, BRAKE_STOP.z],
    quaternion: IDENTITY_QUAT,
    visible: true,
    behaviorTag: "brake",
  },
];

export const CARRIAGE_SNAP_POINT_IDS = [
  "recorder_snap_point",
  "horn_snap_point",
] as const;

export const CARRIAGE_PART_IDS = [
  "recorder",
  "reproducer",
  "recording_horn",
  "listening_horn",
] as const;

export const CARRIAGE_LAYOUT = {
  assetKey: "carriage",
  position: [0.08, 0.2375, 0.03885] as Vec3,
  quaternion: IDENTITY_QUAT,
  startX: 0.08,
  endX: -0.08,
  travelDurationS: 120,
};

export const SNAP_POINT_LAYOUT: SnapPointLayout[] = [
  {
    id: "cylinder_snap_point",
    ghostAssetKey: "cylinder",
    position: [0.01, 0.23, -0.05],
    quaternion: [-0.000111, 0.005654, -0.019514, 1],
  },
  {
    id: "recorder_snap_point",
    ghostAssetKey: "recorder",
    position: [0.09, 0.2945, -0.01625],
    quaternion: [-0.1, -0.002, -0.02, 0.995],
  },
  {
    id: "horn_snap_point",
    ghostAssetKey: "recording_horn",
    position: [0.09025, 0.3975, 0.455],
    quaternion: [-0.78, 0, 0, 0.625],
  },
];

// --- Task flow data ---

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

export type TaskDef =
  | { id: string; kind: "menu"; panel: TaskPanelSpec }
  | { id: string; kind: "intro"; panel: TaskPanelSpec }
  | { id: string; kind: "mount"; partId: string; snapPointId: string; placard: PlacardSpec }
  | { id: string; kind: "crank"; partId: string; placard: PlacardSpec }
  | { id: string; kind: "unmount"; partId: string; placard: PlacardSpec }
  | { id: string; kind: "brakeShift"; partId: string; placard: PlacardSpec }
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

export const TASK_FLOW: TaskDef[] = [
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

// --- Carriage spatial helpers ---

const _worldPos = new Vector3();
const _worldQuat = new Quaternion();
const _parentWorldQuat = new Quaternion();
const _localQuat = new Quaternion();

export function isCarriageSnapPoint(snapPointId: string): boolean {
  return (CARRIAGE_SNAP_POINT_IDS as readonly string[]).includes(snapPointId);
}

export function isCarriagePart(partId: string | null | undefined): boolean {
  return partId != null && (CARRIAGE_PART_IDS as readonly string[]).includes(partId);
}

export function snapPointLocalOnCarriage(phonographLocal: Vec3): Vec3 {
  const [, cy, cz] = CARRIAGE_LAYOUT.position;
  return [0, phonographLocal[1] - cy, phonographLocal[2] - cz];
}

export function reparentObject3D(child: Object3D, newParent: Object3D): void {
  child.updateWorldMatrix(true, false);
  child.getWorldPosition(_worldPos);
  child.getWorldQuaternion(_worldQuat);

  newParent.add(child);
  newParent.updateWorldMatrix(true, false);
  newParent.worldToLocal(_worldPos);
  child.position.copy(_worldPos);

  newParent.getWorldQuaternion(_parentWorldQuat);
  _parentWorldQuat.invert();
  _localQuat.copy(_parentWorldQuat).multiply(_worldQuat);
  child.quaternion.copy(_localQuat);
}
