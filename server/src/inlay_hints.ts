import { DocumentService } from "./document_service"
import { Project } from "stimulus-parser"

import { Position } from "vscode-languageserver"
import type { InlayHintsRequest, InlayHintsResponse } from "./requests"

export class InlayHints {
  private readonly documentService: DocumentService
  private readonly project: Project

  constructor(documentService: DocumentService, project: Project) {
    this.documentService = documentService
    this.project = project
  }

  async onInlayHints({ document }: InlayHintsRequest): Promise<InlayHintsResponse> {
    console.log(document.uri)

    await new Promise((resolve) => setTimeout(resolve, 1000))

    const textDocument = this.documentService.get(`file://${document.uri.fsPath}`)
    if (!textDocument) return []

    const projectFile = this.project.projectFiles.find((file) => `file://${file.path}` === textDocument.uri)
    if (!projectFile || !projectFile.isProjectFile) return []

    return projectFile.controllerDefinitions.flatMap((definition) => {
      const hints = []

      if (definition.values.length > 0 && definition.values.length > definition.localValues.length) {
        const loc = definition.values[0].loc?.end

        const nonLocalValues = definition.values.filter((value) => !definition.localValueNames.includes(value.name))

        const values = nonLocalValues.map((value) => {
          // TODO: this shouldn't be necessary
          let defaultValue: any = value.default === undefined ? "undefined" : value.default
          defaultValue = value.default === null ? "null" : value.default
          defaultValue = value.default === false ? "false" : value.default
          defaultValue = value.default === true ? "true" : value.default
          defaultValue = value.default === "" ? '""' : value.default

          return `"${value.name}": { type: ${value.type}, default: ${defaultValue} }`
        })

        if (loc && nonLocalValues.length > 0) {
          hints.push({
            text: `, ${values.join(", ")}`,
            position: Position.create(loc.line - 1, loc.column - 1),
            tooltip: "Inherited Value Definitions from parent controllers",
          })
        }
      }

      if (definition.targets.length > 0 && definition.targets.length > definition.localTargets.length) {
        const loc = definition.targets[0].loc?.end

        const nonLocalTargets = definition.targets.filter(
          (target) => !definition.localTargetNames.includes(target.name),
        )

        if (loc && nonLocalTargets.length > 0) {
          hints.push({
            text: `, ${nonLocalTargets.map((target) => `"${target.name}"`).join(", ")}`,
            position: Position.create(loc.line - 1, loc.column - 1),
            tooltip: "Inherited Target Definitions from parent controllers",
          })
        }
      }

      if (definition.classes.length > definition.localClasses.length) {
        const node = definition.classes[0].node
        const position = { line: 0, character: 0 }
        const nonLocalClasses = definition.classes.filter((klass) => !definition.localClassNames.includes(klass.name))

        let text = nonLocalClasses.map((klass) => `"${klass.name}"`).join(", ")

        if (node.loc && node.type === "ArrayExpression") {
          const lastElementLoc = (node.elements || []).reverse()[0]?.loc

          if (lastElementLoc && definition.localClasses.length > 0) {
            text = `, ${text}`

            if (node.loc.start.line === node.loc.end.line) {
              position.line = lastElementLoc.start.line - 1
              position.character = lastElementLoc.end.column
            } else {
              position.line = node.loc.end.line - 2
              position.character = node.loc.end.column - 1
            }
          } else {
            const loc = definition.classDeclaration.node?.loc
            text = `static classes = [${text}]`

            if (loc) {
              position.line = loc.start.line
              position.character = 2
            }
          }
        }

        if (nonLocalClasses.length > 0) {
          hints.push({
            text,
            position: Position.create(position.line, position.character),
            tooltip: "Inherited Class Definitions from parent controllers",
          })
        }
      }

      return hints
    })
  }
}
