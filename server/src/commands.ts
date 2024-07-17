import dedent from "dedent"

import { Connection, TextDocumentEdit, TextEdit, CreateFile, Range, Diagnostic } from "vscode-languageserver/node"
import { DeprecatedPackageImportsDiagnosticData } from "./diagnostics"
import { Config } from "./config"
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

    const { textDocument, range } = diagnostic.data as { textDocument: SerializedTextDocument; range: Range }

    const document = { uri: textDocument._uri, version: textDocument._version }
    const textEdit: TextEdit = { range, newText: suggestion }

    const documentChanges: TextDocumentEdit[] = [TextDocumentEdit.create(document, [textEdit])]

    await this.connection.workspace.applyEdit({ documentChanges })
  }

  async registerControllerDefinition(importStatement: string, identifier: string, localName: string) {
    if (importStatement === undefined) return
    if (identifier === undefined) return
    if (localName === undefined) return
    if (this.project.controllersIndexFiles.length === 0) return

    // TODO: there must be a better way to get the end of the file without having the textDocument
    const endOfFile = { line: 10000000, character: 0 }

    // TODO: don't always choose first contollersFile
    const uri = `file://${this.project.controllersIndexFiles[0].path}`
    const document = { uri, version: null }
    const textEdit: TextEdit = {
      range: { start: endOfFile, end: endOfFile },
      newText: `\n\n${importStatement}\napplication.register("${identifier}", ${localName})\n`,
    }

    const documentChanges: TextDocumentEdit[] = [TextDocumentEdit.create(document, [textEdit])]

    await this.connection.workspace.applyEdit({ documentChanges })
    await this.connection.window.showDocument({
      uri,
      external: false,
      takeFocus: true,
    })
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

    const uri = `file://${controller.sourceFile.path}`
    const document = { uri, version: null }
    const documentChanges: TextDocumentEdit[] = [TextDocumentEdit.create(document, [textEdit])]

    await this.connection.workspace.applyEdit({ documentChanges })
    await this.connection.window.showDocument({
      uri,
      external: false,
      takeFocus: true,
    })
  }

  async updateImportSource(diagnostic: Diagnostic) {
    const {
      textDocument,
      importSourceRange: range,
      suggestion: newText,
    } = diagnostic.data as DeprecatedPackageImportsDiagnosticData & { textDocument: SerializedTextDocument }

    const textEdit: TextEdit = {
      range,
      newText,
    }

    const uri = textDocument._uri
    const document = { uri, version: null }

    const documentChanges: TextDocumentEdit[] = [TextDocumentEdit.create(document, [textEdit])]
    await this.connection.workspace.applyEdit({ documentChanges })
    await this.connection.window.showDocument({
      uri,
      external: false,
      takeFocus: true,
    })
  }

  async createStimulusLSPConfig() {
    const config = await Config.fromPathOrNew(this.project.projectPath)
    const configPath = config.path
    const createFile: CreateFile = { kind: "create", uri: configPath }

    await this.connection.workspace.applyEdit({ documentChanges: [createFile] })

    const documentRange: Range = Range.create(0, 0, 0, 0)
    const textEdit: TextEdit = { range: documentRange, newText: config.toJSON() }
    const textDocumentEdit = TextDocumentEdit.create({ uri: configPath, version: 1 }, [textEdit])

    await this.connection.workspace.applyEdit({ documentChanges: [textDocumentEdit] })
    await this.connection.window.showDocument({
      uri: textDocumentEdit.textDocument.uri,
      external: false,
      takeFocus: true,
    })
  }

  async addIgnoredControllerToConfig(identifier: string) {
    const config = await Config.fromPathOrNew(this.project.projectPath)

    config.addIgnoredController(identifier)

    await config.write()

    await this.connection.window.showDocument({
      uri: `file://${config.path}`,
      external: false,
      takeFocus: true,
    })
  }

  async addIgnoredAttributeToConfig(attribute: string) {
    const config = await Config.fromPathOrNew(this.project.projectPath)

    config.addIgnoredAttribute(attribute)

    await config.write()

    await this.connection.window.showDocument({
      uri: `file://${config.path}`,
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
