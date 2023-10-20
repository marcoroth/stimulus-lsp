import { Connection, TextDocumentEdit, TextEdit, CreateFile, Range, Diagnostic } from "vscode-languageserver/node"

import { Project, ControllerDefinition } from "stimulus-parser"

type SerializedTextDocument = {
  _uri: string
  _languageId: string
  _version: number
  _content: string
  _lineOffsets: number[]
}

export class Commands {
  private readonly project: Project
  private readonly connection: Connection

  constructor(project: Project, connection: Connection) {
    this.project = project
    this.connection = connection
  }

  async updateControllerReference(identifier: string, diagnostic: Diagnostic, suggestion: string) {
    if (identifier === undefined) return
    if (diagnostic === undefined) return
    if (suggestion === undefined) return

    const { textDocument, range } = diagnostic.data as { textDocument: SerializedTextDocument, range: Range}

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

  private controllerTemplateFor(identifier: string) {
    return `import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    console.log("${identifier} controller connected")
  }
}`
  }
}
