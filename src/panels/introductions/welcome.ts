import { createSystem, PanelUI, eq } from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../../task.js";
import { PopIn2D, PopOut2D } from "../../animations/animation.js";
import { Billboard } from "../../utils/billboard.js";
import { delay } from "../../utils/delay.js";

export class IntroductionWelcomePanelSystem extends createSystem({
  activeTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "introduction_welcome")],
  },
}) {
  init() {
    const panelEntity = this.world
      .createTransformEntity(undefined, { parent: this.world.sceneEntity })
      .addComponent(PanelUI, {
        config: "./ui/introduction-welcome.json",
        maxWidth: 0.35,
      });
    panelEntity.object3D!.scale.set(0.001, 0.001, 0.001);
    panelEntity.object3D!.visible = false;

    this.cleanupFuncs.push(
      this.queries.activeTask.subscribe("qualify", async () => {
        panelEntity.object3D!.position.set(
          0,
          this.world.player.head.position.y - 0.2,
          -0.65,
        );

        panelEntity.addComponent(Billboard).addComponent(PopIn2D);
        panelEntity.object3D!.visible = true;

        await delay(3000);
        panelEntity.addComponent(PopOut2D);

        await delay(1200);
        panelEntity.object3D!.visible = false;
        panelEntity.removeComponent(Billboard);

        const [taskEntity] = this.queries.activeTask.entities;
        if (taskEntity) taskEntity.addComponent(CompletedTask);
      }),

      this.queries.activeTask.subscribe("disqualify", () => {
        panelEntity.dispose();
      }),
    );
  }
}
