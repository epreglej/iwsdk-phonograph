import type { Entity } from "@iwsdk/core";
import { PhonographPart } from "../components/phonograph-part.js";

export function getPart(
  parts: Iterable<Entity>,
  id: string,
): Entity | undefined {
  for (const part of parts) {
    if (part.getValue(PhonographPart, "id") === id) return part;
  }
  return undefined;
}
