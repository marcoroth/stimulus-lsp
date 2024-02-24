import { Connection, InitializeParams } from "vscode-languageserver/node"
import { getLanguageService, LanguageService } from "vscode-html-languageservice"

import { StimulusHTMLDataProvider } from "./data_providers/stimulus_html_data_provider"
import { Settings } from "./settings"
import { DocumentService } from "./document_service"
import { Diagnostics } from "./diagnostics"
import { Definitions } from "./definitions"
import { Commands } from "./commands"
import { CodeActions } from "./code_actions"
import { Project } from "stimulus-parser"

export class Service {
  connection: Connection
  settings: Settings
  htmlLanguageService: LanguageService
  stimulusDataProvider: StimulusHTMLDataProvider
  diagnostics: Diagnostics
  definitions: Definitions
  commands: Commands
  documentService: DocumentService
  codeActions: CodeActions
  project: Project

  constructor(connection: Connection, params: InitializeParams) {
    this.connection = connection
    this.settings = new Settings(params, this.connection)
    this.documentService = new DocumentService(this.connection)
    this.project = new Project(this.settings.projectPath.replace("file://", ""))
    this.codeActions = new CodeActions(this.documentService, this.project)
    this.stimulusDataProvider = new StimulusHTMLDataProvider("id", this.project)
    this.diagnostics = new Diagnostics(this.connection, this.stimulusDataProvider, this.documentService)
    this.definitions = new Definitions(this.documentService, this.stimulusDataProvider)
    this.commands = new Commands(this.project, this.connection)

    this.htmlLanguageService = getLanguageService({
      customDataProviders: [this.stimulusDataProvider],
    })
  }

  async init() {
    await this.project.initialize()

    // Only keep settings for open documents
    this.documentService.onDidClose((change) => {
      this.settings.documentSettings.delete(change.document.uri)
    })

    // The content of a text document has changed. This event is emitted
    // when the text document first opened or when its content has changed.
    this.documentService.onDidChangeContent((change) => {
      this.diagnostics.refreshDocument(change.document)
    })
  }

  async refresh() {
    await this.project.refresh()

    this.diagnostics.refreshAllDocuments()

    this.diagnostics.populateSourceFileErrorsAsDiagnostics(this.project.projectFiles)
  }
}
