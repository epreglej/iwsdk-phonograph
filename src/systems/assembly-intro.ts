import {
  createComponent,
  createSystem,
  Entity,
  FollowBehavior,
  Follower,
  PanelDocument,
  PanelUI,
  PokeInteractable,
  Types,
  UIKit,
  UIKitDocument,
} from "@iwsdk/core";
import { resumeAudioContext } from "../audio/context.js";
import { playTaskNarration, stopTaskNarration } from "../audio/narration.js";
import { PopIn2D, PopIn2DDone, PopOut2D, PopOut2DDone } from "./animation.js";
import { Billboard } from "./billboard.js";
import {
  beginPanelPopOut,
  hidePanelEntity,
  stripPanelSurface,
} from "./panel-lifecycle.js";
import { Phonograph } from "./phonograph.js";
import { ActiveTask, CompletedTask, Task } from "./task.js";
import {
  PHONOGRAPH_CHAPTER_OFFSET_Y,
  PHONOGRAPH_CHAPTER_OFFSET_Z,
  PHONOGRAPH_CHAPTER_PANEL_MAX_WIDTH,
  TaskId,
} from "./task-config.js";

const STEP1_CONFIG = "./ui/chapters/chapter-0.json";
const STEP1_NARRATION = "./audio/chapter-0.wav";
const STEP2_CONFIG = "./ui/chapters/chapter-1.json";

const INTRO_OFFSET: [number, number, number] = [
  0,
  PHONOGRAPH_CHAPTER_OFFSET_Y,
  PHONOGRAPH_CHAPTER_OFFSET_Z,
];

export const AssemblyIntroPanel = createComponent("AssemblyIntroPanel", {
  role: { type: Types.String, default: "" },
});

export class AssemblyIntroSystem extends createSystem({
  activeIntroTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
  },
  phonograph: { required: [Phonograph] },
  introPanels: { required: [AssemblyIntroPanel] },
  introPanelDocs: { required: [AssemblyIntroPanel, PanelDocument] },
  introPopInDone: { required: [AssemblyIntroPanel, PopIn2DDone] },
  introPoppedOut: { required: [AssemblyIntroPanel, PopOut2DDone] },
  activeTasks: { required: [Task, ActiveTask], excluded: [CompletedTask] },
}) {
  private pendingCompleteTaskId: string | null = null;
  private pendingCompleteRole: "step1" | "step2" | null = null;
  private pendingWiring: Entity[] = [];
  private pendingPoke: Entity[] = [];
  private wiredPanelIds = new Set<number>();

  init() {
    this.cleanupFuncs.push(
      this.queries.activeIntroTask.subscribe("qualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id");
        if (!this.isIntroTaskId(taskId)) return;
        if (!taskId) return;
        this.spawnPanelForIntroTask(taskId);
      }),

      this.queries.activeIntroTask.subscribe("disqualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id");
        if (!this.isIntroTaskId(taskId)) return;
        this.teardownAll();
      }),

      this.queries.introPanelDocs.subscribe("qualify", (panel) => {
        this.popInPanel(panel);
        this.pendingWiring.push(panel);
      }),

      this.queries.introPopInDone.subscribe("qualify", (panel) => {
        const role = panel.getValue(AssemblyIntroPanel, "role");
        if (role === "step1" || role === "step2") {
          this.pendingPoke.push(panel);
        }
        if (role === "step1") {
          void resumeAudioContext().then(() => {
            playTaskNarration(STEP1_NARRATION, 1, () => {
              // Keep behavior simple: narration may finish while panel remains visible.
            });
          });
        }
      }),

      this.queries.introPoppedOut.subscribe("qualify", (panel) => {
        this.defer(() => this.onPanelPoppedOut(panel));
      }),
    );
  }

  update() {
    this.processPendingWiring();
    this.processPendingPoke();
  }

  /** Avoid ECS mutations during AnimationSystem pop-out callbacks. */
  private defer(fn: () => void): void {
    queueMicrotask(fn);
  }

  private processPendingWiring(): void {
    const retry: Entity[] = [];
    for (const panel of this.pendingWiring) {
      if (!panel.active) continue;
      if (!this.wirePanel(panel)) retry.push(panel);
    }
    this.pendingWiring = retry;
  }

  private processPendingPoke(): void {
    for (const panel of this.pendingPoke) {
      this.enablePoke(panel);
    }
    this.pendingPoke.length = 0;
  }

  private spawnPanelForIntroTask(taskId: string): void {
    this.teardownAll();

    const phonograph = this.first(this.queries.phonograph.entities);
    if (!phonograph?.object3D) return;

    const isStep1 = taskId === TaskId.AssemblyIntro;
    this.spawnPanel(phonograph, isStep1 ? STEP1_CONFIG : STEP2_CONFIG, PHONOGRAPH_CHAPTER_PANEL_MAX_WIDTH, INTRO_OFFSET, isStep1 ? "step1" : "step2");
  }

  private spawnPanel(
    phonograph: Entity,
    config: string,
    maxWidth: number,
    offset: [number, number, number],
    role: string,
  ): void {
    const panel = this.world
      .createTransformEntity(undefined, { parent: this.world.sceneEntity })
      .addComponent(PanelUI, { config, maxWidth })
      .addComponent(AssemblyIntroPanel, { role })
      .addComponent(Follower, {
        behavior: FollowBehavior.NoRotation,
        target: phonograph.object3D!,
        offsetPosition: offset,
      })
      .addComponent(Billboard);

    panel.object3D!.scale.setScalar(0.001);
    panel.object3D!.visible = true;
  }

  private popInPanel(panel: Entity): void {
    const doc = panel.getValue(PanelDocument, "document") as UIKitDocument | null;
    const root = doc?.getElementById("panel-root") as UIKit.Component | undefined;
    if (root) root.scale.setScalar(0.001);

    stripPanelSurface(panel);
    if (!panel.hasComponent(PopIn2D)) {
      panel.addComponent(PopIn2D);
    }
  }

  private enablePoke(panel: Entity): void {
    if (!panel.active) return;

    const role = panel.getValue(AssemblyIntroPanel, "role");
    if (
      (role === "step1" || role === "step2") &&
      !panel.hasComponent(PokeInteractable)
    ) {
      panel.addComponent(PokeInteractable);
    }
  }

  /** @returns true when wiring succeeded or is not needed */
  private wirePanel(panel: Entity): boolean {
    if (!panel.active || this.wiredPanelIds.has(panel.index)) return true;

    const role = panel.getValue(AssemblyIntroPanel, "role") ?? "";
    if (role !== "step1" && role !== "step2") return true;

    const doc = panel.getValue(PanelDocument, "document") as UIKitDocument | null;
    if (!doc) return false;

    const buttonId =
      role === "step1"
        ? "assembly-intro-next-button"
        : "assembly-intro-close-button";
    const button = doc.getElementById(buttonId);
    if (!button) return false;

    button.addEventListener("click", () => {
      void resumeAudioContext();
      if (role === "step1") this.onNextPressed();
      else this.onClosePressed();
    });

    this.wiredPanelIds.add(panel.index);
    return true;
  }

  private onNextPressed(): void {
    stopTaskNarration();
    if (this.activeTaskId() !== TaskId.AssemblyIntro || this.pendingCompleteTaskId) return;
    this.pendingCompleteTaskId = TaskId.AssemblyIntro;
    this.pendingCompleteRole = "step1";

    for (const panel of [...this.queries.introPanels.entities]) {
      if (panel.getValue(AssemblyIntroPanel, "role") === "step1") {
        panel.removeComponent(PokeInteractable);
        beginPanelPopOut(panel);
      }
    }
  }

  private onClosePressed(): void {
    if (
      this.pendingCompleteTaskId ||
      this.activeTaskId() !== TaskId.AssemblyChapterIntro
    ) {
      return;
    }
    stopTaskNarration();

    for (const panel of this.queries.introPanels.entities) {
      if (panel.getValue(AssemblyIntroPanel, "role") === "step2") {
        this.pendingCompleteTaskId = TaskId.AssemblyChapterIntro;
        this.pendingCompleteRole = "step2";
        panel.removeComponent(PokeInteractable);
        beginPanelPopOut(panel);
        return;
      }
    }
  }

  private onPanelPoppedOut(panel: Entity): void {
    const role = panel.getValue(AssemblyIntroPanel, "role") ?? "";
    this.disposePanel(panel);

    if (this.pendingCompleteTaskId && role === this.pendingCompleteRole) {
      const taskId = this.pendingCompleteTaskId;
      this.pendingCompleteTaskId = null;
      this.pendingCompleteRole = null;
      this.completeIntroTask(taskId);
    }
  }

  private completeIntroTask(taskId: string): void {
    this.defer(() => {
      for (const task of this.queries.activeTasks.entities) {
        if (task.getValue(Task, "id") === taskId && !task.hasComponent(CompletedTask)) {
          task.addComponent(CompletedTask);
          return;
        }
      }
    });
  }

  private teardownAll(): void {
    stopTaskNarration();
    this.pendingCompleteTaskId = null;
    this.pendingCompleteRole = null;
    this.pendingWiring.length = 0;
    this.pendingPoke.length = 0;
    this.wiredPanelIds.clear();

    for (const panel of [...this.queries.introPanels.entities]) {
      this.disposePanel(panel);
    }
  }

  private disposePanel(panel: Entity): void {
    if (!panel.active) return;
    this.wiredPanelIds.delete(panel.index);
    hidePanelEntity(panel);
    panel.dispose();
  }

  private first(entities: Iterable<Entity>): Entity | undefined {
    for (const entity of entities) return entity;
    return undefined;
  }

  private activeTaskId(): string | undefined {
    const task = this.first(this.queries.activeTasks.entities);
    return task?.getValue(Task, "id") ?? undefined;
  }

  private isIntroTaskId(taskId: string | null | undefined): boolean {
    return taskId === TaskId.AssemblyIntro || taskId === TaskId.AssemblyChapterIntro;
  }
}
