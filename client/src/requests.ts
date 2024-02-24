import { Position } from "vscode-languageclient"

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
