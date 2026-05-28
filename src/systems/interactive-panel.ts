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
import { Phonograph } from "../components/phonograph.js";
import { Billboard } from "../components/billboard.js";
import {
  INTERACTIVE_PANEL_BY_TASK,
  type InteractivePanelCopy,
} from "../ui/interactive-panel-config.js";
import { hidePanelWithPopOut, revealPanel } from "../ui/panel-lifecycle.js";
import { setPanelElementText } from "../ui/panel-text.js";
import { firstEntity } from "../helpers/entity-query.js";
import { createSpatialPanel } from "../ui/spatial-panel.js";

const INTERACTIVE_PANEL_CONFIG = "./ui/interactive-recording-ready.json";

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
    where: [eq(PanelUI, "config", INTERACTIVE_PANEL_CONFIG)],
  },
}) {
  private panelEntity!: Entity;
  private doc: UIKitDocument | null = null;
  private panelWanted = false;
  private buttonWired = false;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private currentTaskEntity: Entity | null = null;
  private pendingCopy: InteractivePanelCopy | null = null;

  init() {
    this.panelEntity = createSpatialPanel(this.world, {
      config: INTERACTIVE_PANEL_CONFIG,
      maxWidth: 0.35,
    });

    this.cleanupFuncs.push(
      this.queries.panel.subscribe(
        "qualify",
        (entity) => {
          if (entity.index !== this.panelEntity.index) return;

          this.doc = entity.getValue(
            PanelDocument,
            "document",
          ) as UIKitDocument;
          this.applyCopy();
          this.wireContinueButton();
          this.tryRevealPanel();
        },
        true,
      ),

      this.queries.panel.subscribe("disqualify", (entity) => {
        if (entity.index !== this.panelEntity.index) return;
        this.doc = null;
        this.buttonWired = false;
      }),

      this.queries.recordingSetupInfoTask.subscribe("qualify", (taskEntity) => {
        this.showForTask(
          taskEntity,
          INTERACTIVE_PANEL_BY_TASK.recording_setup_info,
        );
      }),
      this.queries.recordingSetupInfoTask.subscribe("disqualify", () => {
        this.hidePanel();
      }),

      this.queries.recordingReadyInfoTask.subscribe("qualify", (taskEntity) => {
        this.showForTask(
          taskEntity,
          INTERACTIVE_PANEL_BY_TASK.recording_ready_info,
        );
      }),
      this.queries.recordingReadyInfoTask.subscribe("disqualify", () => {
        this.hidePanel();
      }),

      this.queries.playbackSetupInfoTask.subscribe("qualify", (taskEntity) => {
        this.showForTask(
          taskEntity,
          INTERACTIVE_PANEL_BY_TASK.playback_setup_info,
        );
      }),
      this.queries.playbackSetupInfoTask.subscribe("disqualify", () => {
        this.hidePanel();
      }),

      this.queries.playbackReadyInfoTask.subscribe("qualify", (taskEntity) => {
        this.showForTask(
          taskEntity,
          INTERACTIVE_PANEL_BY_TASK.playback_ready_info,
        );
      }),
      this.queries.playbackReadyInfoTask.subscribe("disqualify", () => {
        this.hidePanel();
      }),

      this.queries.recordingTask.subscribe("qualify", () => {
        this.currentTaskEntity = null;
        this.pendingCopy = null;
        this.hidePanel();
      }),
    );
  }

  private showForTask(
    taskEntity: Entity,
    copy: InteractivePanelCopy,
  ): void {
    const phonographEntity = firstEntity(this.queries.phonograph.entities);
    if (!phonographEntity?.object3D) return;

    this.currentTaskEntity = taskEntity;
    this.pendingCopy = copy;
    this.panelWanted = true;

    this.panelEntity
      .addComponent(Follower, {
        behavior: FollowBehavior.NoRotation,
        target: phonographEntity.object3D,
        offsetPosition: [0, 0.55, 0],
      })
      .addComponent(Billboard)
      .addComponent(PokeInteractable);

    this.applyCopy();
    this.tryRevealPanel();
  }

  private applyCopy(): void {
    if (!this.pendingCopy || !this.doc) return;

    setPanelElementText(
      this.doc,
      "interactive-panel-title",
      this.pendingCopy.title,
    );
    setPanelElementText(
      this.doc,
      "interactive-panel-body",
      this.pendingCopy.body,
    );
  }

  private wireContinueButton(): void {
    if (this.buttonWired || !this.doc) return;

    const button = this.doc.getElementById("continue-button");
    button?.addEventListener("click", () => {
      const taskEntity = this.currentTaskEntity;
      if (!taskEntity?.active) return;

      this.hidePanel();
      this.currentTaskEntity = null;
      this.pendingCopy = null;
      taskEntity.addComponent(CompletedTask);
    });

    this.buttonWired = true;
  }

  private tryRevealPanel(): void {
    if (!this.panelWanted || !this.doc) return;

    revealPanel(this.panelEntity);
  }

  private hidePanel(): void {
    this.panelWanted = false;
    this.pendingCopy = null;

    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    this.hideTimer = hidePanelWithPopOut(this.panelEntity, () => {
      this.hideTimer = null;
      if (this.panelEntity.active) {
        this.panelEntity
          .removeComponent(PokeInteractable)
          .removeComponent(Follower)
          .removeComponent(Billboard);
      }
    });
  }
}
