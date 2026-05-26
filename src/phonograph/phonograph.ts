import { createSystem, eq, createComponent } from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../task.js";
import { PopIn } from "../animations/animation.js";

export const Phonograph = createComponent("Phonograph", {});

export class PhonographSystem extends createSystem({
  activeSetupTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "cylinder_mount")],
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

    this.cleanupFuncs.push(
      this.queries.activeSetupTask.subscribe("qualify", () => {
        spawnPhonograph();
      }),
    );
  }
}
