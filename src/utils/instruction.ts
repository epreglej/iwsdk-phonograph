import {
  createComponent,
  createSystem,
  Entity,
  eq,
  FollowBehavior,
  Follower,
  PanelDocument,
  PanelUI,
  UIKit,
  UIKitDocument,
} from "@iwsdk/core";
import { ActiveTask, CompletedTask, Task } from "../task.js";
import { Phonograph } from "../phonograph/phonograph.js";
import { Billboard } from "./billboard.js";
import { PopIn2D, PopOut2D } from "../animations/animation.js";
import { InteractivePanelConfirmed } from "./interactive-panel.js";

const INSTRUCTION_PANEL_CONFIG = "./ui/task-instruction.json";
const COUNTDOWN_PANEL_CONFIG = "./ui/instruction-countdown.json";
const POP_OUT_MS = 560;

/** Added to the active "recording" task after countdown completes. */
export const RecordingArmed = createComponent("RecordingArmed", {});

export class InstructionSystem extends createSystem({
  activeTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
  },
  phonograph: { required: [Phonograph] },
  recordingCountdown: {
    required: [Task, ActiveTask, InteractivePanelConfirmed],
    excluded: [CompletedTask, RecordingArmed],
    where: [eq(Task, "id", "recording")],
  },
  instructionPanel: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, "config", INSTRUCTION_PANEL_CONFIG)],
  },
  countdownPanel: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, "config", COUNTDOWN_PANEL_CONFIG)],
  },
}) {
  private instructionPanelEntity!: Entity;
  private countdownPanelEntity!: Entity;

  private instructionDoc: UIKitDocument | null = null;
  private countdownDoc: UIKitDocument | null = null;
  private pendingInstructionText: string | null = null;
  private pendingCountdownText: string | null = null;

  private instructionWanted = false;
  private countdownWanted = false;
  private displayedInstructionText: string | null = null;
  private displayedCountdownText: string | null = null;

  private sequenceToken = 0;
  private instructionTransitionToken = 0;
  private countdownTimers: ReturnType<typeof setTimeout>[] = [];
  private instructionHideTimer: ReturnType<typeof setTimeout> | null = null;
  private instructionTransitionTimer: ReturnType<typeof setTimeout> | null =
    null;
  private countdownHideTimer: ReturnType<typeof setTimeout> | null = null;

  init() {
    const [phonographEntity] = this.queries.phonograph.entities;

    this.instructionPanelEntity = this.world
      .createTransformEntity(undefined, { parent: this.world.sceneEntity })
      .addComponent(PanelUI, {
        config: INSTRUCTION_PANEL_CONFIG,
        maxWidth: 0.35,
      });
    this.instructionPanelEntity.object3D!.scale.set(0.001, 0.001, 0.001);
    this.instructionPanelEntity.object3D!.visible = false;

    this.countdownPanelEntity = this.world
      .createTransformEntity(undefined, { parent: this.world.sceneEntity })
      .addComponent(PanelUI, {
        config: COUNTDOWN_PANEL_CONFIG,
        maxWidth: 0.2,
      });
    this.countdownPanelEntity.object3D!.scale.set(0.001, 0.001, 0.001);
    this.countdownPanelEntity.object3D!.visible = false;

    this.cleanupFuncs.push(
      this.queries.instructionPanel.subscribe("qualify", (entity) => {
        this.instructionDoc = entity.getValue(
          PanelDocument,
          "document",
        ) as UIKitDocument;
        this.tryRevealInstructionPanel();
        if (this.pendingInstructionText !== null) {
          const text = this.pendingInstructionText;
          this.pendingInstructionText = null;
          this.setInstruction(text);
        }
      }),

      this.queries.instructionPanel.subscribe("disqualify", () => {
        this.instructionDoc = null;
      }),

      this.queries.countdownPanel.subscribe("qualify", (entity) => {
        this.countdownDoc = entity.getValue(
          PanelDocument,
          "document",
        ) as UIKitDocument;
        this.tryRevealCountdownPanel();
        if (this.pendingCountdownText !== null) {
          const text = this.pendingCountdownText;
          this.pendingCountdownText = null;
          this.setCountdown(text);
        }
      }),

      this.queries.countdownPanel.subscribe("disqualify", () => {
        this.countdownDoc = null;
      }),

      this.queries.activeTask.subscribe("qualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        this.sequenceToken += 1;
        this.clearCountdownTimers();
        this.clearInstructionPanelTimers();
        this.instructionTransitionToken += 1;

        this.hideCountdownPanel();

        if (this.shouldShowInstruction(taskId)) {
          this.showInstructionPanel(phonographEntity);
        } else {
          this.hideInstructionPanel();
        }

        this.handleTaskInstruction(taskEntity, taskId, this.sequenceToken);
      }),

      this.queries.recordingCountdown.subscribe("qualify", (taskEntity) => {
        this.playRecordingCountdown(taskEntity, this.sequenceToken);
      }),
    );
  }

  private shouldShowInstruction(taskId: string): boolean {
    if (taskId === "recording") return false;
    return !taskId.startsWith("introduction_") && taskId !== "done";
  }

  private showInstructionPanel(phonographEntity: Entity): void {
    this.instructionWanted = true;
    this.instructionPanelEntity
      .addComponent(Follower, {
        behavior: FollowBehavior.NoRotation,
        target: phonographEntity.object3D!,
        offsetPosition: [0, 0.45, 0],
      })
      .addComponent(Billboard);

    this.tryRevealInstructionPanel();
  }

  private tryRevealInstructionPanel(): void {
    if (!this.instructionWanted || !this.instructionDoc) return;

    const obj = this.instructionPanelEntity.object3D!;
    if (obj.visible) return;

    obj.visible = true;
    this.instructionPanelEntity.removeComponent(PopOut2D);
    if (!this.instructionPanelEntity.hasComponent(PopIn2D)) {
      this.instructionPanelEntity.addComponent(PopIn2D);
    }
  }

  private hideInstructionPanel(): void {
    this.instructionWanted = false;
    this.instructionTransitionToken += 1;
    this.clearInstructionPanelTimers();

    if (!this.instructionPanelEntity.object3D!.visible) {
      this.displayedInstructionText = null;
      return;
    }

    this.instructionPanelEntity.removeComponent(PopIn2D).addComponent(PopOut2D);
    this.instructionHideTimer = setTimeout(() => {
      if (this.instructionPanelEntity.active) {
        this.instructionPanelEntity.object3D!.visible = false;
        this.instructionPanelEntity.removeComponent(PopOut2D);
      }
      this.displayedInstructionText = null;
      this.instructionHideTimer = null;
    }, POP_OUT_MS);
  }

  private showCountdownPanel(phonographEntity: Entity): void {
    this.countdownWanted = true;
    this.countdownPanelEntity
      .addComponent(Follower, {
        behavior: FollowBehavior.NoRotation,
        target: phonographEntity.object3D!,
        offsetPosition: [0, 0.63, 0],
      })
      .addComponent(Billboard);

    this.tryRevealCountdownPanel();
  }

  private tryRevealCountdownPanel(): void {
    if (!this.countdownWanted || !this.countdownDoc) return;

    const obj = this.countdownPanelEntity.object3D!;
    if (obj.visible) return;

    obj.visible = true;
    this.countdownPanelEntity.removeComponent(PopOut2D);
    if (!this.countdownPanelEntity.hasComponent(PopIn2D)) {
      this.countdownPanelEntity.addComponent(PopIn2D);
    }
  }

  private hideCountdownPanel(): void {
    this.countdownWanted = false;

    if (!this.countdownPanelEntity.object3D!.visible) {
      this.displayedCountdownText = null;
      return;
    }

    if (this.countdownHideTimer !== null) {
      clearTimeout(this.countdownHideTimer);
      this.countdownHideTimer = null;
    }

    this.countdownPanelEntity.removeComponent(PopIn2D).addComponent(PopOut2D);
    this.countdownHideTimer = setTimeout(() => {
      if (this.countdownPanelEntity.active) {
        this.countdownPanelEntity.object3D!.visible = false;
        this.countdownPanelEntity.removeComponent(PopOut2D);
      }
      this.displayedCountdownText = null;
      this.countdownHideTimer = null;
    }, POP_OUT_MS);
  }

  private handleTaskInstruction(taskEntity: Entity, taskId: string, token: number): void {
    if (
      taskId === "cylinder_mount" ||
      taskId === "recording_diaphragm_mount" ||
      taskId === "recording_trumpet_mount"
    ) {
      this.setInstruction(
        "Assemble the phonograph for recording.",
      );
      return;
    }

    if (taskId === "crank_cranking") {
      this.setInstruction("Phonograph assembled! Crank it to wind the spring.");
      return;
    }

    if (taskId === "recording") {
      return;
    }

    if (
      taskId === "recording_trumpet_unmount" ||
      taskId === "recording_diaphragm_unmount"
    ) {
      this.setInstruction("Remove the parts for recording.");
      return;
    }

    if (
      taskId === "playback_diaphragm_mount" ||
      taskId === "playback_trumpet_mount"
    ) {
      this.setInstruction("Assemble the phonograph for playback.");
      return;
    }

    if (taskId === "playback") {
      this.setInstruction("Playback started. Listen to your recording.");
    }
  }

  private playRecordingCountdown(taskEntity: Entity, token: number): void {
    const [phonographEntity] = this.queries.phonograph.entities;

    this.showCountdownPanel(phonographEntity);

    const countdown = [5, 4, 3, 2, 1];
    countdown.forEach((n, i) => {
      const t = setTimeout(() => {
        if (token !== this.sequenceToken) return;
        this.setCountdown(String(n));
      }, i * 1000);
      this.countdownTimers.push(t);
    });

    const doneTimer = setTimeout(() => {
      if (token !== this.sequenceToken) return;
      this.hideCountdownPanel();
      this.showInstructionPanel(phonographEntity);
      this.setInstruction("Speak into the horn.");
      if (!taskEntity.hasComponent(RecordingArmed)) {
        taskEntity.addComponent(RecordingArmed);
      }
    }, countdown.length * 1000);
    this.countdownTimers.push(doneTimer);
  }

  private setInstruction(text: string): void {
    if (text === this.displayedInstructionText) return;

    if (!this.instructionDoc) {
      this.pendingInstructionText = text;
      return;
    }

    const panelVisible = this.instructionPanelEntity.object3D!.visible;
    const canTransition =
      panelVisible && this.displayedInstructionText !== null;

    if (!canTransition) {
      this.applyInstructionText(text);
      this.displayedInstructionText = text;
      return;
    }

    const token = ++this.instructionTransitionToken;
    this.instructionPanelEntity.removeComponent(PopIn2D).addComponent(PopOut2D);

    this.instructionTransitionTimer = setTimeout(() => {
      if (token !== this.instructionTransitionToken) return;

      this.instructionPanelEntity.removeComponent(PopOut2D);
      this.applyInstructionText(text);
      this.displayedInstructionText = text;
      this.instructionPanelEntity.addComponent(PopIn2D);
      this.instructionTransitionTimer = null;
    }, POP_OUT_MS);
  }

  private setCountdown(text: string): void {
    if (text === this.displayedCountdownText) return;

    if (!this.countdownDoc) {
      this.pendingCountdownText = text;
      return;
    }

    this.applyCountdownText(text);
    this.displayedCountdownText = text;
  }

  private applyInstructionText(text: string): void {
    const label = this.instructionDoc?.getElementById(
      "instruction-text",
    ) as UIKit.Component | undefined;
    if (!label) return;
    (label as any).setProperties?.({ text });
  }

  private applyCountdownText(text: string): void {
    const label = this.countdownDoc?.getElementById(
      "countdown-text",
    ) as UIKit.Component | undefined;
    if (!label) return;
    (label as any).setProperties?.({ text });
  }

  private clearCountdownTimers(): void {
    for (const t of this.countdownTimers) clearTimeout(t);
    this.countdownTimers = [];
  }

  private clearInstructionPanelTimers(): void {
    if (this.instructionHideTimer !== null) {
      clearTimeout(this.instructionHideTimer);
      this.instructionHideTimer = null;
    }
    if (this.instructionTransitionTimer !== null) {
      clearTimeout(this.instructionTransitionTimer);
      this.instructionTransitionTimer = null;
    }
  }
}

