export const NARRATION_POST_DELAY_MS = 800;

/** World-space panel width; keep in sync with UI card `width` in uikitml (196px @ 280→30% tighter). */
export const PANEL_MAX_WIDTH = 0.294;
export const HEAD_PANEL_MAX_WIDTH = 0.318;
export const PHONOGRAPH_PANEL_MAX_WIDTH = 0.245;
/** Vertical offset for placards and panels above the phonograph root. */
export const PHONOGRAPH_ABOVE_OFFSET_Y = 0.55;

/** Story task identifiers — phase prefix + step name. */
export const TaskId = {
  Welcome: "welcome",
  Complete: "complete",
  AssemblyIntro: "assembly_intro",
  AssemblyIntroNarrate1: "assembly_intro_narrate_1",
  AssemblyIntroNarrate2: "assembly_intro_narrate_2",
  AssemblyIntroNarrate3: "assembly_intro_narrate_3",
  AssemblyCylinderNarrate1: "assembly_cylinder_narrate_1",
  AssemblyCylinderNarrate2: "assembly_cylinder_narrate_2",
  AssemblyCylinderNarrate3: "assembly_cylinder_narrate_3",
  AssemblyCylinderMount: "assembly_cylinder_mount",
  AssemblyRecorderNarrate1: "assembly_recorder_narrate_1",
  AssemblyRecorderNarrate2: "assembly_recorder_narrate_2",
  AssemblyRecorderNarrate3: "assembly_recorder_narrate_3",
  AssemblyRecorderMount: "assembly_recorder_mount",
  AssemblyHornNarrate1: "assembly_horn_narrate_1",
  AssemblyHornNarrate2: "assembly_horn_narrate_2",
  AssemblyRecordingHornMount: "assembly_recording_horn_mount",
  AssemblyMotorNarrate1: "assembly_motor_narrate_1",
  AssemblyMotorNarrate2: "assembly_motor_narrate_2",
  AssemblyMotorNarrate3: "assembly_motor_narrate_3",
  AssemblyMotorNarrate4: "assembly_motor_narrate_4",
  AssemblyMotorNarrate5: "assembly_motor_narrate_5",
  AssemblyMotorNarrate6: "assembly_motor_narrate_6",
  AssemblyCrankWind: "assembly_crank_wind",
  RecordingBrakeNarrate1: "recording_brake_narrate_1",
  RecordingBrakeNarrate2: "recording_brake_narrate_2",
  RecordingBrakeRelease: "recording_brake_release",
  RecordingCarriageNarrate1: "recording_carriage_narrate_1",
  RecordingCarriageLower: "recording_carriage_lower",
  RecordingActiveNarrate: "recording_active_narrate",
  RecordingSpeakHintNarrate: "recording_speak_hint_narrate",
  RecordingSpeak: "recording_speak",
  ReassembleNarrate1: "reassemble_narrate_1",
  ReassembleNarrate2: "reassemble_narrate_2",
  ReassembleNarrate3: "reassemble_narrate_3",
  PlaybackSetupRecordingHornUnmount: "playback_setup_recording_horn_unmount",
  PlaybackSetupRecorderUnmount: "playback_setup_recorder_unmount",
  PlaybackSetupCarriageNarrate1: "playback_setup_carriage_narrate_1",
  PlaybackSetupCarriageReturn: "playback_setup_carriage_return",
  PlaybackSetupReproducerNarrate1: "playback_setup_reproducer_narrate_1",
  PlaybackSetupReproducerMount: "playback_setup_reproducer_mount",
  PlaybackSetupListeningNarrate1: "playback_setup_listening_narrate_1",
  PlaybackSetupListeningHornMount: "playback_setup_listening_horn_mount",
  PlaybackReadyNarrate1: "playback_ready_narrate_1",
  PlaybackReadyNarrate2: "playback_ready_narrate_2",
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
  partId: string;
  placard: PlacardSpec;
}

export interface TaskDef {
  id: string;
  partId?: string;
  snapPointId?: string;
  panel?: TaskPanelSpec;
  placard?: PlacardSpec;
  placards?: PlacardBinding[];
  /** Reveal this part when the task becomes active (defaults to partId). */
  revealPart?: boolean;
  revealPartId?: string;
  /** Reveal this part when the task completes, before advancing. */
  revealOnComplete?: string;
  narration?: string;
  afterNarrationMs?: number;
  hintAudio?: string;
  unmount?: boolean;
  interactive?: boolean;
  /** Begin microphone capture when this narration task completes. */
  startRecordingOnComplete?: boolean;
}

const MOUNT_PLACARD_DEFAULTS = {
  maxWidth: PANEL_MAX_WIDTH,
  offsetY: 0.2,
  dismissOnGrab: false,
  dismissOnSnap: true,
  autoDismissMs: 0,
} as const;

const CRANK_PLACARD_OFFSETS = {
  offsetX: 0.1,
  offsetY: 0.2,
  offsetZ: 0,
} as const;

const BRAKE_PLACARD_DEFAULTS = {
  offsetX: 0,
  offsetY: 0.2,
  offsetZ: 0,
  dismissOnGrab: false,
  dismissOnSnap: false,
  autoDismissMs: 0,
} as const;

const RECORDING_BRAKE_DISENGAGE_PLACARD: PlacardSpec = {
  ...BRAKE_PLACARD_DEFAULTS,
  panelConfig: "./ui/recording/brake-disengage.json",
};

const PLAYBACK_BRAKE_RELEASE_PLACARD: PlacardSpec = {
  ...BRAKE_PLACARD_DEFAULTS,
  panelConfig: "./ui/playback/brake-release.json",
};

const RECORDING_CARRIAGE_LOWER_PLACARD: PlacardSpec = {
  ...BRAKE_PLACARD_DEFAULTS,
  panelConfig: "./ui/recording/carriage-lower.json",
};

const PLAYBACK_CARRIAGE_LOWER_PLACARD: PlacardSpec = {
  ...BRAKE_PLACARD_DEFAULTS,
  panelConfig: "./ui/playback/carriage-lower.json",
};

const HEAD_MENU_PANEL = {
  maxWidth: HEAD_PANEL_MAX_WIDTH,
  anchor: "head" as const,
  offsetY: -0.15,
  offsetZ: -0.5,
  faceTarget: true,
};

const PHONOGRAPH_MENU_PANEL = {
  maxWidth: PHONOGRAPH_PANEL_MAX_WIDTH,
  anchor: "phonograph" as const,
  offsetY: PHONOGRAPH_ABOVE_OFFSET_Y,
  billboard: true,
};

const NARRATION_PLACARD_DEFAULTS = {
  maxWidth: PANEL_MAX_WIDTH,
  offsetY: 0.2,
  dismissOnGrab: false,
  dismissOnSnap: false,
  autoDismissMs: 0,
} as const;

const RECORDING_SPEAK_BRAKE_PLACARD: PlacardSpec = {
  ...BRAKE_PLACARD_DEFAULTS,
  panelConfig: "./ui/recording/brake-engage.json",
};

interface PartNarrationOptions {
  revealPart?: boolean;
  revealOnComplete?: string;
  startRecordingOnComplete?: boolean;
  narration?: string;
  afterNarrationMs?: number;
  offsetX?: number;
  offsetY?: number;
  offsetZ?: number;
}

function partNarration(
  id: string,
  partId: string,
  panelConfig: string,
  options: PartNarrationOptions = {},
): TaskDef {
  const defaultOffsetY =
    partId === "phonograph"
      ? PHONOGRAPH_ABOVE_OFFSET_Y
      : NARRATION_PLACARD_DEFAULTS.offsetY;
  const placard: PlacardSpec = {
    ...NARRATION_PLACARD_DEFAULTS,
    panelConfig,
    offsetY: options.offsetY ?? defaultOffsetY,
    ...(options.offsetX != null ? { offsetX: options.offsetX } : {}),
    ...(options.offsetZ != null ? { offsetZ: options.offsetZ } : {}),
  };
  return {
    id,
    partId,
    revealPart: options.revealPart,
    revealOnComplete: options.revealOnComplete,
    startRecordingOnComplete: options.startRecordingOnComplete,
    narration: options.narration,
    afterNarrationMs: options.afterNarrationMs ?? NARRATION_POST_DELAY_MS,
    placard,
  };
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
    id: TaskId.AssemblyIntro,
    afterNarrationMs: 1000,
  },
  partNarration(
    TaskId.AssemblyIntroNarrate1,
    "phonograph",
    "./ui/assembly/intro-narrate-1.json",
    { narration: "/audio/intro-narrate-1.wav" },
  ),
  partNarration(
    TaskId.AssemblyIntroNarrate2,
    "phonograph",
    "./ui/assembly/intro-narrate-2.json",
    { narration: "/audio/intro-narrate-2.wav" },
  ),
  partNarration(
    TaskId.AssemblyIntroNarrate3,
    "phonograph",
    "./ui/assembly/intro-narrate-3.json",
    {
      narration: "/audio/intro-narrate-3.wav",
      afterNarrationMs: NARRATION_POST_DELAY_MS + 700,
    },
  ),
  partNarration(
    TaskId.AssemblyCylinderNarrate1,
    "phonograph",
    "./ui/assembly/cylinder-narrate-1.json",
    { narration: "/audio/cylinder-narrate-1.wav" },
  ),
  partNarration(
    TaskId.AssemblyCylinderNarrate2,
    "cylinder",
    "./ui/assembly/cylinder-narrate-2.json",
    {
      narration: "/audio/cylinder-narrate-2.wav",
      revealPart: true,
    },
  ),
  partNarration(
    TaskId.AssemblyCylinderNarrate3,
    "cylinder",
    "./ui/assembly/cylinder-narrate-3.json",
    { narration: "/audio/cylinder-narrate-3.wav" },
  ),
  {
    id: TaskId.AssemblyCylinderMount,
    partId: "cylinder",
    snapPointId: "cylinder_snap_point",
    interactive: true,
    hintAudio: "/audio/mount-the-cylinder-task.wav",
    placard: {
      ...MOUNT_PLACARD_DEFAULTS,
      panelConfig: "./ui/assembly/cylinder-mount.json",
    },
  },
  partNarration(
    TaskId.AssemblyRecorderNarrate1,
    "phonograph",
    "./ui/assembly/recorder-narrate-1.json",
    {
      narration: "/audio/recorder-narrate-1.wav",
      revealOnComplete: "recorder",
    },
  ),
  partNarration(
    TaskId.AssemblyRecorderNarrate2,
    "recorder",
    "./ui/assembly/recorder-narrate-2.json",
    { narration: "/audio/recorder-narrate-2.wav" },
  ),
  partNarration(
    TaskId.AssemblyRecorderNarrate3,
    "recorder",
    "./ui/assembly/recorder-narrate-3.json",
    { narration: "/audio/recorder-narrate-3.wav" },
  ),
  {
    id: TaskId.AssemblyRecorderMount,
    partId: "recorder",
    snapPointId: "recorder_snap_point",
    interactive: true,
    hintAudio: "/audio/recorder-mount.wav",
    placard: {
      ...MOUNT_PLACARD_DEFAULTS,
      panelConfig: "./ui/assembly/recorder-mount.json",
    },
  },
  partNarration(
    TaskId.AssemblyHornNarrate1,
    "recorder",
    "./ui/assembly/horn-narrate-1.json",
    {
      narration: "/audio/horn-narrate-1.wav",
      revealOnComplete: "recording_horn",
    },
  ),
  partNarration(
    TaskId.AssemblyHornNarrate2,
    "recording_horn",
    "./ui/assembly/horn-narrate-2.json",
    {
      narration: "/audio/horn-narrate-2.wav",
      offsetZ: 0.25,
    },
  ),
  {
    id: TaskId.AssemblyRecordingHornMount,
    partId: "recording_horn",
    snapPointId: "horn_snap_point",
    interactive: true,
    hintAudio: "/audio/recording-horn-mount.wav",
    placard: {
      ...MOUNT_PLACARD_DEFAULTS,
      panelConfig: "./ui/assembly/recording-horn-mount.json",
      offsetZ: 0.25,
    },
  },
  partNarration(
    TaskId.AssemblyMotorNarrate1,
    "phonograph",
    "./ui/assembly/motor-narrate-1.json",
    { narration: "/audio/motor-narrate-1.wav" },
  ),
  partNarration(
    TaskId.AssemblyMotorNarrate2,
    "phonograph",
    "./ui/assembly/motor-narrate-2.json",
    { narration: "/audio/motor-narrate-2.wav" },
  ),
  partNarration(
    TaskId.AssemblyMotorNarrate3,
    "phonograph",
    "./ui/assembly/motor-narrate-3.json",
    { narration: "/audio/motor-narrate-3.wav" },
  ),
  partNarration(
    TaskId.AssemblyMotorNarrate4,
    "phonograph",
    "./ui/assembly/motor-narrate-4.json",
    { narration: "/audio/motor-narrate-4.wav" },
  ),
  partNarration(
    TaskId.AssemblyMotorNarrate5,
    "phonograph",
    "./ui/assembly/motor-narrate-5.json",
    { narration: "/audio/motor-narrate-5.wav" },
  ),
  partNarration(
    TaskId.AssemblyMotorNarrate6,
    "phonograph",
    "./ui/assembly/motor-narrate-6.json",
    {
      narration: "/audio/motor-narrate-6.wav",
      revealOnComplete: "crank",
    },
  ),
  {
    id: TaskId.AssemblyCrankWind,
    partId: "crank",
    interactive: true,
    hintAudio: "/audio/crank-wind.wav",
    placard: {
      panelConfig: "./ui/assembly/crank-wind.json",
      ...CRANK_PLACARD_OFFSETS,
      dismissOnGrab: false,
      dismissOnSnap: true,
      autoDismissMs: 0,
    },
  },
  partNarration(
    TaskId.RecordingBrakeNarrate1,
    "phonograph",
    "./ui/recording/brake-narrate-1.json",
    { narration: "/audio/brake-narrate-1.wav" },
  ),
  partNarration(
    TaskId.RecordingBrakeNarrate2,
    "brake",
    "./ui/recording/brake-narrate-2.json",
    { narration: "/audio/brake-narrate-2.wav" },
  ),
  {
    id: TaskId.RecordingBrakeRelease,
    partId: "brake",
    interactive: true,
    hintAudio: "/audio/brake-disengage.wav",
    placard: RECORDING_BRAKE_DISENGAGE_PLACARD,
  },
  partNarration(
    TaskId.RecordingCarriageNarrate1,
    "phonograph",
    "./ui/recording/carriage-narrate-1.json",
    { narration: "/audio/carriage-narrate-1.wav" },
  ),
  {
    id: TaskId.RecordingCarriageLower,
    partId: "carriage",
    interactive: true,
    hintAudio: "/audio/carriage-lower.wav",
    placard: RECORDING_CARRIAGE_LOWER_PLACARD,
  },
  partNarration(
    TaskId.RecordingActiveNarrate,
    "phonograph",
    "./ui/recording/recording-narrate-1.json",
    { narration: "/audio/recording-narrate-1.wav" },
  ),
  partNarration(
    TaskId.RecordingSpeakHintNarrate,
    "recording_horn",
    "./ui/recording/recording-narrate-2.json",
    {
      narration: "/audio/recording-narrate-2.wav",
      startRecordingOnComplete: true,
      offsetZ: 0.25,
    },
  ),
  {
    id: TaskId.RecordingSpeak,
    interactive: true,
    hintAudio: "/audio/brake-engage.wav",
    placards: [{ partId: "brake", placard: RECORDING_SPEAK_BRAKE_PLACARD }],
  },
  partNarration(
    TaskId.ReassembleNarrate1,
    "phonograph",
    "./ui/playback-setup/reassemble-narrate-1.json",
    { narration: "/audio/reassemble-narrate-1.wav" },
  ),
  partNarration(
    TaskId.ReassembleNarrate2,
    "phonograph",
    "./ui/playback-setup/reassemble-narrate-2.json",
    { narration: "/audio/reassemble-narrate-2.wav" },
  ),
  {
    id: TaskId.PlaybackSetupRecordingHornUnmount,
    partId: "recording_horn",
    unmount: true,
    interactive: true,
    hintAudio: "/audio/recording-horn-unmount.wav",
    placard: {
      ...MOUNT_PLACARD_DEFAULTS,
      dismissOnGrab: true,
      dismissOnSnap: false,
      panelConfig: "./ui/playback-setup/recording-horn-unmount.json",
      offsetZ: 0.25,
    },
  },
  {
    id: TaskId.PlaybackSetupRecorderUnmount,
    partId: "recorder",
    unmount: true,
    interactive: true,
    hintAudio: "/audio/recorder-unmount.wav",
    placard: {
      ...MOUNT_PLACARD_DEFAULTS,
      dismissOnGrab: true,
      dismissOnSnap: false,
      panelConfig: "./ui/playback-setup/recorder-unmount.json",
    },
  },
  partNarration(
    TaskId.PlaybackSetupCarriageNarrate1,
    "carriage",
    "./ui/playback-setup/carriage-narrate-1.json",
    { narration: "/audio/playback-carriage-narrate-1.wav" },
  ),
  {
    id: TaskId.PlaybackSetupCarriageReturn,
    partId: "carriage",
    interactive: true,
    hintAudio: "/audio/playback-carriage-return.wav",
    placard: {
      ...BRAKE_PLACARD_DEFAULTS,
      panelConfig: "./ui/playback-setup/carriage-return.json",
    },
  },
  partNarration(
    TaskId.ReassembleNarrate3,
    "phonograph",
    "./ui/playback-setup/reassemble-narrate-3.json",
    { narration: "/audio/reassemble-narrate-3.wav" },
  ),
  partNarration(
    TaskId.PlaybackSetupReproducerNarrate1,
    "reproducer",
    "./ui/playback-setup/reproducer-narrate-1.json",
    {
      narration: "/audio/reproducer-narrate-1.wav",
      revealPart: true,
    },
  ),
  {
    id: TaskId.PlaybackSetupReproducerMount,
    partId: "reproducer",
    snapPointId: "recorder_snap_point",
    interactive: true,
    hintAudio: "/audio/reproducer-mount.wav",
    placard: {
      ...MOUNT_PLACARD_DEFAULTS,
      panelConfig: "./ui/playback-setup/reproducer-mount.json",
    },
  },
  partNarration(
    TaskId.PlaybackSetupListeningNarrate1,
    "listening_horn",
    "./ui/playback-setup/listening-narrate-1.json",
    {
      narration: "/audio/listening-narrate-1.wav",
      revealPart: true,
      offsetZ: 0.25,
    },
  ),
  {
    id: TaskId.PlaybackSetupListeningHornMount,
    partId: "listening_horn",
    snapPointId: "horn_snap_point",
    interactive: true,
    hintAudio: "/audio/listening-horn-mount.wav",
    placard: {
      ...MOUNT_PLACARD_DEFAULTS,
      panelConfig: "./ui/playback-setup/listening-horn-mount.json",
      offsetZ: 0.25,
    },
  },
  partNarration(
    TaskId.PlaybackReadyNarrate1,
    "phonograph",
    "./ui/playback/ready-narrate-1.json",
    { narration: "/audio/playback-ready-narrate-1.wav" },
  ),
  partNarration(
    TaskId.PlaybackReadyNarrate2,
    "brake",
    "./ui/playback/ready-narrate-2.json",
    { narration: "/audio/playback-ready-narrate-2.wav" },
  ),
  {
    id: TaskId.PlaybackBrakeRelease,
    partId: "brake",
    interactive: true,
    hintAudio: "/audio/playback-brake-release.wav",
    placard: PLAYBACK_BRAKE_RELEASE_PLACARD,
  },
  {
    id: TaskId.PlaybackCarriageLower,
    partId: "carriage",
    interactive: true,
    hintAudio: "/audio/playback-carriage-lower.wav",
    placard: PLAYBACK_CARRIAGE_LOWER_PLACARD,
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
export const PLACARD_BY_TASK: Record<string, { partId: string; placard: PlacardSpec }> =
  {};
export const PLACARDS_BY_TASK: Record<string, PlacardBinding[]> = {};
export const TASK_PANEL_BY_TASK: Record<string, TaskPanelSpec> = {};
export const UNMOUNT_BY_TASK: Record<string, { partId: string }> = {};

function placardBindingsForTask(task: TaskDef): PlacardBinding[] {
  if (task.placards?.length) return task.placards;
  if (task.placard && task.partId) {
    return [{ partId: task.partId, placard: task.placard }];
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
}
