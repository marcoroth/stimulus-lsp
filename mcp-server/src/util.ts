import type { ControllerDefinition } from "stimulus-parser"

export function formatController(controllerDefinition: ControllerDefinition): string {
  return [
    `Guessed Controller Identifier: ${controllerDefinition.guessedIdentifier}`,
    `File Path: ${controllerDefinition.path || "Unknown"}`,
    `Target Names: ${controllerDefinition.targetNames.join(", ") || "[]"}`,
    `Action Names: ${controllerDefinition.actionNames.join(", ") || "[]"}`,
    `Value Names: ${controllerDefinition.valueNames.join(", ") || "[]"}`,
    "---",
  ].join("\n")
}
