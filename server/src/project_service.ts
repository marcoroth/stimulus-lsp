import {
  CompletionItem,
  CompletionList,
  CompletionParams
} from 'vscode-languageserver/node';

import { State } from './util/state'

export interface ProjectService {
  state: State
  // tryInit: () => Promise<void>
  // dispose: () => void
  // onUpdateSettings: (settings: any) => void
  // onHover(params: TextDocumentPositionParams): Promise<Hover>
  // onCompletion(params: CompletionParams): Promise<CompletionList>
  // onCompletionResolve(item: CompletionItem): Promise<CompletionItem>
  // provideDiagnostics(document: TextDocument): void
  // onDocumentColor(params: DocumentColorParams): Promise<ColorInformation[]>
  // onColorPresentation(params: ColorPresentationParams): Promise<ColorPresentation[]>
  // onCodeAction(params: CodeActionParams): Promise<CodeAction[]>
}
