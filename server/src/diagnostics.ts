import { Connection, Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { getLanguageService, Node, LanguageService } from 'vscode-html-languageservice';

import { StimulusHTMLDataProvider } from './data_providers/stimulus_html_data_provider';

export interface InvalidControllerDiagnosticData {
  identifier: string
}

export class Diagnostics {
  private readonly connection: Connection
  private readonly stimulusDataProvider: StimulusHTMLDataProvider
  private readonly diagnosticsSource = "Stimulus LSP"
  private diagnostics: Map<TextDocument, Diagnostic[]> = new Map();

  constructor(connection: Connection, stimulusDataProvider: StimulusHTMLDataProvider) {
    this.connection = connection;
    this.stimulusDataProvider = stimulusDataProvider;
  }

  get controllers() {
    return this.stimulusDataProvider.controllers.map((controller) => controller.dasherized);
  }

  visitNode(node: Node, textDocument: TextDocument, service: LanguageService) {
    const attributes = node.attributes;

    if (attributes !== undefined) {
      Object.keys(attributes).forEach((attribute: string) => {
        if (attribute === "data-controller") {
          const quotedIdentifier = attributes[attribute];
          const identifier = quotedIdentifier ? quotedIdentifier.substr(1, quotedIdentifier.length - 2) : null;

          if (quotedIdentifier && identifier && !this.controllers.includes(identifier)) {
            const range = this.rangeFromNode(textDocument, node);
            const startTagContent = textDocument.getText(range);
            const attributeRange = this.rangeForAttribute(textDocument, startTagContent, node, attribute, identifier);

            this.createInvalidControllerDiagnosticFor(identifier, textDocument, attributeRange);
          }
        }
      });
    }

    node.children.forEach((child) => {
      this.visitNode(child, textDocument, service);
    });
  }

  validateDataControllerAttributes(textDocument: TextDocument) {
    const service = getLanguageService();
    const html = service.parseHTMLDocument(textDocument);

    html.roots.forEach((node: Node) => {
      this.visitNode(node, textDocument, service);
    });

    this.sendDiagnosticsFor(textDocument);
  }

  private rangeFromNode(textDocument: TextDocument, node: Node) {
    return Range.create(
      textDocument.positionAt(node.start),
      textDocument.positionAt(node.startTagEnd || node.end)
    );
  }

  private rangeForAttribute(textDocument: TextDocument, tagContent: string, node: Node, attribute: string, value: string) {
    const attributeStartIndex = tagContent.indexOf(attribute);

    const attributeValueStart = node.start + attributeStartIndex + attribute.length + 2;
    const attributeValueEnd = attributeValueStart + value.length;

    return Range.create(
      textDocument.positionAt(attributeValueStart),
      textDocument.positionAt(attributeValueEnd)
    );
  }

  private createInvalidControllerDiagnosticFor(identifier: string, textDocument: TextDocument, range: Range) {
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Warning,
      range: range,
      message: `"${identifier}" isn't a valid Stimulus controller.`,
      source: this.diagnosticsSource,
      code: "stimulus.controller.invalid",
      data: {
        identifier
      }
    };

    const diagnostics = this.diagnostics.get(textDocument) || [];
    diagnostics.push(diagnostic);

    this.diagnostics.set(textDocument, diagnostics);
  }

  private sendDiagnosticsFor(textDocument: TextDocument) {
    const diagnostics = this.diagnostics.get(textDocument) || [];

    this.connection.sendDiagnostics({
      uri: textDocument.uri,
      diagnostics
    });

    this.diagnostics.delete(textDocument);
  }
}
