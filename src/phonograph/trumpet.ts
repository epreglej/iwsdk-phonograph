import {
  createSystem,
  eq,
  Entity,
  createComponent,
  Grabbed,
  OneHandGrabbable,
} from "@iwsdk/core";
import { Task, ActiveTask, CompletedTask } from "../task.js";
import { Highlight } from "../utils/highlight.js";
import { Snappable, SnapGhost, Snapped } from "../utils/snap.js";
import {
  Unmounting,
  UnmountPopping,
  UNMOUNT_HIGHLIGHT_COLOR,
} from "../utils/unmounting.js";
import { forceReleaseGrab } from "../utils/grab-release.js";
import { PopIn, PopOut, SnapAnimation } from "../animations/animation.js";
import { playPop } from "../audio/sfx.js";
import { addPlacardTarget } from "../utils/object-placard.js";

export const RecordingTrumpet = createComponent("RecordingTrumpet", {});
export const PlaybackTrumpet = createComponent("PlaybackTrumpet", {});

export class TrumpetSystem extends createSystem({
  activeRecordingTrumpetSnapTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "recording_trumpet_mount")],
  },
  activeRecordingTrumpetUnmountTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "recording_trumpet_unmount")],
  },
  activePlaybackTrumpetMountTask: {
    required: [Task, ActiveTask],
    excluded: [CompletedTask],
    where: [eq(Task, "id", "playback_trumpet_mount")],
  },
  recordingTrumpet: { required: [RecordingTrumpet] },
  snappedRecordingTrumpet: { required: [RecordingTrumpet, Snapped] },
  recordingTrumpetGrabbedWhileUnmounting: {
    required: [RecordingTrumpet, Unmounting, Grabbed],
    excluded: [PopOut, UnmountPopping],
  },
  recordingTrumpetUnmountPopOut: {
    required: [RecordingTrumpet, Unmounting, PopOut],
  },
  playbackTrumpet: { required: [PlaybackTrumpet] },
  snappedPlaybackTrumpet: { required: [PlaybackTrumpet, Snapped] },
}) {
  init() {
    const [recordingTrumpet] = this.queries.recordingTrumpet.entities;
    const [playbackTrumpet] = this.queries.playbackTrumpet.entities;

    this.cleanupFuncs.push(
      this.queries.activeRecordingTrumpetSnapTask.subscribe("qualify", () => {
        recordingTrumpet.object3D!.visible = true;
        recordingTrumpet.addComponent(PopIn);
        recordingTrumpet
          .addComponent(OneHandGrabbable)
          .addComponent(Snappable, { snapPointId: "trumpet_snap_point" })
          .addComponent(SnapGhost)
          .addComponent(Highlight);
        addPlacardTarget(recordingTrumpet, {
          panelConfig: "./ui/recording-trumpet-mount-instruction.json",
        });
      }),

      this.queries.snappedRecordingTrumpet.subscribe("qualify", (entity) => {
        entity.removeComponent(Highlight).removeComponent(SnapGhost);
        for (const task of this.queries.activeRecordingTrumpetSnapTask
          .entities) {
          task.addComponent(CompletedTask);
        }
      }),

      this.queries.activeRecordingTrumpetUnmountTask.subscribe(
        "qualify",
        () => {
          recordingTrumpet.object3D!.visible = true;
          recordingTrumpet
            .addComponent(Unmounting)
            .removeComponent(SnapGhost)
            .removeComponent(Snappable)
            .addComponent(OneHandGrabbable)
            .addComponent(Highlight, { color: UNMOUNT_HIGHLIGHT_COLOR });
          addPlacardTarget(recordingTrumpet, {
            panelConfig: "./ui/recording-trumpet-unmount-instruction.json",
            dismissOnGrab: true,
            dismissOnSnap: false,
          });
        },
      ),

      this.queries.activeRecordingTrumpetUnmountTask.subscribe(
        "disqualify",
        () => {
          recordingTrumpet.removeComponent(Unmounting);
        },
      ),

      this.queries.recordingTrumpetGrabbedWhileUnmounting.subscribe(
        "qualify",
        (entity) => {
          this.finishUnmount(entity);
        },
      ),

      this.queries.recordingTrumpetUnmountPopOut.subscribe(
        "disqualify",
        (entity) => {
          this.completeUnmount(entity);
        },
      ),

      this.queries.activePlaybackTrumpetMountTask.subscribe("qualify", () => {
        playbackTrumpet.object3D!.visible = true;
        playbackTrumpet
          .addComponent(PopIn)
          .addComponent(OneHandGrabbable)
          .addComponent(Snappable, { snapPointId: "trumpet_snap_point" })
          .addComponent(SnapGhost)
          .addComponent(Highlight);
        addPlacardTarget(playbackTrumpet, {
          panelConfig: "./ui/playback-trumpet-mount-instruction.json",
        });
      }),

      this.queries.snappedPlaybackTrumpet.subscribe("qualify", (entity) => {
        entity.removeComponent(Highlight).removeComponent(SnapGhost);
        for (const task of this.queries.activePlaybackTrumpetMountTask
          .entities) {
          task.addComponent(CompletedTask);
        }
      }),
    );
  }

  private finishUnmount(recordingTrumpet: Entity) {
    if (!recordingTrumpet.hasComponent(Unmounting)) return;
    if (recordingTrumpet.hasComponent(UnmountPopping)) return;

    recordingTrumpet.addComponent(UnmountPopping);
    forceReleaseGrab(recordingTrumpet);

    recordingTrumpet
      .removeComponent(Highlight)
      .removeComponent(Snappable)
      .removeComponent(SnapGhost)
      .removeComponent(Snapped)
      .removeComponent(SnapAnimation)
      .addComponent(PopOut);

    playPop();
  }

  private completeUnmount(recordingTrumpet: Entity) {
    forceReleaseGrab(recordingTrumpet);
    recordingTrumpet
      .removeComponent(Unmounting)
      .removeComponent(UnmountPopping);

    const obj = recordingTrumpet.object3D;
    if (obj) {
      obj.scale.setScalar(0.001);
      obj.visible = false;
    }

    for (const task of this.queries.activeRecordingTrumpetUnmountTask
      .entities) {
      task.addComponent(CompletedTask);
    }
  }
}
