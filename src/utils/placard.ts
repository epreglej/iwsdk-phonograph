import {
  createComponent,
  createSystem,
  Entity,
  eq,
  FollowBehavior,
  Follower,
  Grabbed,
  PanelUI,
  Types,
} from "@iwsdk/core";
import { PopIn2D, PopOut2D } from "../animations/animation.js";
import { Billboard } from "./billboard.js";
import { Snapped } from "./snap.js";
import { Task, ActiveTask, CompletedTask } from "../task.js";
import { Cylinder } from "../phonograph/cylinder.js";
import { Crank, CrankingComplete } from "../phonograph/crank.js";
import {
  PlaybackTrumpet,
  RecordingTrumpet,
} from "../phonograph/trumpet.js";
import {
  PlaybackDiaphragm,
  RecordingDiaphragm,
} from "../phonograph/diaphragm.js";

/** Marks an object that has a label placard following it in space. */
export const Placard = createComponent("Placard", {
  panelConfig: { type: Types.String, default: "" },
  offsetX: { type: Types.Float32, default: 0 },
  offsetY: { type: Types.Float32, default: 0 },
  offsetZ: { type: Types.Float32, default: 0 },
  dismissOnGrab: { type: Types.Boolean, default: false },
  dismissOnSnap: { type: Types.Boolean, default: true },
  autoDismissMs: { type: Types.Float32, default: 0 },
});

export const PlacardDismissed = createComponent("PlacardDismissed", {});

export class PlacardSystem extends createSystem({
  targets: { required: [Placard], excluded: [PlacardDismissed] },
  targetGrabbed: { required: [Placard, Grabbed] },
  targetSnapped: { required: [Placard, Snapped] },
}) {
  private placards = new Map<number, Entity>();
  private dismissTimers = new Map<number, ReturnType<typeof setTimeout>>();

  init() {
    this.cleanupFuncs.push(
      this.queries.targets.subscribe("qualify", (target) => {
        this.spawnPlacard(target);
      }),

      this.queries.targets.subscribe("disqualify", (target) => {
        this.clearDismissTimer(target.index);
        this.destroyPlacard(target.index);
      }),

      this.queries.targetGrabbed.subscribe("qualify", (target) => {
        if (target.hasComponent(PlacardDismissed)) return;

        if (target.getValue(Placard, "dismissOnGrab")) {
          this.dismissPlacard(target);
          return;
        }

        this.hidePlacard(target.index);
      }),

      this.queries.targetGrabbed.subscribe("disqualify", (target) => {
        if (target.hasComponent(PlacardDismissed)) return;
        this.showPlacard(target.index);
      }),

      this.queries.targetSnapped.subscribe("qualify", (target) => {
        if (!target.getValue(Placard, "dismissOnSnap")) return;
        this.dismissPlacard(target);
      }),
    );
  }

  private spawnPlacard(target: Entity): void {
    const targetObj = target.object3D;
    if (!targetObj || this.placards.has(target.index)) return;

    const config = target.getValue(Placard, "panelConfig")!;

    const placard = this.world
      .createTransformEntity(undefined, { parent: this.world.sceneEntity })
      .addComponent(PanelUI, { config, maxWidth: 0.17 })
      .addComponent(Follower, {
        behavior: FollowBehavior.NoRotation,
        target: targetObj,
        offsetPosition: [
          target.getValue(Placard, "offsetX") ?? 0.1,
          target.getValue(Placard, "offsetY") ?? 0.12,
          target.getValue(Placard, "offsetZ") ?? 0,
        ],
      })
      .addComponent(Billboard)
      .addComponent(PopIn2D);

    placard.object3D!.scale.set(0.001, 0.001, 0.001);
    placard.object3D!.visible = true;
    this.placards.set(target.index, placard);

    const autoDismissMs = target.getValue(Placard, "autoDismissMs") ?? 0;
    if (autoDismissMs > 0) {
      const timer = setTimeout(() => {
        this.dismissTimers.delete(target.index);
        if (target.active && !target.hasComponent(PlacardDismissed)) {
          this.dismissPlacard(target);
        }
      }, autoDismissMs);
      this.dismissTimers.set(target.index, timer);
    }
  }

  private hidePlacard(targetIndex: number): void {
    const placard = this.placards.get(targetIndex);
    if (!placard) return;
    placard.removeComponent(PopIn2D);
    placard.addComponent(PopOut2D);
  }

  private showPlacard(targetIndex: number): void {
    const placard = this.placards.get(targetIndex);
    if (!placard?.object3D) return;
    placard.removeComponent(PopOut2D);
    placard.object3D.visible = true;
    placard.addComponent(PopIn2D);
  }

  private dismissPlacard(target: Entity): void {
    if (target.hasComponent(PlacardDismissed)) return;

    this.clearDismissTimer(target.index);
    target.addComponent(PlacardDismissed);

    const placard = this.placards.get(target.index);
    if (placard) {
      placard.removeComponent(PopIn2D);
      placard.addComponent(PopOut2D);
      const toDispose = placard;
      setTimeout(() => toDispose.dispose(), 600);
      this.placards.delete(target.index);
    }
  }

  private destroyPlacard(targetIndex: number): void {
    this.clearDismissTimer(targetIndex);
    const placard = this.placards.get(targetIndex);
    if (placard) {
      placard.dispose();
      this.placards.delete(targetIndex);
    }
  }

  private clearDismissTimer(targetIndex: number): void {
    const timer = this.dismissTimers.get(targetIndex);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.dismissTimers.delete(targetIndex);
    }
  }
}

type PlacardBinding = {
  panelConfig: string;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  dismissOnGrab: boolean;
  dismissOnSnap: boolean;
  autoDismissMs: number;
};

/**
 * Attaches {@link Placard} from active task + object markers so phonograph
 * systems stay focused on interaction state.
 */
export class PlacardTaskSystem extends createSystem({
  cylinderMountTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "cylinder_mount")],
  },
  cylinder: { required: [Cylinder] },

  crankCrankingTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "crank_cranking")],
  },
  crank: { required: [Crank] },
  crankComplete: { required: [Crank, CrankingComplete] },

  recordingTrumpetMountTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "recording_trumpet_mount")],
  },
  playbackTrumpetMountTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "playback_trumpet_mount")],
  },
  recordingTrumpet: { required: [RecordingTrumpet] },
  playbackTrumpet: { required: [PlaybackTrumpet] },

  recordingDiaphragmMountTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "recording_diaphragm_mount")],
  },
  playbackDiaphragmMountTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "playback_diaphragm_mount")],
  },
  recordingDiaphragm: { required: [RecordingDiaphragm] },
  playbackDiaphragm: { required: [PlaybackDiaphragm] },
}) {
  init() {
    const [cylinder] = this.queries.cylinder.entities;
    const [crank] = this.queries.crank.entities;
    const [recordingTrumpet] = this.queries.recordingTrumpet.entities;
    const [playbackTrumpet] = this.queries.playbackTrumpet.entities;
    const [recordingDiaphragm] = this.queries.recordingDiaphragm.entities;
    const [playbackDiaphragm] = this.queries.playbackDiaphragm.entities;

    const mountCard: PlacardBinding = {
      panelConfig: "",
      offsetX: 0,
      offsetY: 0.2,
      offsetZ: 0,
      dismissOnGrab: false,
      dismissOnSnap: true,
      autoDismissMs: 0,
    };

    this.cleanupFuncs.push(
      this.queries.cylinderMountTask.subscribe("qualify", () => {
        this.attachPlacard(cylinder, {
          ...mountCard,
          panelConfig: "./ui/cylinder-mount-instruction.json",
          offsetY: 0.2,
        });
      }),
      this.queries.cylinderMountTask.subscribe("disqualify", () => {
        this.stripPlacard(cylinder);
      }),

      this.queries.crankCrankingTask.subscribe("qualify", () => {
        this.attachPlacard(crank, {
          panelConfig: "./ui/crank-cranking-instruction.json",
          offsetX: 0.1,
          offsetY: 0.2,
          offsetZ: 0,
          dismissOnGrab: false,
          dismissOnSnap: true,
          autoDismissMs: 0,
        });
      }),
      this.queries.crankCrankingTask.subscribe("disqualify", () => {
        this.stripPlacard(crank);
      }),
      this.queries.crankComplete.subscribe("qualify", () => {
        this.stripPlacard(crank);
      }),

      this.queries.recordingTrumpetMountTask.subscribe("qualify", () => {
        this.attachPlacard(recordingTrumpet, {
          ...mountCard,
          panelConfig: "./ui/recording-trumpet-mount-instruction.json",
        });
      }),
      this.queries.recordingTrumpetMountTask.subscribe("disqualify", () => {
        this.stripPlacard(recordingTrumpet);
      }),

      this.queries.playbackTrumpetMountTask.subscribe("qualify", () => {
        this.attachPlacard(playbackTrumpet, {
          ...mountCard,
          panelConfig: "./ui/playback-trumpet-mount-instruction.json",
        });
      }),
      this.queries.playbackTrumpetMountTask.subscribe("disqualify", () => {
        this.stripPlacard(playbackTrumpet);
      }),

      this.queries.recordingDiaphragmMountTask.subscribe("qualify", () => {
        this.attachPlacard(recordingDiaphragm, {
          ...mountCard,
          panelConfig: "./ui/recording-diaphragm-mount-instruction.json",
        });
      }),
      this.queries.recordingDiaphragmMountTask.subscribe("disqualify", () => {
        this.stripPlacard(recordingDiaphragm);
      }),

      this.queries.playbackDiaphragmMountTask.subscribe("qualify", () => {
        this.attachPlacard(playbackDiaphragm, {
          ...mountCard,
          panelConfig: "./ui/playback-diaphragm-mount-instruction.json",
        });
      }),
      this.queries.playbackDiaphragmMountTask.subscribe("disqualify", () => {
        this.stripPlacard(playbackDiaphragm);
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
