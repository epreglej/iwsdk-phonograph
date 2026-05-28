import {
  createSystem,
  Entity,
  eq,
  FollowBehavior,
  Follower,
  PanelDocument,
  PanelUI,
  UIKitDocument,
} from "@iwsdk/core";
import { ActiveTask, CompletedTask, Task } from "../components/task.js";
import { Phonograph } from "../components/phonograph.js";
import { Billboard } from "../components/billboard.js";
import { clearCountdownTimers, runCountdownSequence } from "../ui/countdown.js";
import { hidePanelWithPopOut, revealPanel } from "../ui/panel-lifecycle.js";
import { setPanelElementText } from "../ui/panel-text.js";
import { RecordingArmed } from "../components/recording-armed.js";
import { firstEntity } from "../helpers/entity-query.js";
import { createSpatialPanel } from "../ui/spatial-panel.js";

const COUNTDOWN_PANEL_CONFIG = "./ui/instruction-countdown.json";

export class RecordingCountdownSystem extends createSystem({
  recordingCountdown: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask, RecordingArmed],
    where: [eq(Task, "id", "recording")],
  },
  phonograph: { required: [Phonograph] },
  countdownPanel: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, "config", COUNTDOWN_PANEL_CONFIG)],
  },
}) {
  private countdownPanelEntity!: Entity;
  private countdownDoc: UIKitDocument | null = null;
  private pendingCountdownText: string | null = null;
  private displayedCountdownText: string | null = null;
  private countdownWanted = false;
  private sequenceToken = 0;
  private countdownTimers: ReturnType<typeof setTimeout>[] = [];
  private countdownHideTimer: ReturnType<typeof setTimeout> | null = null;

  init() {
    this.countdownPanelEntity = createSpatialPanel(this.world, {
      config: COUNTDOWN_PANEL_CONFIG,
      maxWidth: 0.35,
    });

    this.cleanupFuncs.push(
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

      this.queries.recordingCountdown.subscribe("qualify", (taskEntity) => {
        const phonographEntity = firstEntity(this.queries.phonograph.entities);
        if (!phonographEntity) return;
        this.playRecordingCountdown(taskEntity, phonographEntity);
      }),

      this.queries.recordingCountdown.subscribe("disqualify", () => {
        this.cancelCountdown();
      }),
    );
  }

  private cancelCountdown(): void {
    this.sequenceToken += 1;
    clearCountdownTimers(this.countdownTimers);
    this.countdownTimers = [];
    this.hideCountdownPanel();
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
    if (this.countdownPanelEntity.object3D!.visible) return;
    revealPanel(this.countdownPanelEntity);
  }

  private hideCountdownPanel(): void {
    this.countdownWanted = false;

    if (this.countdownHideTimer !== null) {
      clearTimeout(this.countdownHideTimer);
      this.countdownHideTimer = null;
    }

    this.countdownHideTimer = hidePanelWithPopOut(
      this.countdownPanelEntity,
      () => {
        this.displayedCountdownText = null;
        this.countdownHideTimer = null;
        if (this.countdownPanelEntity.active) {
          this.countdownPanelEntity
            .removeComponent(Follower)
            .removeComponent(Billboard);
        }
      },
    );
  }

  private playRecordingCountdown(
    taskEntity: Entity,
    phonographEntity: Entity,
  ): void {
    const token = ++this.sequenceToken;
    clearCountdownTimers(this.countdownTimers);

    this.showCountdownPanel(phonographEntity);

    this.countdownTimers = runCountdownSequence({
      steps: ["3", "2", "1"],
      stepMs: 1000,
      isCancelled: () => token !== this.sequenceToken,
      onStep: (text) => this.setCountdown(text),
      onComplete: () => {
        if (token !== this.sequenceToken) return;
        this.setCountdown("Speak!");
        if (!taskEntity.hasComponent(RecordingArmed)) {
          taskEntity.addComponent(RecordingArmed);
        }
      },
    });
  }

  private setCountdown(text: string): void {
    if (text === this.displayedCountdownText) return;

    if (!this.countdownDoc) {
      this.pendingCountdownText = text;
      return;
    }

    setPanelElementText(this.countdownDoc, "countdown-text", text);
    this.displayedCountdownText = text;
  }
}
