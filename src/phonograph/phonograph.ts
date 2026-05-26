import { createSystem, eq, createComponent } from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../task.js";
import { PopIn } from "../animations/animation.js";
import {
  addPlacardTarget,
  PlacardDismissed,
  PlacardTarget,
} from "../utils/object-placard.js";

export const Phonograph = createComponent("Phonograph", {});

export class PhonographSystem extends createSystem({
  activeSetupTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "cylinder_mount")],
  },
  activeRecordingTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "recording")],
  },
  activePlaybackTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "playback")],
  },
  phonograph: { required: [Phonograph] },
}) {
  init() {
    const [phonographEntity] = this.queries.phonograph.entities;

    const spawnPhonograph = () => {
      phonographEntity.object3D!.position.set(
        0,
        this.world.player.head.position.y - 0.35,
        -0.75,
      );
      phonographEntity.object3D!.visible = true;
      phonographEntity.addComponent(PopIn);
    };

    const clearPhonographPlacard = () => {
      phonographEntity
        .removeComponent(PlacardTarget)
        .removeComponent(PlacardDismissed);
    };

    this.cleanupFuncs.push(
      this.queries.activeSetupTask.subscribe("qualify", () => {
        spawnPhonograph();
      }),

      this.queries.activeRecordingTask.subscribe("qualify", () => {
        addPlacardTarget(phonographEntity, {
          panelConfig: "./ui/recording-instruction.json",
          offsetX: 0.32,
          offsetY: 0.12,
          offsetZ: 0,
          dismissOnSnap: false,
          autoDismissMs: 8000,
        });
      }),

      this.queries.activeRecordingTask.subscribe("disqualify", () => {
        clearPhonographPlacard();
      }),

      this.queries.activePlaybackTask.subscribe("qualify", () => {
        addPlacardTarget(phonographEntity, {
          panelConfig: "./ui/playback-instruction.json",
          offsetX: 0.32,
          offsetY: 0.12,
          offsetZ: 0,
          dismissOnSnap: false,
          autoDismissMs: 8000,
        });
      }),

      this.queries.activePlaybackTask.subscribe("disqualify", () => {
        clearPhonographPlacard();
      }),
    );
  }
}
