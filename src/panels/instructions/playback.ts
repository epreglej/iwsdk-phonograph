import {
  createSystem,
  PanelUI,
  eq,
  Follower,
  FollowBehavior,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../../task.js";
import { PopIn2D, PopOut2D } from "../../animations/animation.js";
import { Billboard } from "../../utils/billboard.js";
import { delay } from "../../utils/delay.js";
import { Phonograph } from "../../phonograph/phonograph.js";

export class PlaybackInstructionPanelSystem extends createSystem({
  activeTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "playback")],
  },
  phonograph: {
    required: [Phonograph],
  },
}) {
  init() {
    const [phonographEntity] = this.queries.phonograph.entities;

    const panelEntity = this.world
      .createTransformEntity(undefined, { parent: this.world.sceneEntity })
      .addComponent(PanelUI, {
        config: "./ui/playback-instruction.json",
        maxWidth: 0.35,
      });
    panelEntity.object3D!.scale.set(0.001, 0.001, 0.001);
    panelEntity.object3D!.visible = false;

    this.cleanupFuncs.push(
      this.queries.activeTask.subscribe("qualify", async () => {
        panelEntity
          .addComponent(Follower, {
            behavior: FollowBehavior.NoRotation,
            target: phonographEntity.object3D!,
            offsetPosition: [0, 0.4, 0],
          })
          .addComponent(Billboard)
          .addComponent(PopIn2D);
        panelEntity.object3D!.visible = true;
      }),

      this.queries.activeTask.subscribe("disqualify", async () => {
        panelEntity.addComponent(PopOut2D);

        await delay(1200);
        panelEntity.object3D!.visible = false;
        panelEntity.removeComponent(Billboard);

        panelEntity.dispose();
      }),
    );
  }
}
