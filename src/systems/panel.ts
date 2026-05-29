import {
  createSystem,
  Entity,
  FollowBehavior,
  Follower,
  Object3D,
  PanelDocument,
  PanelUI,
  PokeInteractable,
  UIKitDocument,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../components/task.js";
import { Phonograph } from "../components/phonograph.js";
import { Billboard } from "../components/billboard.js";
import { PopOut2DDone } from "../components/animation.js";
import {
  INFO_TASK_IDS,
  PANEL_COPY_BY_TASK,
  type PanelCopy,
} from "../config/task-flow.js";
import { hidePanel, revealPanel } from "../ui/panel-lifecycle.js";
import { setPanelElementText } from "../ui/panel-text.js";
import { createSpatialPanel } from "../ui/spatial-panel.js";
import { firstEntity } from "../helpers/entity-query.js";

type FollowBehaviorValue = (typeof FollowBehavior)[keyof typeof FollowBehavior];

interface FollowSpec {
  target: "head" | "phonograph";
  behavior: FollowBehaviorValue;
  offset: [number, number, number];
  billboard?: boolean;
}

interface PanelDef {
  config: string;
  maxWidth: number;
  follow: FollowSpec;
  showOnTaskIds: string[];
  hideOnTaskIds?: string[];
  buttonId: string;
  titleElementId?: string;
  bodyElementId?: string;
}

const PANELS: PanelDef[] = [
  {
    config: "./ui/main-menu.json",
    maxWidth: 0.455,
    follow: {
      target: "head",
      behavior: FollowBehavior.FaceTarget,
      offset: [0, -0.15, -0.5],
    },
    showOnTaskIds: ["main_menu"],
    buttonId: "start-learning-button",
  },
  {
    config: "./ui/end-menu.json",
    maxWidth: 0.455,
    follow: {
      target: "head",
      behavior: FollowBehavior.FaceTarget,
      offset: [0, -0.15, -0.5],
    },
    showOnTaskIds: ["done"],
    buttonId: "end-menu-restart-button",
  },
  {
    config: "./ui/interactive-recording-ready.json",
    maxWidth: 0.35,
    follow: {
      target: "phonograph",
      behavior: FollowBehavior.NoRotation,
      offset: [0, 0.55, 0],
      billboard: true,
    },
    showOnTaskIds: INFO_TASK_IDS,
    hideOnTaskIds: ["recording"],
    buttonId: "continue-button",
    titleElementId: "interactive-panel-title",
    bodyElementId: "interactive-panel-body",
  },
  {
    config: "./ui/recording-indicator.json",
    maxWidth: 0.38,
    follow: {
      target: "phonograph",
      behavior: FollowBehavior.NoRotation,
      offset: [0, 0.5, 0],
      billboard: true,
    },
    showOnTaskIds: ["recording"],
    buttonId: "recording-indicator-unused",
  },
];

interface PanelController {
  def: PanelDef;
  entity: Entity;
  doc: UIKitDocument | null;
  wired: boolean;
  currentTask: Entity | null;
  pendingContinueTask: Entity | null;
  pendingCopy: PanelCopy | null;
}

export class PanelSystem extends createSystem({
  activeTask: { required: [Task, ActiveTask], excluded: [CompletedTask] },
  phonograph: { required: [Phonograph] },
  panelDocs: { required: [PanelUI, PanelDocument] },
  poppedOut: { required: [PanelUI, PopOut2DDone] },
}) {
  private controllers: PanelController[] = [];

  init() {
    this.controllers = PANELS.map((def) => ({
      def,
      entity: createSpatialPanel(this.world, {
        config: def.config,
        maxWidth: def.maxWidth,
      }),
      doc: null,
      wired: false,
      currentTask: null,
      pendingContinueTask: null,
      pendingCopy: null,
    }));

    this.cleanupFuncs.push(
      this.queries.panelDocs.subscribe(
        "qualify",
        (entity) => {
          const controller = this.controllerForPanel(entity);
          if (!controller) return;
          controller.doc = entity.getValue(
            PanelDocument,
            "document",
          ) as UIKitDocument;
          this.applyCopy(controller);
          this.wireButton(controller);
          if (controller.currentTask) this.reveal(controller);
        },
        true,
      ),

      this.queries.panelDocs.subscribe("disqualify", (entity) => {
        const controller = this.controllerForPanel(entity);
        if (!controller) return;
        controller.doc = null;
        controller.wired = false;
      }),

      this.queries.activeTask.subscribe("qualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        for (const controller of this.controllers) {
          if (controller.def.hideOnTaskIds?.includes(taskId)) {
            this.clearTask(controller);
            this.hide(controller);
          }
          if (controller.def.showOnTaskIds.includes(taskId)) {
            this.show(controller, taskEntity, taskId);
          }
        }
      }),

      this.queries.activeTask.subscribe("disqualify", (taskEntity) => {
        for (const controller of this.controllers) {
          if (controller.currentTask === taskEntity) {
            this.clearTask(controller);
            this.hide(controller);
          }
        }
      }),

      this.queries.poppedOut.subscribe("qualify", (entity) => {
        const controller = this.controllerForPanel(entity);
        if (!controller) return;

        const pending = controller.pendingContinueTask;
        if (
          pending?.active &&
          !pending.hasComponent(CompletedTask)
        ) {
          pending.addComponent(CompletedTask);
          controller.pendingContinueTask = null;
        }

        this.teardownPanel(controller);
      }),
    );
  }

  private show(
    controller: PanelController,
    taskEntity: Entity,
    taskId: string,
  ): void {
    const targetObj = this.followTarget(controller.def.follow.target);
    if (!targetObj) return;

    controller.currentTask = taskEntity;
    controller.pendingCopy = controller.def.titleElementId
      ? PANEL_COPY_BY_TASK[taskId] ?? null
      : null;

    controller.entity.addComponent(Follower, {
      behavior: controller.def.follow.behavior,
      target: targetObj,
      offsetPosition: controller.def.follow.offset,
    });
    if (controller.def.follow.billboard) {
      controller.entity.addComponent(Billboard);
    }
    controller.entity.addComponent(PokeInteractable);

    this.applyCopy(controller);
    this.reveal(controller);
  }

  private reveal(controller: PanelController): void {
    if (!controller.doc) return;
    revealPanel(controller.entity);
  }

  private hide(controller: PanelController): void {
    const entity = controller.entity;
    if (!entity.active) return;

    if (entity.object3D?.visible) {
      hidePanel(entity);
    } else {
      this.teardownPanel(controller);
    }
  }

  private teardownPanel(controller: PanelController): void {
    const entity = controller.entity;
    if (!entity.active) return;
    if (entity.object3D) entity.object3D.visible = false;
    entity.removeComponent(PokeInteractable).removeComponent(Follower);
    if (controller.def.follow.billboard) {
      entity.removeComponent(Billboard);
    }
  }

  private applyCopy(controller: PanelController): void {
    const { def, doc, pendingCopy } = controller;
    if (!doc || !pendingCopy || !def.titleElementId || !def.bodyElementId) {
      return;
    }
    setPanelElementText(doc, def.titleElementId, pendingCopy.title);
    setPanelElementText(doc, def.bodyElementId, pendingCopy.body);
  }

  private wireButton(controller: PanelController): void {
    if (controller.wired || !controller.doc) return;

    const button = controller.doc.getElementById(controller.def.buttonId);
    button?.addEventListener("click", () => {
      const task = controller.currentTask;
      if (!task?.active || task.hasComponent(CompletedTask)) return;

      const taskId = task.getValue(Task, "id")!;
      if (INFO_TASK_IDS.includes(taskId)) {
        controller.pendingContinueTask = task;
        controller.entity.removeComponent(PokeInteractable);
        this.hide(controller);
        return;
      }

      task.addComponent(CompletedTask);
    });

    controller.wired = true;
  }

  private clearTask(controller: PanelController): void {
    controller.currentTask = null;
    controller.pendingContinueTask = null;
    controller.pendingCopy = null;
  }

  private followTarget(target: FollowSpec["target"]): Object3D | null {
    if (target === "head") return this.player.head;
    const phonograph = firstEntity(this.queries.phonograph.entities);
    return phonograph?.object3D ?? null;
  }

  private controllerForPanel(entity: Entity): PanelController | undefined {
    return this.controllers.find((c) => c.entity.index === entity.index);
  }
}
