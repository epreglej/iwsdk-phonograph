import {
  createSystem,
  eq,
  PanelUI,
  PanelDocument,
  UIKitDocument,
  UIKit,
  PokeInteractable,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../../task.js";
import { Billboard } from "../../utils/billboard.js";
import { PopIn2D } from "../../animations/animation.js";

export class IntroductionInteractionSystem extends createSystem({
  activeTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "introduction_interaction")],
  },
  panel: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, "config", "./ui/introduction-interaction.json")],
  },
}) {
  init() {
    const panelEntity = this.world
      .createTransformEntity(undefined, { parent: this.world.sceneEntity })
      .addComponent(PanelUI, {
        config: "./ui/introduction-interaction.json",
        maxWidth: 0.35,
      });
    panelEntity.object3D!.scale.set(0.001, 0.001, 0.001);
    panelEntity.object3D!.visible = false;

    this.cleanupFuncs.push(
      this.queries.activeTask.subscribe("qualify", () => {
        panelEntity.object3D!.position.set(
          0,
          this.world.player.head.position.y - 0.2,
          -0.65,
        );
        panelEntity
          .addComponent(Billboard)
          .addComponent(PokeInteractable)
          .addComponent(PopIn2D);
        panelEntity.object3D!.visible = true;
      }),

      this.queries.activeTask.subscribe("disqualify", () => {
        panelEntity.dispose();
      }),

      this.queries.panel.subscribe("qualify", (entity) => {
        const doc = entity.getValue(PanelDocument, "document") as UIKitDocument;
        const button = doc?.getElementById(
          "continue-button",
        ) as UIKit.Component;
        button?.addEventListener("click", () => {
          const [taskEntity] = this.queries.activeTask.entities;
          if (taskEntity) taskEntity.addComponent(CompletedTask);
        });
      }),

      this.queries.panel.subscribe("disqualify", () => {
        panelEntity.dispose();
      }),
    );
  }
}
