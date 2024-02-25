import { CodeLens, CodeLensParams, Range, Command } from "vscode-languageserver/node"

import { DocumentService } from "./document_service"

import type { Project } from "stimulus-parser"

export class CodeLensProvider {
  private readonly documentService: DocumentService
  private readonly project: Project

  constructor(documentService: DocumentService, project: Project) {
    this.documentService = documentService
    this.project = project
  }

  onCodeLens(params: CodeLensParams) {
    const textDocument = this.documentService.get(params.textDocument.uri)

    if (!textDocument) return []

    const file = this.project.projectFiles.find((file) => `file://${file.path}` === textDocument.uri)

    if (!file) return []
    if (file.controllerDefinitions.length === 0) return []

    return file.controllerDefinitions.flatMap((definition) => {
      const loc = definition.classDeclaration.node?.loc

      if (!loc) return []

      const registeredController = this.project.registeredControllers.find(
        (registered) => registered.controllerDefinition === definition,
      )

      const range = Range.create(loc.start.line - 1, loc.start.column, loc.end.line - 1, loc.start.column)

      if (registeredController) {
        return [
          CodeLens.create(range, {
            filePath: file.path,
            registered: true,
            identifier: registeredController.identifier,
          }),
        ]
      } else {
        return [
          CodeLens.create(range, {
            filePath: file.path,
            registered: false,
            identifier: definition.guessedIdentifier,
          }),
        ]
      }
    })
  }

  onCodeLensResolve(codeLens: CodeLens) {
    const identifier = codeLens.data?.identifier
    const registered = codeLens.data?.registered
    const file = this.project.projectFiles.find((file) => file.path === codeLens.data?.filePath)

    if (!file) return codeLens
    if (file.controllerDefinitions.length === 0) return codeLens

    const registeredController = this.project.registeredControllers.find(
      (definition) => definition.identifier === identifier,
    )

    if (registered && registeredController) {
      codeLens.command = Command.create(
        `Stimulus: Connects to data-controller="${registeredController.identifier}"`,
        "",
      )
    } else {
      codeLens.command = Command.create(
        `Stimulus: The "${identifier}" controller isn't registered on your Stimulus Application`,
        "",
      )
    }

    return codeLens
  }
}
