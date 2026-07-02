import {
  createComponent,
  createSystem,
  Entity,
  FollowBehavior,
  Follower,
  Grabbed,
  Object3D,
  PanelDocument,
  PanelUI,
  Types,
} from "@iwsdk/core";
import { PopIn2D, PopOut2D } from "./animation.js";
import { Billboard } from "./billboard.js";
import {
  beginPanelPopOut,
  hidePanelEntity,
  stripPanelSurface,
} from "./panel-lifecycle.js";
import { Phonograph, PhonographPart } from "./phonograph.js";
import { ActiveTask, CompletedTask, Task } from "./task.js";
import {
  INSTRUCTION_BY_TASK,
  INSTRUCTION_PANEL_FOLLOW_SPEED,
  INSTRUCTION_PANEL_FOLLOW_TOLERANCE,
  type InstructionSpec,
} from "./instruction-config.js";

export const InstructionPanel = createComponent("InstructionPanel", {});

export const InstructionPanelAnchor = createComponent("InstructionPanelAnchor", {
  part: { type: Types.Entity, default: null },
});

export class InstructionSystem extends createSystem({
  activeTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
  },
  phonograph: { required: [Phonograph] },
  parts: { required: [PhonographPart] },
  instructionPanels: { required: [InstructionPanel, PanelDocument] },
  instructionPartAnchors: {
    required: [InstructionPanel, InstructionPanelAnchor],
  },
  instructionGrabbedParts: { required: [PhonographPart, Grabbed] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.activeTask.subscribe("qualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        if (!INSTRUCTION_BY_TASK[taskId]) return;
        this.defer(() => this.showInstructionForTask(taskId));
      }),

      this.queries.activeTask.subscribe("disqualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        if (!INSTRUCTION_BY_TASK[taskId]) return;
        this.defer(() => this.hideInstruction());
      }),

      this.queries.instructionPanels.subscribe("qualify", (panel) => {
        stripPanelSurface(panel);
        if (!panel.hasComponent(PopIn2D)) {
          panel.addComponent(PopIn2D);
        }
      }),

      this.queries.instructionGrabbedParts.subscribe("qualify", (part) => {
        this.popOutInstructionForPart(part);
      }),

      this.queries.instructionGrabbedParts.subscribe("disqualify", (part) => {
        this.popInInstructionForPart(part);
      }),
    );
  }

  private showInstructionForTask(taskId: string): void {
    const spec = INSTRUCTION_BY_TASK[taskId];
    if (!spec) return;

    const anchorPart =
      spec.anchor === "part" && spec.partId
        ? this.partById(spec.partId)
        : undefined;
    const target = this.resolveAnchor(spec, anchorPart);
    if (!target) return;

    this.hideInstruction();

    const panel = this.world
      .createTransformEntity(undefined, { parent: this.world.sceneEntity })
      .addComponent(PanelUI, {
        config: spec.panelConfig,
        maxWidth: spec.maxWidth,
      })
      .addComponent(InstructionPanel)
      .addComponent(Follower, {
        behavior: FollowBehavior.NoRotation,
        target,
        offsetPosition: [spec.offsetX, spec.offsetY, spec.offsetZ],
        speed: INSTRUCTION_PANEL_FOLLOW_SPEED,
        tolerance: INSTRUCTION_PANEL_FOLLOW_TOLERANCE,
      })
      .addComponent(Billboard);

    if (anchorPart) {
      panel.addComponent(InstructionPanelAnchor, { part: anchorPart });
    }

    panel.object3D!.scale.setScalar(0.001);
    panel.object3D!.visible = true;
  }

  private hideInstruction(): void {
    for (const panel of [...this.queries.instructionPanels.entities]) {
      if (!panel.active) continue;
      hidePanelEntity(panel);
      panel.dispose();
    }
  }

  private popOutInstructionForPart(part: Entity): void {
    const panel = this.findInstructionPanelForPart(part);
    if (!panel?.active || !panel.object3D?.visible) return;
    if (panel.hasComponent(PopOut2D)) return;
    beginPanelPopOut(panel);
  }

  private popInInstructionForPart(part: Entity): void {
    const panel = this.findInstructionPanelForPart(part);
    if (!panel?.active || !panel.object3D) return;

    panel.object3D.visible = true;
    if (panel.hasComponent(PopOut2D) || !panel.hasComponent(PopIn2D)) {
      stripPanelSurface(panel);
      if (!panel.hasComponent(PopIn2D)) {
        panel.addComponent(PopIn2D);
      }
    }
  }

  private findInstructionPanelForPart(part: Entity): Entity | undefined {
    for (const panel of this.queries.instructionPartAnchors.entities) {
      if (panel.getValue(InstructionPanelAnchor, "part") === part) {
        return panel;
      }
    }
    return undefined;
  }

  private partById(id: string): Entity | undefined {
    for (const part of this.queries.parts.entities) {
      if (part.getValue(PhonographPart, "id") === id) return part;
    }
    return undefined;
  }

  private resolveAnchor(
    spec: InstructionSpec,
    anchorPart?: Entity,
  ): Object3D | null {
    if (spec.anchor === "part" && anchorPart) {
      return anchorPart.object3D ?? null;
    }

    const phonograph = this.first(this.queries.phonograph.entities);
    return phonograph?.object3D ?? null;
  }

  private defer(fn: () => void): void {
    queueMicrotask(fn);
  }

  private first(entities: Iterable<Entity>): Entity | undefined {
    for (const entity of entities) return entity;
    return undefined;
  }
}
