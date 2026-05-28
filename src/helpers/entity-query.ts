import type { Entity } from "@iwsdk/core";

export function firstEntity(entities: Iterable<Entity>): Entity | undefined {
  for (const entity of entities) {
    return entity;
  }
  return undefined;
}
