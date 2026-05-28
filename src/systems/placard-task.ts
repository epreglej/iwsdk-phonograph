import { createSystem, Entity, isin } from "@iwsdk/core";
import { firstEntity } from "../helpers/entity-query.js";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { Cylinder, Crank, CrankingComplete } from "../components/phonograph.js";
import {
  PlaybackTrumpet,
  RecordingTrumpet,
  PlaybackDiaphragm,
  RecordingDiaphragm,
} from "../components/phonograph-parts.js";
import { Placard, PlacardDismissed } from "../components/placard.js";

type PlacardBinding = {
  panelConfig: string;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  dismissOnGrab: boolean;
  dismissOnSnap: boolean;
  autoDismissMs: number;
};

const MOUNT_PLACARD: PlacardBinding = {
  panelConfig: "",
  offsetX: 0,
  offsetY: 0.2,
  offsetZ: 0,
  dismissOnGrab: false,
  dismissOnSnap: true,
  autoDismissMs: 0,
};

const PLACARD_TASK_BINDINGS: Record<string, PlacardBinding> = {
  cylinder_mount: {
    ...MOUNT_PLACARD,
    panelConfig: "./ui/cylinder-mount-instruction.json",
  },
  crank_cranking: {
    panelConfig: "./ui/crank-cranking-instruction.json",
    offsetX: 0.1,
    offsetY: 0.2,
    offsetZ: 0,
    dismissOnGrab: false,
    dismissOnSnap: true,
    autoDismissMs: 0,
  },
  recording_trumpet_mount: {
    ...MOUNT_PLACARD,
    panelConfig: "./ui/recording-trumpet-mount-instruction.json",
    offsetZ: 0.25,
  },
  playback_trumpet_mount: {
    ...MOUNT_PLACARD,
    panelConfig: "./ui/playback-trumpet-mount-instruction.json",
    offsetZ: 0.25,
  },
  recording_diaphragm_mount: {
    ...MOUNT_PLACARD,
    panelConfig: "./ui/recording-diaphragm-mount-instruction.json",
  },
  playback_diaphragm_mount: {
    ...MOUNT_PLACARD,
    panelConfig: "./ui/playback-diaphragm-mount-instruction.json",
  },
};

const PLACARD_TASK_IDS = Object.keys(PLACARD_TASK_BINDINGS);

export class PlacardTaskSystem extends createSystem({
  activePlacardTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [isin(Task, "id", PLACARD_TASK_IDS)],
  },
  cylinder: { required: [Cylinder] },
  crank: { required: [Crank] },
  crankComplete: { required: [Crank, CrankingComplete] },
  recordingTrumpet: { required: [RecordingTrumpet] },
  playbackTrumpet: { required: [PlaybackTrumpet] },
  recordingDiaphragm: { required: [RecordingDiaphragm] },
  playbackDiaphragm: { required: [PlaybackDiaphragm] },
}) {
  private targetForTask(taskId: string): Entity | undefined {
    switch (taskId) {
      case "cylinder_mount":
        return firstEntity(this.queries.cylinder.entities);
      case "crank_cranking":
        return firstEntity(this.queries.crank.entities);
      case "recording_trumpet_mount":
        return firstEntity(this.queries.recordingTrumpet.entities);
      case "playback_trumpet_mount":
        return firstEntity(this.queries.playbackTrumpet.entities);
      case "recording_diaphragm_mount":
        return firstEntity(this.queries.recordingDiaphragm.entities);
      case "playback_diaphragm_mount":
        return firstEntity(this.queries.playbackDiaphragm.entities);
      default:
        return undefined;
    }
  }

  init() {
    this.cleanupFuncs.push(
      this.queries.activePlacardTask.subscribe("qualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        const target = this.targetForTask(taskId);
        const binding = PLACARD_TASK_BINDINGS[taskId];
        if (target && binding) this.attachPlacard(target, binding);
      }),

      this.queries.activePlacardTask.subscribe("disqualify", (taskEntity) => {
        const target = this.targetForTask(taskEntity.getValue(Task, "id")!);
        if (target) this.stripPlacard(target);
      }),

      this.queries.crankComplete.subscribe("qualify", () => {
        const crank = firstEntity(this.queries.crank.entities);
        if (crank) this.stripPlacard(crank);
      }),
    );
  }

  private attachPlacard(entity: Entity, binding: PlacardBinding): void {
    entity.removeComponent(PlacardDismissed).removeComponent(Placard);
    entity.addComponent(Placard, binding);
  }

  private stripPlacard(entity: Entity): void {
    entity.removeComponent(Placard).removeComponent(PlacardDismissed);
  }
}
