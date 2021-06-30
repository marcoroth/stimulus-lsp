import type { TextDocuments, Connection, SymbolInformation } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'

export type EditorState = {
  connection: Connection
  documents: TextDocuments<TextDocument>
  globalSettings: Settings
  userLanguages: Record<string, string>
  capabilities: {
    configuration: boolean
    diagnosticRelatedInformation: boolean
  }
  getConfiguration?: (uri?: string) => Promise<Settings>
  getDocumentSymbols: (uri: string) => Promise<SymbolInformation[]>
}

export type Settings = {
  editor?: {
    tabSize: number
  }
  stimulus?: {
    includeLanguages: Record<string, string>
    validate: boolean
  }
}

export interface State {
  enabled: boolean
  configPath?: string
  configId?: string
  config?: any
  version?: string
  controllers?: string[]
  modules?: {
    stimulus?: { version: string; module: any }
    resolveConfig?: { module: any }
  }
  browserslist?: string[]
  editor?: EditorState
}
