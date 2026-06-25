import {
  createComponent,
  createSystem,
  Entity,
  PanelDocument,
  PanelUI,
  Types,
  UIKit,
  UIKitDocument,
} from "@iwsdk/core";

export const TYPEWRITER_MS_PER_CHAR = 52;
export const TYPEWRITER_SEGMENT_PAUSE_MS = 100;

const TYPEWRITER_BODY_CLASSES = new Set([
  "placard-text",
  "rec-body",
  "subtitle",
]);

export const TypewriterDone = createComponent("TypewriterDone", {});

export const TypewriterActive = createComponent("TypewriterActive", {
  segmentIndex: { type: Types.Float32, default: 0 },
  charIndex: { type: Types.Float32, default: 0 },
  pauseRemainingMs: { type: Types.Float32, default: 0 },
  charElapsedMs: { type: Types.Float32, default: 0 },
});

interface TextSegment {
  textNode: UIKit.Component<any>;
  parent: UIKit.Component<any>;
  fullText: string;
}

export class TypewriterSystem extends createSystem({
  pending: {
    required: [PanelUI, PanelDocument],
    excluded: [TypewriterDone, TypewriterActive],
  },
  active: { required: [TypewriterActive] },
}) {
  private segmentsByEntity = new WeakMap<Entity, TextSegment[]>();

  init() {
    this.cleanupFuncs.push(
      this.queries.pending.subscribe("qualify", (entity) => {
        this.beginTypewriter(entity);
      }),
      this.queries.active.subscribe("disqualify", (entity) => {
        this.segmentsByEntity.delete(entity);
      }),
    );
  }

  update(delta: number) {
    const dtMs = delta * 1000;

    for (const entity of this.queries.active.entities) {
      const segments = this.segmentsByEntity.get(entity);
      if (!segments?.length) {
        this.finish(entity);
        continue;
      }

      let segmentIndex = entity.getValue(TypewriterActive, "segmentIndex") ?? 0;
      let charIndex = entity.getValue(TypewriterActive, "charIndex") ?? 0;
      let pauseRemaining = entity.getValue(TypewriterActive, "pauseRemainingMs") ?? 0;
      let charElapsed = (entity.getValue(TypewriterActive, "charElapsedMs") ?? 0) + dtMs;

      if (pauseRemaining > 0) {
        entity.setValue(
          TypewriterActive,
          "pauseRemainingMs",
          Math.max(0, pauseRemaining - dtMs),
        );
        continue;
      }

      while (charElapsed >= TYPEWRITER_MS_PER_CHAR) {
        charElapsed -= TYPEWRITER_MS_PER_CHAR;

        if (segmentIndex >= segments.length) break;

        const segment = segments[segmentIndex]!;
        charIndex++;

        if (charIndex <= segment.fullText.length) {
          this.setSegmentText(segment, segment.fullText.slice(0, charIndex));
        }

        if (charIndex >= segment.fullText.length) {
          this.setSegmentText(segment, segment.fullText);
          segmentIndex++;
          charIndex = 0;
          pauseRemaining =
            segmentIndex < segments.length ? TYPEWRITER_SEGMENT_PAUSE_MS : 0;
          break;
        }

        // Safety cap — never process more than a few characters per frame.
        if (charIndex % 4 === 0) break;
      }

      entity.setValue(TypewriterActive, "segmentIndex", segmentIndex);
      entity.setValue(TypewriterActive, "charIndex", charIndex);
      entity.setValue(TypewriterActive, "charElapsedMs", charElapsed);
      entity.setValue(TypewriterActive, "pauseRemainingMs", pauseRemaining);

      if (segmentIndex >= segments.length) {
        this.finish(entity);
      }
    }
  }

  private beginTypewriter(entity: Entity): void {
    if (!entity.active) return;

    const doc = entity.getValue(PanelDocument, "document") as UIKitDocument | null;
    if (!doc) return;

    const root = doc.getElementById("panel-root") as UIKit.Component<any> | undefined;
    if (root?.classList.contains("menu-card")) {
      entity.addComponent(TypewriterDone);
      return;
    }
    if (
      root?.classList.contains("narration-card") &&
      !root.classList.contains("narration-typewriter")
    ) {
      entity.addComponent(TypewriterDone);
      return;
    }
    if (root?.classList.contains("placard")) {
      entity.addComponent(TypewriterDone);
      return;
    }

    const segments: TextSegment[] = [];
    this.collectTextNodes(doc.rootElement, segments);

    if (segments.length === 0) {
      entity.addComponent(TypewriterDone);
      return;
    }

    for (const segment of segments) {
      segment.fullText = this.readText(segment);
      this.setSegmentText(segment, "");
    }

    this.segmentsByEntity.set(entity, segments);
    entity.addComponent(TypewriterActive);
  }

  private collectTextNodes(node: UIKit.Component<any>, out: TextSegment[]): void {
    if (node instanceof UIKit.Text) {
      const parent = node.parentContainer.peek();
      if (
        parent &&
        this.hasTypewriterClass(parent, TYPEWRITER_BODY_CLASSES) &&
        !this.hasElementChildren(parent)
      ) {
        out.push({ textNode: node, parent, fullText: "" });
      }
      return;
    }

    for (const child of node.children) {
      if (child instanceof UIKit.Component) {
        this.collectTextNodes(child as UIKit.Component<any>, out);
      }
    }
  }

  private hasElementChildren(node: UIKit.Component<any>): boolean {
    for (const child of node.children) {
      if (child instanceof UIKit.Component && !(child instanceof UIKit.Text)) {
        return true;
      }
    }
    return false;
  }

  private hasTypewriterClass(
    parent: UIKit.Component<any>,
    classes: Set<string>,
  ): boolean {
    for (const className of classes) {
      if (parent.classList.contains(className)) return true;
    }
    return false;
  }

  private readText(segment: TextSegment): string {
    const value = segment.textNode.properties.peek().text;
    if (value == null) return "";
    return String(value);
  }

  /** UIKitML text nodes read `parent.text` with a markup fallback — drive the parent. */
  private setSegmentText(segment: TextSegment, text: string): void {
    segment.parent.setProperties({ text });
  }

  private finish(entity: Entity): void {
    const segments = this.segmentsByEntity.get(entity);
    if (segments) {
      for (const segment of segments) {
        this.setSegmentText(segment, segment.fullText);
      }
    }

    // Mark done before removing active so we never re-enter beginTypewriter.
    entity.addComponent(TypewriterDone);
    entity.removeComponent(TypewriterActive);
    this.segmentsByEntity.delete(entity);
  }
}
