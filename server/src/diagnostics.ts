import { Connection, Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { getLanguageService, Node, LanguageService } from 'vscode-html-languageservice';

import { DocumentService } from "./document_service";
import { attributeValue, tokenList } from "./html_util";
import { StimulusHTMLDataProvider } from './data_providers/stimulus_html_data_provider';

export interface InvalidControllerDiagnosticData {
  identifier: string
}

export class Diagnostics {
  private readonly connection: Connection
  private readonly stimulusDataProvider: StimulusHTMLDataProvider
  private readonly documentService: DocumentService
  private readonly diagnosticsSource = "Stimulus LSP"
  private diagnostics: Map<TextDocument, Diagnostic[]> = new Map();

  controllerAttribute = "data-controller"

  constructor(connection: Connection, stimulusDataProvider: StimulusHTMLDataProvider, documentService: DocumentService) {
    this.connection = connection;
    this.stimulusDataProvider = stimulusDataProvider;
    this.documentService = documentService;
  }

  get controllers() {
    return this.stimulusDataProvider.controllers.map((controller) => controller.identifier);
  }

  visitNode(node: Node, textDocument: TextDocument, service: LanguageService) {
    const identifiers = tokenList(node, this.controllerAttribute);
    const invalidIdentifiers = identifiers.filter(identifier => !this.controllers.includes(identifier));

    invalidIdentifiers.forEach((identifier) => {
      const range = this.rangeFromNode(textDocument, node);
      const startTagContent = textDocument.getText(range);
      const attributeRange = this.rangeForAttribute(textDocument, startTagContent, node, this.controllerAttribute, identifier);

      this.createInvalidControllerDiagnosticFor(identifier, textDocument, attributeRange);
    });

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

  refreshDocument(document: TextDocument) {
    this.validateDataControllerAttributes(document);
  }

  refreshAllDocuments() {
    this.documentService.getAll().forEach(document => {
      this.refreshDocument(document);
    });
  }

  private rangeFromNode(textDocument: TextDocument, node: Node) {
    return Range.create(
      textDocument.positionAt(node.start),
      textDocument.positionAt(node.startTagEnd || node.end)
    );
  }

  private rangeForAttribute(textDocument: TextDocument, tagContent: string, node: Node, attribute: string, search: string) {
    const value = attributeValue(node, attribute) || "";

    const searchIndex = value.indexOf(search) || 0;
    const attributeStartIndex = tagContent.indexOf(attribute);

    const attributeValueStart = node.start + attributeStartIndex + attribute.length + searchIndex + 2;
    const attributeValueEnd = attributeValueStart + search.length;

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
