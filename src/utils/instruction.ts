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

const INSTRUCTION_PANEL_CONFIG = "./ui/task-instruction.json";
const COUNTDOWN_PANEL_CONFIG = "./ui/instruction-countdown.json";

/** Added to the active "recording" task after countdown completes. */
export const RecordingArmed = createComponent("RecordingArmed", {});

export class InstructionSystem extends createSystem({
  activeTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
  },
  phonograph: { required: [Phonograph] },
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

  private sequenceToken = 0;
  private countdownTimers: ReturnType<typeof setTimeout>[] = [];

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
        this.instructionDoc = entity.getValue(PanelDocument, "document") as UIKitDocument;
        if (this.pendingInstructionText !== null) {
          this.applyInstructionText(this.pendingInstructionText);
          this.pendingInstructionText = null;
        }
      }),

      this.queries.instructionPanel.subscribe("disqualify", () => {
        this.instructionDoc = null;
      }),

      this.queries.countdownPanel.subscribe("qualify", (entity) => {
        this.countdownDoc = entity.getValue(PanelDocument, "document") as UIKitDocument;
        if (this.pendingCountdownText !== null) {
          this.applyCountdownText(this.pendingCountdownText);
          this.pendingCountdownText = null;
        }
      }),

      this.queries.countdownPanel.subscribe("disqualify", () => {
        this.countdownDoc = null;
      }),

      this.queries.activeTask.subscribe("qualify", (taskEntity) => {
        const taskId = taskEntity.getValue(Task, "id")!;
        this.sequenceToken += 1;
        this.clearCountdownTimers();

        this.hideCountdownPanel();

        if (this.shouldShowInstruction(taskId)) {
          this.showInstructionPanel(phonographEntity);
        } else {
          this.hideInstructionPanel();
        }

        this.handleTaskInstruction(taskEntity, taskId, this.sequenceToken);
      }),
    );
  }

  private shouldShowInstruction(taskId: string): boolean {
    return !taskId.startsWith("introduction_") && taskId !== "done";
  }

  private showInstructionPanel(phonographEntity: Entity): void {
    this.instructionPanelEntity
      .addComponent(Follower, {
        behavior: FollowBehavior.NoRotation,
        target: phonographEntity.object3D!,
        offsetPosition: [0, 0.45, 0],
      })
      .addComponent(Billboard);

    if (!this.instructionPanelEntity.object3D!.visible) {
      this.instructionPanelEntity.object3D!.visible = true;
      this.instructionPanelEntity.addComponent(PopIn2D);
    }
  }

  private hideInstructionPanel(): void {
    if (!this.instructionPanelEntity.object3D!.visible) return;
    this.instructionPanelEntity.removeComponent(PopIn2D).addComponent(PopOut2D);
    setTimeout(() => {
      if (this.instructionPanelEntity.active) {
        this.instructionPanelEntity.object3D!.visible = false;
      }
    }, 560);
  }

  private showCountdownPanel(phonographEntity: Entity): void {
    this.countdownPanelEntity
      .addComponent(Follower, {
        behavior: FollowBehavior.NoRotation,
        target: phonographEntity.object3D!,
        offsetPosition: [0, 0.63, 0],
      })
      .addComponent(Billboard);

    if (!this.countdownPanelEntity.object3D!.visible) {
      this.countdownPanelEntity.object3D!.visible = true;
      this.countdownPanelEntity.addComponent(PopIn2D);
    }
  }

  private hideCountdownPanel(): void {
    if (!this.countdownPanelEntity.object3D!.visible) return;
    this.countdownPanelEntity.removeComponent(PopIn2D).addComponent(PopOut2D);
    setTimeout(() => {
      if (this.countdownPanelEntity.active) {
        this.countdownPanelEntity.object3D!.visible = false;
      }
    }, 560);
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
      this.playRecordingCountdown(taskEntity, token);
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

    this.setInstruction(
      "The phonograph is about to begin recording. Stand close, take a breath, and get ready to speak clearly into the horn when the countdown ends.",
    );
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
      this.setInstruction("Speak into the horn.");
      if (!taskEntity.hasComponent(RecordingArmed)) {
        taskEntity.addComponent(RecordingArmed);
      }
    }, countdown.length * 1000);
    this.countdownTimers.push(doneTimer);
  }

  private setInstruction(text: string): void {
    if (!this.instructionDoc) {
      this.pendingInstructionText = text;
      return;
    }
    this.applyInstructionText(text);
  }

  private setCountdown(text: string): void {
    if (!this.countdownDoc) {
      this.pendingCountdownText = text;
      return;
    }
    this.applyCountdownText(text);
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
}

