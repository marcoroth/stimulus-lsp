import { Position } from "vscode-languageserver/node"
import { RegisteredController, ControllerDefinition, ClassDeclarationNode } from "stimulus-parser"

import { Service } from "../service"

import type {
  ControllerDefinition as ControllerDefinitionRequestType,
  ControllerDefinitionsRequest as ControllerDefinitionsRequestType,
  ControllerDefinitionsResponse,
} from "../requests"

export class ControllerDefinitionsRequest {
  private service: Service

  constructor(service: Service) {
    this.service = service
  }

  async handleRequest(_request: ControllerDefinitionsRequestType): Promise<ControllerDefinitionsResponse> {
    return {
      registered: {
        name: "project",
        controllerDefinitions: this.registeredControllers,
      },
      unregistered: {
        project: {
          name: "project",
          controllerDefinitions: this.unregisteredControllers,
        },
        nodeModules: this.nodeModuleControllers,
      },
    }
  }

  private controllerSort(a: ControllerDefinitionRequestType, b: ControllerDefinitionRequestType) {
    return a.identifier.localeCompare(b.identifier)
  }

  private positionFromNode(node: ClassDeclarationNode | undefined) {
    return Position.create(node?.loc?.start?.line || 1, node?.loc?.start?.column || 1)
  }

  private mapControllerDefinition = (controllerDefinition: ControllerDefinition) => {
    const { path, guessedIdentifier: identifier, classDeclaration } = controllerDefinition

    const registered = false
    const position = this.positionFromNode(classDeclaration.node)

    return {
      path,
      identifier,
      position,
      registered,
    }
  }

  private mapRegisteredController = (registeredController: RegisteredController) => {
    const { path, identifier, classDeclaration } = registeredController

    const registered = true
    const position = this.positionFromNode(classDeclaration.node)

    return {
      path,
      identifier,
      position,
      registered,
    }
  }

  private get registeredControllerPaths() {
    return this.service.project.registeredControllers.map((c) => c.path)
  }

  private get unregisteredControllerDefinitions() {
    return this.service.project.controllerDefinitions.filter(
      (definition) => !this.registeredControllerPaths.includes(definition.path),
    )
  }

  private get detectedNodeModules() {
    return this.service.project.detectedNodeModules
  }

  private get registeredControllers() {
    return this.service.project.registeredControllers.map(this.mapRegisteredController).sort(this.controllerSort)
  }

  private get unregisteredControllers() {
    return this.unregisteredControllerDefinitions.map(this.mapControllerDefinition).sort(this.controllerSort)
  }

  private get nodeModuleControllers() {
    const nodeModules = this.detectedNodeModules.map((detectedModule) => {
      const { name } = detectedModule

      const controllerDefinitions = detectedModule.controllerDefinitions
        .filter((definition) => !this.registeredControllerPaths.includes(definition.path))
        .map(this.mapControllerDefinition)
        .sort(this.controllerSort)

      return { name, controllerDefinitions }
    })

    return nodeModules.filter((m) => m.controllerDefinitions.length > 0).sort((a, b) => a.name.localeCompare(b.name))
  }
}
