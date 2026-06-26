/** Pause after narration before advancing/closing any narrated panel. */
export const NARRATION_POST_DELAY_MS = 400;

/** Placard panel width; keep in sync with UI card width in uikitml. */
export const PANEL_MAX_WIDTH = 0.294;

/** Narration placard width; match info detail panels in part-info-config. */
export const NARRATION_PANEL_MAX_WIDTH = 0.21;

/** World-space panel width; keep in sync with menu UI card width in uikitml. */
export const HEAD_PANEL_MAX_WIDTH = 0.318;
export const PHONOGRAPH_PANEL_MAX_WIDTH = 0.245;
/** Vertical offset for panels above the phonograph root. */
export const PHONOGRAPH_ABOVE_OFFSET_Y = 0.55;
/** Forward distance from the user when the phonograph appears (meters). */
export const PHONOGRAPH_SPAWN_FORWARD_M = 0.8;
/** Vertical offset below the user's head when the phonograph appears (meters). */
export const PHONOGRAPH_SPAWN_BELOW_HEAD_M = 0.35;

/** Story task identifiers — phase prefix + step name. */
export const TaskId = {
  Welcome: "welcome",
  Complete: "complete",
  AssemblyIntroNarrate1: "assembly_intro_narrate_1",
  AssemblyIntroNarrate2: "assembly_intro_narrate_2",
  AssemblyNarrate1: "assembly_narrate_1",
  AssemblyPhonographInfo: "assembly_phonograph_info",
  AssemblyCylinderMount: "assembly_cylinder_mount",
  AssemblyRecorderMount: "assembly_recorder_mount",
  AssemblyRecordingHornMount: "assembly_recording_horn_mount",
  AssemblyCompleteNarrate1: "assembly_complete_narrate_1",
  AssemblyCompleteNarrate2: "assembly_complete_narrate_2",
  RecordingCrankWind: "recording_crank_wind",
  RecordingBrakeRelease: "recording_brake_release",
  RecordingCarriageLower: "recording_carriage_lower",
  RecordingSpeakNarrate: "recording_speak_narrate",
  RecordingSpeak: "recording_speak",
  RecordingCompleteNarrate1: "recording_complete_narrate_1",
  RecordingCompleteNarrate2: "recording_complete_narrate_2",
  PlaybackSetupRemovePartsNarrate: "playback_setup_remove_parts_narrate",
  PlaybackSetupRecordingHornUnmount: "playback_setup_recording_horn_unmount",
  PlaybackSetupRecorderUnmount: "playback_setup_recorder_unmount",
  PlaybackSetupCarriageReturn: "playback_setup_carriage_return",
  PlaybackSetupReproducerMount: "playback_setup_reproducer_mount",
  PlaybackSetupListeningHornMount: "playback_setup_listening_horn_mount",
  PlaybackReadyNarrate1: "playback_ready_narrate_1",
  PlaybackBrakeRelease: "playback_brake_release",
  PlaybackCarriageLower: "playback_carriage_lower",
  PlaybackListen: "playback_listen",
} as const;

export interface PlacardSpec {
  panelConfig: string;
  maxWidth?: number;
  offsetX?: number;
  offsetY?: number;
  offsetZ?: number;
  dismissOnGrab?: boolean;
  dismissOnSnap?: boolean;
  autoDismissMs?: number;
  /** Show without waiting for a 3D part pop-in (head-anchored intro lines). */
  skipPartPopInWait?: boolean;
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

export interface PlacardBinding {
  partId?: string;
  anchor?: "head" | "part" | "phonograph_spawn";
  placard: PlacardSpec;
}

export interface TaskDef {
  id: string;
  partId?: string;
  snapPointId?: string;
  panel?: TaskPanelSpec;
  placard?: PlacardSpec;
  placards?: PlacardBinding[];
  revealPart?: boolean;
  revealPartId?: string;
  revealOnComplete?: string;
  narration?: string;
  afterNarrationMs?: number;
  hintAudio?: string;
  unmount?: boolean;
  interactive?: boolean;
  startRecordingOnStart?: boolean;
  /** Part(s) that show a floating name tag while this task is active. */
  nameTagPartId?: string;
  nameTagPartIds?: string[];
  /** Part(s) that also show an extra action label alongside the info name tag. */
  actionNameTagPartId?: string;
  actionNameTagPartIds?: string[];
}

const HEAD_MENU_PANEL = {
  maxWidth: HEAD_PANEL_MAX_WIDTH,
  anchor: "head" as const,
  offsetY: -0.15,
  offsetZ: -(PHONOGRAPH_SPAWN_FORWARD_M - 0.2),
  faceTarget: true,
};

const PHONOGRAPH_MENU_PANEL = {
  maxWidth: PHONOGRAPH_PANEL_MAX_WIDTH,
  anchor: "phonograph" as const,
  offsetY: PHONOGRAPH_ABOVE_OFFSET_Y,
  billboard: true,
};

function phonographNarrationPlacard(panelConfig: string): PlacardBinding[] {
  return [
    {
      anchor: "part",
      partId: "phonograph",
      placard: {
        panelConfig,
        maxWidth: NARRATION_PANEL_MAX_WIDTH,
        dismissOnSnap: false,
        dismissOnGrab: false,
      },
    },
  ];
}

function spawnPreviewNarrationPlacard(panelConfig: string): PlacardBinding[] {
  return [
    {
      anchor: "phonograph_spawn",
      placard: {
        panelConfig,
        maxWidth: NARRATION_PANEL_MAX_WIDTH,
        offsetY: PHONOGRAPH_ABOVE_OFFSET_Y,
        dismissOnSnap: false,
        dismissOnGrab: false,
        skipPartPopInWait: true,
      },
    },
  ];
}

const TASKS: TaskDef[] = [
  {
    id: TaskId.Welcome,
    panel: {
      ...HEAD_MENU_PANEL,
      panelConfig: "./ui/menus/welcome.json",
      buttonId: "welcome-begin-button",
    },
  },
  {
    id: TaskId.AssemblyIntroNarrate1,
    placards: spawnPreviewNarrationPlacard("./ui/assembly/intro-narrate-1.json"),
    narration: "./audio/intro-1.wav",
    afterNarrationMs: NARRATION_POST_DELAY_MS,
  },
  {
    id: TaskId.AssemblyIntroNarrate2,
    placards: spawnPreviewNarrationPlacard("./ui/assembly/intro-narrate-2.json"),
    narration: "./audio/intro-2.wav",
    afterNarrationMs: NARRATION_POST_DELAY_MS,
  },
  {
    id: TaskId.AssemblyPhonographInfo,
    nameTagPartId: "phonograph",
  },
  {
    id: TaskId.AssemblyNarrate1,
    placards: phonographNarrationPlacard("./ui/assembly/assembly-narrate-1.json"),
    narration: "./audio/assembly-1.wav",
    afterNarrationMs: NARRATION_POST_DELAY_MS,
  },
  {
    id: TaskId.AssemblyCylinderMount,
    partId: "cylinder",
    snapPointId: "cylinder_snap_point",
    nameTagPartId: "cylinder",
    interactive: true,
    revealOnComplete: "recorder",
  },
  {
    id: TaskId.AssemblyRecorderMount,
    partId: "recorder",
    snapPointId: "recorder_snap_point",
    nameTagPartId: "recorder",
    interactive: true,
    revealOnComplete: "recording_horn",
  },
  {
    id: TaskId.AssemblyRecordingHornMount,
    partId: "recording_horn",
    snapPointId: "horn_snap_point",
    nameTagPartId: "recording_horn",
    interactive: true,
  },
  {
    id: TaskId.AssemblyCompleteNarrate1,
    placards: phonographNarrationPlacard(
      "./ui/assembly/assembly-complete-narrate-1.json",
    ),
    narration: "./audio/assembly-2.wav",
    afterNarrationMs: NARRATION_POST_DELAY_MS,
  },
  {
    id: TaskId.AssemblyCompleteNarrate2,
    placards: phonographNarrationPlacard(
      "./ui/assembly/assembly-complete-narrate-2.json",
    ),
    narration: "./audio/recording-1.wav",
    afterNarrationMs: NARRATION_POST_DELAY_MS,
  },
  {
    id: TaskId.RecordingCrankWind,
    partId: "crank",
    nameTagPartId: "crank",
    revealPart: true,
    interactive: true,
  },
  {
    id: TaskId.RecordingBrakeRelease,
    partId: "brake",
    nameTagPartId: "brake",
    interactive: true,
  },
  {
    id: TaskId.RecordingCarriageLower,
    partId: "carriage",
    nameTagPartId: "carriage",
    actionNameTagPartId: "carriage",
    interactive: true,
  },
  {
    id: TaskId.RecordingSpeakNarrate,
    placards: phonographNarrationPlacard(
      "./ui/recording/speak-into-horn-narrate.json",
    ),
    narration: "./audio/recording-2.wav",
    afterNarrationMs: NARRATION_POST_DELAY_MS,
    startRecordingOnStart: true,
  },
  {
    id: TaskId.RecordingSpeak,
    partId: "brake",
    nameTagPartId: "brake",
    interactive: true,
  },
  {
    id: TaskId.RecordingCompleteNarrate1,
    placards: phonographNarrationPlacard(
      "./ui/playback-setup/reassemble-narrate-1.json",
    ),
    narration: "./audio/reassembly-1.wav",
    afterNarrationMs: NARRATION_POST_DELAY_MS,
  },
  {
    id: TaskId.RecordingCompleteNarrate2,
    placards: phonographNarrationPlacard(
      "./ui/playback-setup/reassemble-narrate-2.json",
    ),
    narration: "./audio/reassembly-2.wav",
    afterNarrationMs: NARRATION_POST_DELAY_MS,
  },
  {
    id: TaskId.PlaybackSetupRemovePartsNarrate,
    placards: phonographNarrationPlacard(
      "./ui/playback-setup/remove-recording-parts-narrate.json",
    ),
    afterNarrationMs: 5500,
  },
  {
    id: TaskId.PlaybackSetupRecordingHornUnmount,
    partId: "recording_horn",
    unmount: true,
    interactive: true,
  },
  {
    id: TaskId.PlaybackSetupRecorderUnmount,
    partId: "recorder",
    unmount: true,
    interactive: true,
  },
  {
    id: TaskId.PlaybackSetupCarriageReturn,
    partId: "carriage",
    nameTagPartId: "carriage",
    interactive: true,
    revealOnComplete: "reproducer",
  },
  {
    id: TaskId.PlaybackSetupReproducerMount,
    partId: "reproducer",
    snapPointId: "recorder_snap_point",
    nameTagPartId: "reproducer",
    interactive: true,
    revealOnComplete: "listening_horn",
  },
  {
    id: TaskId.PlaybackSetupListeningHornMount,
    partId: "listening_horn",
    snapPointId: "listening_horn_snap_point",
    nameTagPartId: "listening_horn",
    interactive: true,
  },
  {
    id: TaskId.PlaybackReadyNarrate1,
    placards: phonographNarrationPlacard("./ui/playback/ready-narrate-1.json"),
    narration: "./audio/playback-1.wav",
    afterNarrationMs: NARRATION_POST_DELAY_MS,
  },
  {
    id: TaskId.PlaybackBrakeRelease,
    partId: "brake",
    nameTagPartId: "brake",
    interactive: true,
  },
  {
    id: TaskId.PlaybackCarriageLower,
    partId: "carriage",
    nameTagPartId: "carriage",
    interactive: true,
  },
  { id: TaskId.PlaybackListen },
  {
    id: TaskId.Complete,
    panel: {
      ...PHONOGRAPH_MENU_PANEL,
      panelConfig: "./ui/menus/complete.json",
      buttonId: "complete-restart-button",
      deferCompleteOnDismiss: false,
    },
  },
];

export const TASK_ORDER: string[] = TASKS.map((task) => task.id);

export interface MountBinding {
  partId: string;
  snapPointId: string;
}

export const TASK_BY_ID: Record<string, TaskDef> = {};
export const MOUNT_BY_TASK: Record<string, MountBinding> = {};
export const PLACARD_BY_TASK: Record<string, PlacardBinding> = {};
export const PLACARDS_BY_TASK: Record<string, PlacardBinding[]> = {};
export const TASK_PANEL_BY_TASK: Record<string, TaskPanelSpec> = {};
export const UNMOUNT_BY_TASK: Record<string, { partId: string }> = {};
export const NAME_TAGS_BY_TASK: Record<string, string[]> = {};
export const ACTION_NAME_TAGS_BY_TASK: Record<string, string[]> = {};

function placardBindingsForTask(task: TaskDef): PlacardBinding[] {
  if (task.placards?.length) return task.placards;
  if (task.placard && task.partId) {
    return [{ anchor: "part", partId: task.partId, placard: task.placard }];
  }
  return [];
}

for (const task of TASKS) {
  TASK_BY_ID[task.id] = task;
  if (task.panel) TASK_PANEL_BY_TASK[task.id] = task.panel;
  const bindings = placardBindingsForTask(task);
  if (bindings.length > 0) {
    PLACARDS_BY_TASK[task.id] = bindings;
    PLACARD_BY_TASK[task.id] = bindings[0];
  }
  if (task.snapPointId && task.partId) {
    MOUNT_BY_TASK[task.id] = {
      partId: task.partId,
      snapPointId: task.snapPointId,
    };
  }
  if (task.unmount && task.partId) {
    UNMOUNT_BY_TASK[task.id] = { partId: task.partId };
  }
  const nameTagPartIds =
    task.nameTagPartIds ??
    (task.nameTagPartId ? [task.nameTagPartId] : undefined);
  if (nameTagPartIds?.length) {
    NAME_TAGS_BY_TASK[task.id] = nameTagPartIds;
  }
  const actionNameTagPartIds =
    task.actionNameTagPartIds ??
    (task.actionNameTagPartId ? [task.actionNameTagPartId] : undefined);
  if (actionNameTagPartIds?.length) {
    ACTION_NAME_TAGS_BY_TASK[task.id] = actionNameTagPartIds;
  }
}
