import { Connection, Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { StimulusHTMLDataProvider } from './data_providers/stimulus_html_data_provider';

export interface InvalidControllerDiagnosticData {
  identifier: string
}

export class Diagnostics {
  private readonly connection: Connection
  private readonly stimulusDataProvider: StimulusHTMLDataProvider
  private readonly diagnosticsSource = "Stimulus LSP"

  constructor(connection: Connection, stimulusDataProvider: StimulusHTMLDataProvider) {
    this.connection = connection;
    this.stimulusDataProvider = stimulusDataProvider;
  }

  get validControllers() {
    return this.stimulusDataProvider.controllers.map((controller) => controller.dasherized);
  }

  validateDataControllerAttributes(textDocument: TextDocument) {
    const text = textDocument.getText();
    const pattern = /data-controller=["'](.+)["']/g;
    const diagnostics: Diagnostic[] = [];

    let m: RegExpExecArray | null;

    while ((m = pattern.exec(text))) {
      const match = m[0];
      const identifier = m[1];

      if (!this.validControllers.includes(identifier)) {
        const offset = match.indexOf(identifier);
        const start = m.index + offset;
        const end = m.index + offset + identifier.length;

        const diagnostic: Diagnostic = {
          severity: DiagnosticSeverity.Warning,
          range: {
            start: textDocument.positionAt(start),
            end: textDocument.positionAt(end)
          },
          message: `${identifier} isn't a valid controller.`,
          source: this.diagnosticsSource,
          code: "stimulus.controller.invalid",
          data: {
            identifier
          }
        };

        diagnostics.push(diagnostic);
      }
    }

    this.connection.sendDiagnostics({
      uri: textDocument.uri,
      diagnostics
    });
  }
}
