import {
  createSystem,
  Entity,
  eq,
  FollowBehavior,
  Follower,
  PanelDocument,
  PanelUI,
  PokeInteractable,
  UIKit,
  UIKitDocument,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../task.js";
import { Phonograph } from "../phonograph/phonograph.js";
import { Billboard } from "./billboard.js";
import { PopIn2D, PopOut2D } from "../animations/animation.js";

const INTERACTIVE_RECORDING_READY_PANEL_CONFIG =
  "./ui/interactive-recording-ready.json";
const POP_OUT_MS = 560;

type InteractivePanelCopy = {
  title: string;
  body: string;
};

export class InteractivePanelSystem extends createSystem({
  recordingSetupInfoTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "recording_setup_info")],
  },
  recordingReadyInfoTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "recording_ready_info")],
  },
  playbackSetupInfoTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "playback_setup_info")],
  },
  playbackReadyInfoTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "playback_ready_info")],
  },
  recordingTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "recording")],
  },
  phonograph: { required: [Phonograph] },
  panel: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, "config", INTERACTIVE_RECORDING_READY_PANEL_CONFIG)],
  },
}) {
  private panelEntity!: Entity;
  private doc: UIKitDocument | null = null;
  private panelWanted = false;
  private buttonWired = false;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private currentTaskEntity: Entity | null = null;
  private currentTaskId: string | null = null;

  init() {
    const [phonographEntity] = this.queries.phonograph.entities;

    this.panelEntity = this.world
      .createTransformEntity(undefined, { parent: this.world.sceneEntity })
      .addComponent(PanelUI, {
        config: INTERACTIVE_RECORDING_READY_PANEL_CONFIG,
        maxWidth: 0.17,
      });
    this.panelEntity.object3D!.scale.set(0.001, 0.001, 0.001);
    this.panelEntity.object3D!.visible = false;

    this.cleanupFuncs.push(
      this.queries.panel.subscribe("qualify", (entity) => {
        this.doc = entity.getValue(PanelDocument, "document") as UIKitDocument;
        this.wireContinueButton();
        this.tryRevealPanel();
      }),

      this.queries.panel.subscribe("disqualify", () => {
        this.doc = null;
        this.buttonWired = false;
      }),

      this.queries.recordingSetupInfoTask.subscribe("qualify", (taskEntity) => {
        this.showForTask(taskEntity, phonographEntity, {
          title: "Recording setup",
          body: "First we need to assemble the phonograph for recording.",
        });
      }),

      this.queries.recordingReadyInfoTask.subscribe("qualify", (taskEntity) => {
        this.showForTask(taskEntity, phonographEntity, {
          title: "Ready to record",
          body: "The phonograph is now ready to record. Get ready to talk into the horn, then press Continue to start the countdown.",
        });
      }),

      this.queries.playbackSetupInfoTask.subscribe("qualify", (taskEntity) => {
        this.showForTask(taskEntity, phonographEntity, {
          title: "Playback setup",
          body: "To playback our recording we need to remove the recording parts and assemble the playback parts.",
        });
      }),

      this.queries.playbackReadyInfoTask.subscribe("qualify", (taskEntity) => {
        this.showForTask(taskEntity, phonographEntity, {
          title: "Playback ready",
          body: "Phonograph is ready to play your recording.",
        });
      }),

      this.queries.recordingTask.subscribe("qualify", () => {
        this.currentTaskEntity = null;
        this.currentTaskId = null;
        this.hidePanel();
      }),
    );
  }

  private showForTask(
    taskEntity: Entity,
    phonographEntity: Entity,
    copy: InteractivePanelCopy,
  ): void {
    this.currentTaskEntity = taskEntity;
    this.currentTaskId = taskEntity.getValue(Task, "id")!;
    this.panelWanted = true;

    this.panelEntity
      .addComponent(Follower, {
        behavior: FollowBehavior.NoRotation,
        target: phonographEntity.object3D!,
        offsetPosition: [0, 0.5, 0],
      })
      .addComponent(Billboard)
      .addComponent(PokeInteractable);

    this.setCopy(copy);
    this.tryRevealPanel();
  }

  private setCopy(copy: InteractivePanelCopy): void {
    if (!this.doc) return;

    const title = this.doc.getElementById("interactive-panel-title") as
      | UIKit.Component
      | undefined;
    const body = this.doc.getElementById("interactive-panel-body") as
      | UIKit.Component
      | undefined;

    (title as any)?.setProperties?.({ text: copy.title });
    (body as any)?.setProperties?.({ text: copy.body });
  }

  private wireContinueButton(): void {
    if (this.buttonWired || !this.doc) return;

    const button = this.doc.getElementById("continue-button") as
      | UIKit.Component
      | undefined;

    button?.addEventListener("click", () => {
      const taskEntity = this.currentTaskEntity;
      const taskId = this.currentTaskId;
      if (!taskEntity || !taskEntity.active || !taskId) return;

      // Dismiss immediately after interaction to avoid stale lingering panels.
      this.hidePanel();
      this.currentTaskEntity = null;
      this.currentTaskId = null;
      taskEntity.addComponent(CompletedTask);
    });

    this.buttonWired = true;
  }

  private tryRevealPanel(): void {
    if (!this.panelWanted || !this.doc) return;

    const obj = this.panelEntity.object3D!;
    if (obj.visible) return;

    obj.visible = true;
    this.panelEntity.removeComponent(PopOut2D);
    if (!this.panelEntity.hasComponent(PopIn2D)) {
      this.panelEntity.addComponent(PopIn2D);
    }
  }

  private hidePanel(): void {
    this.panelWanted = false;

    if (!this.panelEntity.object3D!.visible) return;

    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    this.panelEntity.removeComponent(PopIn2D).addComponent(PopOut2D);
    this.hideTimer = setTimeout(() => {
      if (this.panelEntity.active) {
        this.panelEntity.object3D!.visible = false;
        this.panelEntity.removeComponent(PopOut2D);
        this.panelEntity
          .removeComponent(PokeInteractable)
          .removeComponent(Follower)
          .removeComponent(Billboard);
      }
      this.hideTimer = null;
    }, POP_OUT_MS);
  }
}
