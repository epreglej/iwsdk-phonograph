// import {
//   createSystem,
//   eq,
//   Entity,
//   createComponent,
//   OneHandGrabbable,
// } from "@iwsdk/core";
// import { Task, ActiveTask, CompletedTask } from "../task.js";
// import { Highlight } from "../utils/highlight.js";
// import {
//   InSnapZone,
//   Snappable,
//   SnapGhost,
//   Snapped,
//   TrackSnapZone,
// } from "../utils/snap.js";
// import { ForceRelease, Grabbed } from "../utils/grab.js";
// import { Unmounting } from "../utils/unmounting.js";
// import { PopIn, PopOut } from "../animations/animation.js";

// export const RecordingTrumpet = createComponent("RecordingTrumpet", {});
// export const PlaybackTrumpet = createComponent("PlaybackTrumpet", {});

// export class TrumpetSystem extends createSystem({
//   activeRecordingTrumpetDescriptionTask: {
//     required: [Task, ActiveTask],
//     excluded: [CompletedTask],
//     where: [eq(Task, "id", "recording_trumpet_description")],
//   },
//   activeRecordingTrumpetSnapTask: {
//     required: [Task, ActiveTask],
//     excluded: [CompletedTask],
//     where: [eq(Task, "id", "recording_trumpet_mount")],
//   },
//   activeRecordingTrumpetUnmountTask: {
//     required: [Task, ActiveTask],
//     excluded: [CompletedTask],
//     where: [eq(Task, "id", "recording_trumpet_unmount")],
//   },
//   activePlaybackTrumpetMountTask: {
//     required: [Task, ActiveTask],
//     excluded: [CompletedTask],
//     where: [eq(Task, "id", "playback_trumpet_mount")],
//   },
//   recordingTrumpet: { required: [RecordingTrumpet] },
//   snappedRecordingTrumpet: { required: [RecordingTrumpet, Snapped] },
//   recordingTrumpetLeftSnapZoneWhileUnmounting: {
//     required: [RecordingTrumpet, Unmounting, Snappable, Grabbed],
//     excluded: [Snapped, InSnapZone],
//   },
//   recordingTrumpetReleasedWhileUnmounting: {
//     required: [RecordingTrumpet, Unmounting],
//     excluded: [Snapped, Grabbed],
//   },
//   recordingTrumpetUnmountPopOut: {
//     required: [RecordingTrumpet, Unmounting, PopOut],
//   },
//   playbackTrumpet: { required: [PlaybackTrumpet] },
//   snappedPlaybackTrumpet: { required: [PlaybackTrumpet, Snapped] },
// }) {
//   init() {
//     const [recordingTrumpet] = this.queries.recordingTrumpet.entities;
//     const [playbackTrumpet] = this.queries.playbackTrumpet.entities;

//     this.cleanupFuncs.push(
//       this.queries.activeRecordingTrumpetDescriptionTask.subscribe(
//         "qualify",
//         () => {
//           recordingTrumpet.addComponent(PopIn);
//           recordingTrumpet.object3D!.visible = true;
//         },
//       ),

//       this.queries.activeRecordingTrumpetSnapTask.subscribe("qualify", () => {
//         for (const entity of this.queries.recordingTrumpet.entities) {
//           entity
//             .addComponent(OneHandGrabbable)
//             .addComponent(Snappable, { snapPointId: "trumpet_snap_point" })
//             .addComponent(SnapGhost)
//             .addComponent(Highlight);
//         }
//       }),

//       this.queries.snappedRecordingTrumpet.subscribe("qualify", (entity) => {
//         entity.removeComponent(Highlight).removeComponent(SnapGhost);
//         for (const task of this.queries.activeRecordingTrumpetSnapTask
//           .entities) {
//           task.addComponent(CompletedTask);
//         }
//       }),

//       this.queries.activeRecordingTrumpetUnmountTask.subscribe(
//         "qualify",
//         () => {
//           recordingTrumpet.object3D!.visible = true;
//           recordingTrumpet
//             .addComponent(Unmounting)
//             .addComponent(TrackSnapZone)
//             .addComponent(OneHandGrabbable)
//             .addComponent(Highlight);
//         },
//       ),

//       this.queries.activeRecordingTrumpetUnmountTask.subscribe(
//         "disqualify",
//         () => {
//           recordingTrumpet.removeComponent(Unmounting).removeComponent(
//             TrackSnapZone,
//           );
//         },
//       ),

//       this.queries.recordingTrumpetLeftSnapZoneWhileUnmounting.subscribe(
//         "qualify",
//         () => {
//           this.finishUnmount(recordingTrumpet);
//         },
//       ),

//       this.queries.recordingTrumpetReleasedWhileUnmounting.subscribe(
//         "qualify",
//         () => {
//           this.finishUnmount(recordingTrumpet);
//         },
//       ),

//       this.queries.recordingTrumpetUnmountPopOut.subscribe(
//         "disqualify",
//         (entity) => {
//           this.completeUnmount(entity);
//         },
//       ),

//       this.queries.activePlaybackTrumpetMountTask.subscribe("qualify", () => {
//         playbackTrumpet.object3D!.visible = true;
//         playbackTrumpet
//           .addComponent(PopIn)
//           .addComponent(OneHandGrabbable)
//           .addComponent(Snappable, { snapPointId: "trumpet_snap_point" })
//           .addComponent(SnapGhost)
//           .addComponent(Highlight);
//       }),

//       this.queries.snappedPlaybackTrumpet.subscribe("qualify", (entity) => {
//         entity.removeComponent(Highlight).removeComponent(SnapGhost);
//         for (const task of this.queries.activePlaybackTrumpetMountTask
//           .entities) {
//           task.addComponent(CompletedTask);
//         }
//       }),
//     );
//   }

//   private finishUnmount(recordingTrumpet: Entity) {
//     if (!recordingTrumpet.hasComponent(Unmounting)) return;
//     if (recordingTrumpet.hasComponent(PopOut)) return;

//     recordingTrumpet
//       .removeComponent(Highlight)
//       .removeComponent(TrackSnapZone)
//       .removeComponent(Snappable)
//       .removeComponent(InSnapZone)
//       .addComponent(PopOut);
//   }

//   private completeUnmount(recordingTrumpet: Entity) {
//     recordingTrumpet
//       .addComponent(ForceRelease)
//       .removeComponent(OneHandGrabbable)
//       .removeComponent(Unmounting);

//     const obj = recordingTrumpet.object3D;
//     if (obj) {
//       obj.scale.setScalar(0.001);
//       obj.visible = false;
//     }

//     for (const task of this.queries.activeRecordingTrumpetUnmountTask
//       .entities) {
//       task.addComponent(CompletedTask);
//     }
//   }
// }
