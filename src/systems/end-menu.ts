import {
  createSystem,
  Entity,
  eq,
  FollowBehavior,
  Follower,
  PanelDocument,
  PanelUI,
  PokeInteractable,
  UIKitDocument,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { hidePanelWithPopOut, revealPanel } from "../ui/panel-lifecycle.js";
import { createSpatialPanel } from "../ui/spatial-panel.js";

const END_MENU_CONFIG = "./ui/end-menu.json";

export class EndMenuSystem extends createSystem({
  activeDoneTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "done")],
  },
  panel: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, "config", END_MENU_CONFIG)],
  },
}) {
  private panelEntity!: Entity;
  private doc: UIKitDocument | null = null;
  private wired = false;
  private currentTask: Entity | null = null;

  init() {
    this.panelEntity = createSpatialPanel(this.world, {
      config: END_MENU_CONFIG,
      maxWidth: 0.455,
    });

    this.cleanupFuncs.push(
      this.queries.panel.subscribe(
        "qualify",
        (entity) => {
          if (entity.index !== this.panelEntity.index) return;
          this.doc = entity.getValue(PanelDocument, "document") as UIKitDocument;
          this.wireButtons();
        },
        true,
      ),

      this.queries.panel.subscribe("disqualify", (entity) => {
        if (entity.index !== this.panelEntity.index) return;
        this.doc = null;
        this.wired = false;
      }),

      this.queries.activeDoneTask.subscribe("qualify", (taskEntity) => {
        this.currentTask = taskEntity;
        this.panelEntity
          .addComponent(Follower, {
            behavior: FollowBehavior.FaceTarget,
            target: this.player.head,
            offsetPosition: [0, -0.15, -0.5],
          })
          .addComponent(PokeInteractable);
        revealPanel(this.panelEntity);
      }),

      this.queries.activeDoneTask.subscribe("disqualify", () => {
        this.currentTask = null;
        hidePanelWithPopOut(this.panelEntity, () => {
          if (!this.panelEntity.active) return;
          this.panelEntity.removeComponent(Follower).removeComponent(PokeInteractable);
        });
      }),
    );
  }

  private wireButtons(): void {
    if (this.wired || !this.doc) return;

    const restartButton = this.doc.getElementById("end-menu-restart-button");
    restartButton?.addEventListener("click", () => {
      if (this.currentTask?.active && !this.currentTask.hasComponent(CompletedTask)) {
        this.currentTask.addComponent(CompletedTask);
      }
    });

    this.wired = true;
  }
}
