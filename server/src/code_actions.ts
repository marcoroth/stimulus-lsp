import path from "path"
import { CodeAction, CodeActionKind, CodeActionParams, Command, Diagnostic } from "vscode-languageserver/node"

import { DocumentService } from "./document_service"
import { InvalidActionDiagnosticData, InvalidControllerDiagnosticData } from "./diagnostics"
import { capitalize, camelize } from "./utils"

import { Project, ControllerDefinition, ExportDeclaration } from "stimulus-parser"

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
        const projectControllers = this.project.projectFiles
          .flatMap((file) => file.exportedControllerDefinitions)
          .filter((controller) => controller.guessedIdentifier === identifier)

        projectControllers.forEach((controller) => {
          const exportDeclaration = controller.classDeclaration.exportDeclaration

          if (!exportDeclaration) return
          if (!this.project.controllersFile) return

          // TODO: Account for importmaps
          const relativePath = path.relative(
            path.dirname(this.project.controllersFile.path),
            controller.sourceFile.path,
          )

          const importSource = relativePath.startsWith(".") ? relativePath : `./${relativePath}`

          const { localName, importStatement } = this.importStatementFromExportDeclaration(
            exportDeclaration,
            controller,
            importSource,
          )

          codeActions.push(
            this.registerControllerCodeActionFor(
              controller.guessedIdentifier,
              importSource,
              importStatement,
              localName,
            ),
          )
        })

        this.project.detectedNodeModules.forEach((nodeModule) => {
          const exportDeclarations = nodeModule.entrypointSourceFile?.exportDeclarations || []

          exportDeclarations.forEach((exportDeclaration) => {
            const controller = exportDeclaration.nextResolvedClassDeclaration?.controllerDefinition

            if (!controller) return
            if (controller.guessedIdentifier !== identifier) return

            const { localName, importStatement } = this.importStatementFromExportDeclaration(
              exportDeclaration,
              controller,
              nodeModule.name,
            )

            codeActions.push(
              this.registerControllerCodeActionFor(
                controller.guessedIdentifier,
                nodeModule.name,
                importStatement,
                localName,
              ),
            )
          })
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

  private importStatementFromExportDeclaration(
    exportDeclaration: ExportDeclaration,
    controller: ControllerDefinition,
    importSource: string,
  ) {
    const exportType = exportDeclaration?.type
    const localName =
      exportType === "default"
        ? controller.classDeclaration.className || capitalize(camelize(controller.guessedIdentifier))
        : exportDeclaration.exportedName || controller.guessedIdentifier
    const importSpecifier = exportType === "default" ? localName : `{ ${localName} }`

    const importStatement = `import ${importSpecifier} from "${importSource}"`

    return {
      localName,
      importSpecifier,
      importStatement,
    }
  }

  private registerControllerCodeActionFor(
    identifier: string,
    source: string,
    importStatement: string,
    localName: string,
  ): CodeAction {
    const registerTitle = `Register controller "${identifier}" from "${source}"`

    return CodeAction.create(
      registerTitle,
      Command.create(registerTitle, "stimulus.controller.register", importStatement, identifier, localName),
      CodeActionKind.QuickFix,
    )
  }
}
