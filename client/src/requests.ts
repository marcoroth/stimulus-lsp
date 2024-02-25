import type { Position, TextDocument } from "vscode"

export type ControllerDefinition = {
  identifier: string
  path: string
  registered: boolean
  position: Position
}

export interface ControllerDefinitionsOrigin {
  name: string,
  controllerDefinitions: ControllerDefinition[]
}

export interface ProjectControllerDefinitions extends ControllerDefinitionsOrigin {
  name: "project",
}

export type ControllerDefinitionsRequest = object
export type ControllerDefinitionsResponse = {
  registered: ProjectControllerDefinitions
  unregistered: {
    project: ProjectControllerDefinitions,
    nodeModules: ControllerDefinitionsOrigin[]
  }
}

type InlayHint = {
  text: string
  tooltip: string
  position: Position
}

export type InlayHintsRequest = {
  document: TextDocument
}

export type InlayHintsResponse = InlayHint[]
