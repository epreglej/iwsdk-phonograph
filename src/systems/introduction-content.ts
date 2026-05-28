import { createSystem, PanelUI, eq } from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { delay } from "../helpers/delay.js";
import { Billboard } from "../components/billboard.js";
import { PopIn2D, PopOut2D } from "../components/animation.js";
import { placeInFrontOfHead } from "../ui/panel-lifecycle.js";

export class IntroductionContentPanelSystem extends createSystem({
  activeTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "introduction_content")],
  },
}) {
  init() {
    const panelEntity = this.world
      .createTransformEntity(undefined, { parent: this.world.sceneEntity })
      .addComponent(PanelUI, {
        config: "./ui/introduction-content.json",
        maxWidth: 0.35,
      });
    panelEntity.object3D!.scale.set(0.001, 0.001, 0.001);
    panelEntity.object3D!.visible = false;

    this.cleanupFuncs.push(
      this.queries.activeTask.subscribe("qualify", async (taskEntity) => {
        placeInFrontOfHead(panelEntity, this.world);
        panelEntity.addComponent(Billboard).addComponent(PopIn2D);
        panelEntity.object3D!.visible = true;

        await delay(4500);
        panelEntity.addComponent(PopOut2D);

        await delay(1200);
        panelEntity.object3D!.visible = false;
        panelEntity.removeComponent(Billboard).removeComponent(PopOut2D);

        if (taskEntity.active && !taskEntity.hasComponent(CompletedTask)) {
          taskEntity.addComponent(CompletedTask);
        }
      }),

      this.queries.activeTask.subscribe("disqualify", () => {
        panelEntity.dispose();
      }),
    );
  }
}
