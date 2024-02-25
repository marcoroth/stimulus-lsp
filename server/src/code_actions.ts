import { CodeAction, CodeActionKind, CodeActionParams, Command } from "vscode-languageserver/node"

import { DocumentService } from "./document_service"
import { InvalidControllerDiagnosticData } from "./diagnostics"

import { Project } from "stimulus-parser"

export class CodeActions {
  private readonly documentService: DocumentService
  private readonly project: Project

  constructor(documentService: DocumentService, project: Project) {
    this.documentService = documentService
    this.project = project
  }

  onCodeAction(params: CodeActionParams) {
    const textDocument = this.documentService.get(params.textDocument.uri)

    if (textDocument === undefined) return undefined
    if (params.context.diagnostics.length === 0) return undefined

    const diagnostics = params.context.diagnostics.filter(
      (diagnostic) => diagnostic.code === "stimulus.controller.invalid",
    )

    if (diagnostics.length === 0) return undefined

    return diagnostics.flatMap((diagnostic) => {
      const { identifier, suggestion } = diagnostic.data as InvalidControllerDiagnosticData

      const controllerRootsInProject = this.project.controllerRoots.filter(
        (project) => !project.includes("node_modules"),
      )
      const manyRoots = controllerRootsInProject.length > 1
      if (controllerRootsInProject.length === 0) controllerRootsInProject.push(this.project.controllerRootFallback)

      const updateTitle = `Replace "${identifier}" with suggestion: "${suggestion}"`
      const updateReferenceAction = CodeAction.create(
        updateTitle,
        Command.create(updateTitle, "stimulus.controller.update", identifier, diagnostic, suggestion),
        CodeActionKind.QuickFix,
      )

      return [
        updateReferenceAction,
        ...controllerRootsInProject.map((root) => {
          const folder = `${manyRoots ? ` in "${root}/"` : ""}`
          const title = `Create "${identifier}" Stimulus Controller${folder}`

          return CodeAction.create(
            title,
            Command.create(title, "stimulus.controller.create", identifier, diagnostic, root),
            CodeActionKind.QuickFix,
          )
        }),
      ]
    })
  }
}
