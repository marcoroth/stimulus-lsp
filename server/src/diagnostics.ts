import { Connection, Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { getLanguageService, Node, LanguageService } from 'vscode-html-languageservice';

import { parseActionDescriptorString } from "./action_descriptor";

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
  actionAttribute = "data-action"

  constructor(connection: Connection, stimulusDataProvider: StimulusHTMLDataProvider, documentService: DocumentService) {
    this.connection = connection;
    this.stimulusDataProvider = stimulusDataProvider;
    this.documentService = documentService;
  }

  get controllers() {
    return this.stimulusDataProvider.controllers;
  }

  get controllerIdentifiers() {
    return this.controllers.map(controller => controller.identifier);
  }

  validateDataControllerAttribute(node: Node, textDocument: TextDocument) {
    const identifiers = tokenList(node, this.controllerAttribute);
    const invalidIdentifiers = identifiers.filter(identifier => !this.controllerIdentifiers.includes(identifier));

    invalidIdentifiers.forEach((identifier) => {
      const attributeRange = this.attributeRange(textDocument, node, this.controllerAttribute, identifier);

      this.createInvalidControllerDiagnosticFor(identifier, textDocument, attributeRange);
    });
  }

  validateDataActionAttribute(node: Node, textDocument: TextDocument) {
    const actions = tokenList(node, this.actionAttribute);

    actions.forEach((action) => {
      const actionDescriptor = parseActionDescriptorString(action);
      const identifier = actionDescriptor.identifier;
      const methodName = actionDescriptor.methodName;

      if (!identifier && !methodName) {
        const attributeRange = this.attributeRange(textDocument, node, this.actionAttribute, action);

        this.createInvalidActionDiagnosticFor(action, textDocument, attributeRange);

        return;
      }

      if (!identifier) return;

      const controller = identifier ? this.controllers.find(controller => controller.identifier === identifier) : null;

      if (!controller) {
        const attributeRange = this.attributeRange(textDocument, node, this.actionAttribute, identifier);

        this.createInvalidControllerDiagnosticFor(identifier, textDocument, attributeRange);
      }

      if (controller && methodName && !controller.methods.includes(methodName)) {
        const attributeRange = this.attributeRange(textDocument, node, this.actionAttribute, methodName);

        this.createInvalidControllerActionDiagnosticFor(identifier, methodName, textDocument, attributeRange);
      }
    });
  }

  visitNode(node: Node, textDocument: TextDocument) {
    this.validateDataControllerAttribute(node, textDocument);
    this.validateDataActionAttribute(node, textDocument);

    node.children.forEach((child) => {
      this.visitNode(child, textDocument);
    });
  }

  validate(textDocument: TextDocument) {
    const service = getLanguageService();
    const html = service.parseHTMLDocument(textDocument);

    html.roots.forEach((node: Node) => {
      this.visitNode(node, textDocument);
    });

    this.sendDiagnosticsFor(textDocument);
  }

  refreshDocument(document: TextDocument) {
    this.validate(document);
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

  private attributeRange(textDocument: TextDocument, node: Node, attribute: string, search: string) {
    const range = this.rangeFromNode(textDocument, node);
    const startTagContent = textDocument.getText(range);

    return this.rangeForAttribute(textDocument, startTagContent, node, attribute, search);
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
      severity: DiagnosticSeverity.Error,
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

  private createInvalidActionDiagnosticFor(action: string, textDocument: TextDocument, range: Range) {
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      range: range,
      message: `"${action}" isn't a valid action descriptor`,
      source: this.diagnosticsSource,
      code: "stimulus.action.invalid",
      data: {
        action
      }
    };

    const diagnostics = this.diagnostics.get(textDocument) || [];
    diagnostics.push(diagnostic);

    this.diagnostics.set(textDocument, diagnostics);
  }

  private createInvalidControllerActionDiagnosticFor(identifier: string, actionName: string, textDocument: TextDocument, range: Range) {
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      range: range,
      message: `"${actionName}" isn't a valid Controller Action on the "${identifier}" controller.`,
      source: this.diagnosticsSource,
      code: "stimulus.controller.invalid_action",
      data: {
        identifier,
        actionName
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
