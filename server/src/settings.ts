import { ClientCapabilities, Connection, InitializeParams } from "vscode-languageserver/node"

export interface StimulusSettings {}

export class Settings {
  // The global settings, used when the `workspace/configuration` request is not supported by the client.
  // Please note that this is not the case when using this server with the client provided in this example
  // but could happen with other clients.
  defaultSettings: StimulusSettings = {}
  globalSettings: StimulusSettings = this.defaultSettings
  documentSettings: Map<string, Thenable<StimulusSettings>> = new Map()

  hasConfigurationCapability = false
  hasWorkspaceFolderCapability = false
  hasDiagnosticRelatedInformationCapability = false

  params: InitializeParams
  capabilities: ClientCapabilities
  connection: Connection

  constructor(params: InitializeParams, connection: Connection) {
    this.params = params
    this.capabilities = params.capabilities
    this.connection = connection

    // Does the client support the `workspace/configuration` request?
    // If not, we fall back using global settings.
    this.hasConfigurationCapability = !!(this.capabilities.workspace && !!this.capabilities.workspace.configuration)

    this.hasWorkspaceFolderCapability = !!(
      this.capabilities.workspace && !!this.capabilities.workspace.workspaceFolders
    )

    this.hasDiagnosticRelatedInformationCapability = !!(
      this.capabilities.textDocument &&
      this.capabilities.textDocument.publishDiagnostics &&
      this.capabilities.textDocument.publishDiagnostics.relatedInformation
    )
  }

  get projectPath() {
    return this.params.rootUri || ""
  }

  get controllersPath() {
    return `${this.projectPath}/app/javascript/controllers`
  }

  getDocumentSettings(resource: string): Thenable<StimulusSettings> {
    if (!this.hasConfigurationCapability) {
      return Promise.resolve(this.globalSettings)
    }

    let result = this.documentSettings.get(resource)

    if (!result) {
      result = this.connection.workspace.getConfiguration({
        scopeUri: resource,
        section: "languageServerStimulus",
      })
      this.documentSettings.set(resource, result)
    }

    return result
  }
}
