import {
  CodeAction,
  CodeActionKind,
  CodeActionParams,
  Command,
} from 'vscode-languageserver/node';

import { DocumentService } from './document_service';
import { InvalidControllerDiagnosticData } from './diagnostics';

export class CodeActions {
  private readonly documentService: DocumentService

  constructor(documentService: DocumentService) {
    this.documentService = documentService;
  }

  onCodeAction(params: CodeActionParams) {
    const textDocument = this.documentService.get(params.textDocument.uri);

    if (textDocument === undefined) return undefined
    if (params.context.diagnostics.length === 0) return undefined

    const diagnostics = params.context.diagnostics.filter(diagnostic => diagnostic.code === "stimulus.controller.invalid")

    if (diagnostics.length === 0) return undefined

    return diagnostics.map(diagnostic => {
      const identifier = (diagnostic.data as InvalidControllerDiagnosticData).identifier
      const title = `Create "${identifier}" Stimulus Controller`;

      return CodeAction.create(
        title,
        Command.create(title, 'stimulus.controller.create', identifier, diagnostic),
        CodeActionKind.QuickFix
      )
    })
  }
}
