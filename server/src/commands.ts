import dedent from "dedent"

import { Connection, TextDocumentEdit, TextEdit, CreateFile, Range, Diagnostic } from "vscode-languageserver/node"

import { Project, ControllerDefinition } from "stimulus-parser"
import { DocumentService } from "./document_service"

type SerializedTextDocument = {
  _uri: string
  _languageId: string
  _version: number
  _content: string
  _lineOffsets: number[]
}

export class Commands {
  private readonly documentService: DocumentService
  private readonly project: Project
  private readonly connection: Connection

  constructor(documentService: DocumentService, project: Project, connection: Connection) {
    this.documentService = documentService
    this.project = project
    this.connection = connection
  }

  async updateControllerReference(identifier: string, diagnostic: Diagnostic, suggestion: string) {
    if (identifier === undefined) return
    if (diagnostic === undefined) return
    if (suggestion === undefined) return

    const { textDocument, range } = diagnostic.data as { textDocument: SerializedTextDocument; range: Range }

    const document = { uri: textDocument._uri, version: textDocument._version }
    const textEdit: TextEdit = { range, newText: suggestion }

    const documentChanges: TextDocumentEdit[] = [TextDocumentEdit.create(document, [textEdit])]

    await this.connection.workspace.applyEdit({ documentChanges })
  }

  async createController(identifier: string, diagnostic: Diagnostic, controllerRoot: string) {
    if (identifier === undefined) return
    if (diagnostic === undefined) return
    if (controllerRoot === undefined) controllerRoot = this.project.controllerRoot

    const path = ControllerDefinition.controllerPathForIdentifier(identifier)
    const newControllerPath = `${this.project.projectPath}/${controllerRoot}/${path}`
    const createFile: CreateFile = { kind: "create", uri: newControllerPath }

    await this.connection.workspace.applyEdit({ documentChanges: [createFile] })

    const documentRange: Range = Range.create(0, 0, 0, 0)
    const textEdit: TextEdit = { range: documentRange, newText: this.controllerTemplateFor(identifier) }
    const textDocumentEdit = TextDocumentEdit.create({ uri: newControllerPath, version: 1 }, [textEdit])

    await this.connection.workspace.applyEdit({ documentChanges: [textDocumentEdit] })
    await this.connection.window.showDocument({
      uri: textDocumentEdit.textDocument.uri,
      external: false,
      takeFocus: true,
    })
  }

  async updateControllerActionReference(actionName: string, diagnostic: Diagnostic, suggestion: string) {
    if (actionName === undefined) return
    if (diagnostic === undefined) return
    if (suggestion === undefined) return

    const { textDocument, range } = diagnostic.data as { textDocument: SerializedTextDocument; range: Range }

    const document = { uri: textDocument._uri, version: textDocument._version }
    const textEdit: TextEdit = { range, newText: suggestion }

    const documentChanges: TextDocumentEdit[] = [TextDocumentEdit.create(document, [textEdit])]

    await this.connection.workspace.applyEdit({ documentChanges })
  }

  async implementControllerAction(actionName: string, identifier: string, diagnostic: Diagnostic) {
    if (identifier === undefined) return
    if (actionName === undefined) return
    if (diagnostic === undefined) return

    const controller = this.project.registeredControllers.find((controller) => controller.identifier === identifier)
    if (controller === undefined) return

    const loc = controller.controllerDefinition.classDeclaration?.node?.loc

    if (!loc) return

    const position = { line: loc.end.line - 1, character: 0 }

    const textEdit: TextEdit = {
      range: { start: position, end: position },
      newText: `
  ${actionName}(event) {
    console.log("${identifier}#${actionName}", event)
  }
`,
    }

    const textDocument = this.documentService.get(`file://${controller.sourceFile.path}`)

    if (!textDocument) return

    const document = { uri: textDocument.uri, version: textDocument.version }
    const documentChanges: TextDocumentEdit[] = [TextDocumentEdit.create(document, [textEdit])]

    await this.connection.workspace.applyEdit({ documentChanges })
    await this.connection.window.showDocument({
      uri: textDocument.uri,
      external: false,
      takeFocus: true,
    })
  }

  private controllerTemplateFor(identifier: string) {
    return dedent`
      import { Controller } from "@hotwired/stimulus"

      export default class extends Controller {
        connect() {
          console.log("${identifier} controller connected")
        }
      }
    `
  }
}
