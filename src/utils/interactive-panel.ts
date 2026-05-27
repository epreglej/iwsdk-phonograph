import {
  createComponent,
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

const RECORDING_READY_PANEL_CONFIG = "./ui/interactive-recording-ready.json";
const POP_OUT_MS = 560;

/** Added when the user confirms the active task's interactive panel. */
export const InteractivePanelConfirmed = createComponent(
  "InteractivePanelConfirmed",
  {},
);

export class InteractivePanelSystem extends createSystem({
  recordingTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask, InteractivePanelConfirmed],
    where: [eq(Task, "id", "recording")],
  },
  phonograph: { required: [Phonograph] },
  recordingReadyPanel: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, "config", RECORDING_READY_PANEL_CONFIG)],
  },
}) {
  private recordingReadyPanelEntity!: Entity;
  private recordingReadyDocReady = false;
  private recordingReadyWanted = false;
  private recordingReadyButtonWired = false;
  private recordingReadyHideTimer: ReturnType<typeof setTimeout> | null = null;

  init() {
    const [phonographEntity] = this.queries.phonograph.entities;

    this.recordingReadyPanelEntity = this.world
      .createTransformEntity(undefined, { parent: this.world.sceneEntity })
      .addComponent(PanelUI, {
        config: RECORDING_READY_PANEL_CONFIG,
        maxWidth: 0.17,
      });
    this.recordingReadyPanelEntity.object3D!.scale.set(0.001, 0.001, 0.001);
    this.recordingReadyPanelEntity.object3D!.visible = false;

    this.cleanupFuncs.push(
      this.queries.recordingTask.subscribe("qualify", () => {
        this.recordingReadyWanted = true;
        this.recordingReadyPanelEntity
          .addComponent(Follower, {
            behavior: FollowBehavior.NoRotation,
            target: phonographEntity.object3D!,
            offsetPosition: [0, 0.5, 0],
          })
          .addComponent(Billboard)
          .addComponent(PokeInteractable);

        this.tryRevealRecordingReadyPanel();
      }),

      this.queries.recordingTask.subscribe("disqualify", () => {
        this.hideRecordingReadyPanel();
      }),

      this.queries.recordingReadyPanel.subscribe("qualify", () => {
        this.recordingReadyDocReady = true;
        this.wireRecordingReadyContinueButton();
        this.tryRevealRecordingReadyPanel();
      }),

      this.queries.recordingReadyPanel.subscribe("disqualify", () => {
        this.recordingReadyDocReady = false;
        this.recordingReadyButtonWired = false;
      }),
    );
  }

  private wireRecordingReadyContinueButton(): void {
    if (this.recordingReadyButtonWired) return;

    const doc = this.recordingReadyPanelEntity.getValue(
      PanelDocument,
      "document",
    ) as UIKitDocument | undefined;
    const button = doc?.getElementById("continue-button") as
      | UIKit.Component
      | undefined;
    button?.addEventListener("click", () => {
      const [taskEntity] = this.queries.recordingTask.entities;
      if (!taskEntity || taskEntity.hasComponent(InteractivePanelConfirmed)) {
        return;
      }
      taskEntity.addComponent(InteractivePanelConfirmed);
    });
    this.recordingReadyButtonWired = true;
  }

  private tryRevealRecordingReadyPanel(): void {
    if (!this.recordingReadyWanted || !this.recordingReadyDocReady) return;

    const obj = this.recordingReadyPanelEntity.object3D!;
    if (obj.visible) return;

    obj.visible = true;
    this.recordingReadyPanelEntity.removeComponent(PopOut2D);
    if (!this.recordingReadyPanelEntity.hasComponent(PopIn2D)) {
      this.recordingReadyPanelEntity.addComponent(PopIn2D);
    }
  }

  private hideRecordingReadyPanel(): void {
    this.recordingReadyWanted = false;

    if (!this.recordingReadyPanelEntity.object3D!.visible) return;

    if (this.recordingReadyHideTimer !== null) {
      clearTimeout(this.recordingReadyHideTimer);
      this.recordingReadyHideTimer = null;
    }

    this.recordingReadyPanelEntity
      .removeComponent(PopIn2D)
      .addComponent(PopOut2D);

    this.recordingReadyHideTimer = setTimeout(() => {
      if (this.recordingReadyPanelEntity.active) {
        this.recordingReadyPanelEntity.object3D!.visible = false;
        this.recordingReadyPanelEntity.removeComponent(PopOut2D);
        this.recordingReadyPanelEntity
          .removeComponent(PokeInteractable)
          .removeComponent(Follower)
          .removeComponent(Billboard);
      }
      this.recordingReadyHideTimer = null;
    }, POP_OUT_MS);
  }
}
