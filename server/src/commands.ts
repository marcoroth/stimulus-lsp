import {
  Connection,
  TextDocumentEdit,
  TextEdit,
  CreateFile,
  Range,
  Diagnostic
} from 'vscode-languageserver/node';

import { Settings } from './settings';

export class Commands {
  private readonly settings: Settings
  private readonly connection: Connection

  constructor(settings: Settings, connection: Connection) {
    this.settings = settings
    this.connection = connection
  }

  async createController(identifier: string, diagnostic: Diagnostic) {
    if (identifier === undefined) return
    if (diagnostic === undefined) return

    const newControllerPath = `${this.settings.controllersPath}/${identifier}_controller.js`;
    const createFile: CreateFile = { kind: 'create', uri: newControllerPath };

    await this.connection.workspace.applyEdit({ documentChanges: [createFile] });

    const documentRange: Range = Range.create(0, 0, 0, 0);
    const textEdit: TextEdit = { range: documentRange, newText: this.controllerTemplateFor(identifier) };
    const textDocumentEdit = TextDocumentEdit.create({ uri: newControllerPath, version: 1 }, [textEdit]);

    await this.connection.workspace.applyEdit({ documentChanges: [textDocumentEdit] });
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
