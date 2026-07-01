import {
  createComponent,
  createSystem,
  Entity,
  FollowBehavior,
  Follower,
  PanelDocument,
  PanelUI,
  Types,
  UIKit,
  UIKitDocument,
} from "@iwsdk/core";
import { PopIn2D, PopOut2D, PopOut2DDone } from "./animation.js";
import { Billboard } from "./billboard.js";
import { hidePanelEntity, stripPanelSurface } from "./panel-lifecycle.js";
import { Phonograph } from "./phonograph.js";
import { ActiveTask, CompletedTask, Task } from "./task.js";
import { PHONOGRAPH_CHAPTER_PANEL_MAX_WIDTH, TaskId } from "./task-config.js";

const CHECKLIST_CONFIG_BY_TASK: Record<string, string> = {
  [TaskId.AssemblyCylinderMount]: "./ui/checklists/chapter-1-assemble-step-1.json",
  [TaskId.AssemblyRecorderMount]: "./ui/checklists/chapter-1-assemble-step-2.json",
  [TaskId.AssemblyRecordingHornMount]:
    "./ui/checklists/chapter-1-assemble-step-3.json",
};

const CHECKLIST_MAX_WIDTH = PHONOGRAPH_CHAPTER_PANEL_MAX_WIDTH;
const CHECKLIST_OFFSET: [number, number, number] = [0, 0.44, -0.12];

const CHECKLIST_ORDER = [
  TaskId.AssemblyCylinderMount,
  TaskId.AssemblyRecorderMount,
  TaskId.AssemblyRecordingHornMount,
] as const;

type ChecklistTaskId = (typeof CHECKLIST_ORDER)[number];

function checklistStep(taskId: string): number {
  const index = CHECKLIST_ORDER.indexOf(taskId as ChecklistTaskId);
  return index >= 0 ? index : -1;
}

export const ChapterChecklist = createComponent("ChapterChecklist", {
  visible: { type: Types.Boolean, default: false },
});

export const ChapterChecklistInstance = createComponent(
  "ChapterChecklistInstance",
  {
    step: { type: Types.Int8, default: 0 },
  },
);

export class ChapterChecklistSystem extends createSystem({
  activeTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
  },
  phonograph: { required: [Phonograph] },
  anchors: { required: [ChapterChecklist] },
  instances: { required: [ChapterChecklistInstance] },
  checklistDocs: { required: [ChapterChecklistInstance, PanelDocument] },
  poppedOut: { required: [ChapterChecklistInstance, PopOut2DDone] },
}) {
  private currentStep = 0;

  init() {
    this.cleanupFuncs.push(
      this.queries.activeTask.subscribe("qualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        this.onTaskActive(taskId);
      }),

      this.queries.activeTask.subscribe("disqualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        if (taskId === TaskId.AssemblyRecordingHornMount) {
          this.hideChecklist();
        }
      }),

      this.queries.anchors.subscribe("qualify", () => {
        this.spawnChecklistPanels();
      }),

      this.queries.anchors.subscribe("disqualify", () => {
        for (const panel of this.queries.instances.entities) {
          this.beginPopOut(panel);
        }
      }),

      this.queries.checklistDocs.subscribe("qualify", (panel) => {
        const step = panel.getValue(ChapterChecklistInstance, "step") ?? 0;
        if (step === this.currentStep) {
          this.popInPanel(panel);
        }
      }),

      this.queries.poppedOut.subscribe("qualify", (panel) => {
        this.teardownPanel(panel);
      }),
    );
  }

  private onTaskActive(taskId: string): void {
    const step = checklistStep(taskId);
    if (step < 0) {
      this.hideChecklist();
      return;
    }

    this.currentStep = step;
    this.showChecklist();
    this.updateChecklistVisibility();
  }

  private showChecklist(): void {
    for (const anchor of this.queries.anchors.entities) {
      if (!anchor.getValue(ChapterChecklist, "visible")) {
        anchor.setValue(ChapterChecklist, "visible", true);
      }
      if (this.queries.instances.entities.size === 0) {
        this.spawnChecklistPanels();
      }
      return;
    }

    const phonograph = this.first(this.queries.phonograph.entities);
    if (!phonograph) return;
    phonograph.addComponent(ChapterChecklist, { visible: true });
  }

  private hideChecklist(): void {
    for (const anchor of this.queries.anchors.entities) {
      anchor.removeComponent(ChapterChecklist);
    }
  }

  private spawnChecklistPanels(): void {
    const anchor = this.first(this.queries.anchors.entities);
    const anchorObj = anchor?.object3D;
    if (!anchorObj) return;

    const configs = [
      CHECKLIST_CONFIG_BY_TASK[TaskId.AssemblyCylinderMount],
      CHECKLIST_CONFIG_BY_TASK[TaskId.AssemblyRecorderMount],
      CHECKLIST_CONFIG_BY_TASK[TaskId.AssemblyRecordingHornMount],
    ];

    for (let step = 0; step < configs.length; step += 1) {
      const config = configs[step];
      if (!config) continue;
      const panel = this.world
        .createTransformEntity(undefined, { parent: this.world.sceneEntity })
        .addComponent(PanelUI, { config, maxWidth: CHECKLIST_MAX_WIDTH })
        .addComponent(ChapterChecklistInstance, { step })
        .addComponent(Follower, {
          behavior: FollowBehavior.NoRotation,
          target: anchorObj,
          offsetPosition: CHECKLIST_OFFSET,
        })
        .addComponent(Billboard);

      panel.object3D!.scale.setScalar(0.001);
      panel.object3D!.visible = step === this.currentStep;
    }
  }

  private updateChecklistVisibility(): void {
    for (const panel of this.queries.instances.entities) {
      const step = panel.getValue(ChapterChecklistInstance, "step") ?? 0;
      if (!panel.object3D) continue;
      panel.object3D.visible = step === this.currentStep;
    }
  }

  private beginPopOut(panel: Entity): void {
    if (panel.hasComponent(PopOut2D)) return;
    stripPanelSurface(panel);
    panel.addComponent(PopOut2D);
  }

  private teardownPanel(panel: Entity): void {
    if (!panel.active) return;
    hidePanelEntity(panel);
    panel.dispose();
  }

  private popInPanel(panel: Entity): void {
    if (!panel.active) return;

    const doc = panel.getValue(PanelDocument, "document") as UIKitDocument | null;
    const root = doc?.getElementById("panel-root") as UIKit.Component | undefined;
    if (root) root.scale.setScalar(0.001);

    stripPanelSurface(panel);
    if (!panel.hasComponent(PopIn2D)) {
      panel.addComponent(PopIn2D);
    }
  }

  private first(entities: Iterable<Entity>): Entity | undefined {
    for (const entity of entities) return entity;
    return undefined;
  }
}
