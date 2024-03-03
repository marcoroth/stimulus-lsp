import { CodeAction, CodeActionKind, CodeActionParams, Command, Diagnostic } from "vscode-languageserver/node"

import { DocumentService } from "./document_service"
import { InvalidActionDiagnosticData, InvalidControllerDiagnosticData } from "./diagnostics"
import {
  importStatementFromExportDeclaration,
  relativeControllersFilePath,
  importStatementForController,
} from "./utils"

import { Project } from "stimulus-parser"

export class CodeActions {
  private readonly documentService: DocumentService
  private readonly project: Project

  constructor(documentService: DocumentService, project: Project) {
    this.documentService = documentService
    this.project = project
  }

  onCodeAction(params: CodeActionParams): CodeAction[] {
    const { diagnostics } = params.context
    if (diagnostics.length === 0) return []

    const textDocument = this.documentService.get(params.textDocument.uri)
    if (textDocument === undefined) return []

    const invalidControllerDiagnostics = diagnostics.filter((d) => d.code === "stimulus.controller.invalid")
    const invalidActionDiagnostics = diagnostics.filter((d) => d.code === "stimulus.controller.action.invalid")

    return [
      ...this.handleInvalidControllerDiagnostics(invalidControllerDiagnostics),
      ...this.handleInvalidActionDiagnostics(invalidActionDiagnostics),
    ]
  }

  private handleInvalidControllerDiagnostics(diagnostics: Diagnostic[]) {
    return diagnostics.flatMap((diagnostic) => {
      const codeActions: CodeAction[] = []
      const { identifier, suggestion } = diagnostic.data as InvalidControllerDiagnosticData

      // Code Action: stimulus.controller.update

      if (suggestion) {
        const updateTitle = `Replace "${identifier}" with suggestion: "${suggestion}"`
        const updateReferenceAction = CodeAction.create(
          updateTitle,
          Command.create(updateTitle, "stimulus.controller.update", identifier, diagnostic, suggestion),
          CodeActionKind.QuickFix,
        )

        codeActions.push(updateReferenceAction)
      }

      // Code Action: stimulus.controller.register

      if (identifier) {
        const projectControllers = this.project.projectFiles.flatMap((file) => file.exportedControllerDefinitions)

        const entrypointExports = this.project.detectedNodeModules.flatMap(
          (m) => m.entrypointSourceFile?.exportDeclarations || [],
        )
        const nodeModulesControllers = entrypointExports.flatMap((exportDeclaration) => {
          try {
            return exportDeclaration.nextResolvedClassDeclaration?.controllerDefinition || []
          } catch (error: any) {
            return []
          }
        })

        const controllers = projectControllers
          .concat(nodeModulesControllers)
          .filter((controller) => controller.guessedIdentifier === identifier)

        controllers.forEach((controller) => {
          const { localName, importStatement, importSource } = importStatementForController(controller, this.project)

          if (importStatement) {
            const registerTitle = `Register controller "${identifier}" from "${importSource}"`

            codeActions.push(
              CodeAction.create(
                registerTitle,
                Command.create(registerTitle, "stimulus.controller.register", importStatement, identifier, localName),
                CodeActionKind.QuickFix,
              ),
            )
          }
        })
      }

      // Code Action: stimulus.controller.create

      const controllerRootsInProject = this.project.controllerRoots.filter(
        (project) => !project.includes("node_modules"),
      )

      const manyRoots = controllerRootsInProject.length > 1

      if (controllerRootsInProject.length === 0) controllerRootsInProject.push(this.project.controllerRootFallback)

      const createControllerActions = controllerRootsInProject.map((root) => {
        const folder = `${manyRoots ? ` in "${root}/"` : ""}`
        const title = `Create "${identifier}" Stimulus Controller${folder}`

        return CodeAction.create(
          title,
          Command.create(title, "stimulus.controller.create", identifier, diagnostic, root),
          CodeActionKind.QuickFix,
        )
      })

      codeActions.push(...createControllerActions)

      return codeActions
    })
  }

  private handleInvalidActionDiagnostics(diagnostics: Diagnostic[]) {
    return diagnostics.flatMap((diagnostic) => {
      const { actionName, suggestion, identifier } = diagnostic.data as InvalidActionDiagnosticData

      const updateTitle = `Replace "${actionName}" with suggestion: "${suggestion}"`

      const updateReferenceAction = CodeAction.create(
        updateTitle,
        Command.create(updateTitle, "stimulus.controller.action.update", actionName, diagnostic, suggestion),
        CodeActionKind.QuickFix,
      )

      const implementTitle = `Implement "${actionName}" action on "${identifier}" controller`

      const implementControllerAction = CodeAction.create(
        implementTitle,
        Command.create(implementTitle, "stimulus.controller.action.implement", actionName, identifier, diagnostic),
        CodeActionKind.QuickFix,
      )

      return [updateReferenceAction, implementControllerAction]
    })
  }
}
