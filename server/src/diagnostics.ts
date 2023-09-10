import { Connection, Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { getLanguageService, Node } from "vscode-html-languageservice"

import { parseActionDescriptorString } from "./action_descriptor"

import { DocumentService } from "./document_service"
import { attributeValue, tokenList } from "./html_util"
import { StimulusHTMLDataProvider } from "./data_providers/stimulus_html_data_provider"

export interface InvalidControllerDiagnosticData {
  identifier: string
}

export class Diagnostics {
  private readonly connection: Connection
  private readonly stimulusDataProvider: StimulusHTMLDataProvider
  private readonly documentService: DocumentService
  private readonly diagnosticsSource = "Stimulus LSP"
  private diagnostics: Map<TextDocument, Diagnostic[]> = new Map()

  controllerAttribute = "data-controller"
  actionAttribute = "data-action"
  valueAttribute = /data-(.+)-(.+)-value/

  constructor(
    connection: Connection,
    stimulusDataProvider: StimulusHTMLDataProvider,
    documentService: DocumentService
  ) {
    this.connection = connection
    this.stimulusDataProvider = stimulusDataProvider
    this.documentService = documentService
  }

  get controllers() {
    return this.stimulusDataProvider.controllers
  }

  get controllerIdentifiers() {
    return this.controllers.map((controller) => controller.identifier)
  }

  validateDataControllerAttribute(node: Node, textDocument: TextDocument) {
    const identifiers = tokenList(node, this.controllerAttribute)
    const invalidIdentifiers = identifiers.filter((identifier) => !this.controllerIdentifiers.includes(identifier))

    invalidIdentifiers.forEach((identifier) => {
      const attributeRange = this.attributeRange(textDocument, node, this.controllerAttribute, identifier)

      this.createInvalidControllerDiagnosticFor(identifier, textDocument, attributeRange)
    })
  }

  validateDataActionAttribute(node: Node, textDocument: TextDocument) {
    const actions = tokenList(node, this.actionAttribute)

    actions.forEach((action) => {
      const actionDescriptor = parseActionDescriptorString(action)
      const identifier = actionDescriptor.identifier
      const methodName = actionDescriptor.methodName

      if (!identifier && !methodName) {
        const attributeRange = this.attributeRange(textDocument, node, this.actionAttribute, action)

        this.createInvalidActionDiagnosticFor(action, textDocument, attributeRange)

        return
      }

      if (!identifier) return

      const controller = identifier ? this.controllers.find((controller) => controller.identifier === identifier) : null

      if (!controller) {
        const attributeRange = this.attributeRange(textDocument, node, this.actionAttribute, identifier)

        this.createInvalidControllerDiagnosticFor(identifier, textDocument, attributeRange)
      }

      if (controller && methodName && !controller.methods.includes(methodName)) {
        const attributeRange = this.attributeRange(textDocument, node, this.actionAttribute, methodName)

        this.createInvalidControllerActionDiagnosticFor(identifier, methodName, textDocument, attributeRange)
      }
    })
  }

  validateDataValueAttribute(node: Node, textDocument: TextDocument) {
    const attributes = node.attributes || {}

    const valueAttributeNames = Object.keys(attributes).filter(attribute => attribute.match(this.valueAttribute))

    valueAttributeNames.forEach(attribute => {
      const value = attributeValue(node, attribute) || ""
      const attributeMatches = attribute.match(this.valueAttribute)

      // TODO: skip when value contains <%= or %>

      if (attributeMatches && Array.isArray(attributeMatches) && attributeMatches[1]) {
        const identifier = attributeMatches[1]
        const valueName = attributeMatches[2]

        const controller = this.controllers.find(controller => controller.identifier === identifier)

        const attributeNameStart = textDocument.getText().indexOf(attribute)
        const attributeNameEnd = attributeNameStart + attribute.length

        const attributeNameRange = Range.create(
          textDocument.positionAt(attributeNameStart),
          textDocument.positionAt(attributeNameEnd)
        )

        if (!controller)  {
          this.createInvalidControllerDiagnosticFor(identifier, textDocument, attributeNameRange)

          return
        }

        const valueDefiniton = controller.values[valueName]

        if (controller && !valueDefiniton)  {
          this.createMissingValueOnControllerDiagnosticFor(identifier, valueName, textDocument, attributeNameRange)

          return
        }

        let actualType
        const expectedType = valueDefiniton.type

        try {
          actualType = this.parseValueType(JSON.parse(value))
        } catch(e) {
          try {
            actualType = this.parseValueType(JSON.parse(`"${value}"`))
          } catch(e: any) {
            actualType = e?.message || "unparsable"
          }
        }

        if (actualType !== expectedType) {
          const attributeRange = this.attributeRange(textDocument, node, attribute, value)

          this.createValueMismatchOnControllerDiagnosticFor(identifier, valueName, expectedType, actualType, textDocument, attributeRange)
        }
      }
    })
  }

  visitNode(node: Node, textDocument: TextDocument) {
    this.validateDataControllerAttribute(node, textDocument)
    this.validateDataActionAttribute(node, textDocument)
    this.validateDataValueAttribute(node, textDocument)

    node.children.forEach((child) => {
      this.visitNode(child, textDocument)
    })
  }

  validate(textDocument: TextDocument) {
    const service = getLanguageService()
    const html = service.parseHTMLDocument(textDocument)

    html.roots.forEach((node: Node) => {
      this.visitNode(node, textDocument)
    })

    this.sendDiagnosticsFor(textDocument)
  }

  refreshDocument(document: TextDocument) {
    this.validate(document)
  }

  refreshAllDocuments() {
    this.documentService.getAll().forEach((document) => {
      this.refreshDocument(document)
    })
  }

  private rangeFromNode(textDocument: TextDocument, node: Node) {
    return Range.create(textDocument.positionAt(node.start), textDocument.positionAt(node.startTagEnd || node.end))
  }

  private attributeRange(textDocument: TextDocument, node: Node, attribute: string, search: string) {
    const range = this.rangeFromNode(textDocument, node)
    const startTagContent = textDocument.getText(range)

    return this.rangeForAttribute(textDocument, startTagContent, node, attribute, search)
  }

  private rangeForAttribute(
    textDocument: TextDocument,
    tagContent: string,
    node: Node,
    attribute: string,
    search: string
  ) {
    const value = attributeValue(node, attribute) || ""

    const searchIndex = value.indexOf(search) || 0
    const attributeStartIndex = tagContent.indexOf(attribute)

    const attributeValueStart = node.start + attributeStartIndex + attribute.length + searchIndex + 2
    const attributeValueEnd = attributeValueStart + search.length

    return Range.create(textDocument.positionAt(attributeValueStart), textDocument.positionAt(attributeValueEnd))
  }

  private createInvalidControllerDiagnosticFor(identifier: string, textDocument: TextDocument, range: Range) {
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      range: range,
      message: `"${identifier}" isn't a valid Stimulus controller.`,
      source: this.diagnosticsSource,
      code: "stimulus.controller.invalid",
      data: {
        identifier,
      },
    }

    const diagnostics = this.diagnostics.get(textDocument) || []
    diagnostics.push(diagnostic)

    this.diagnostics.set(textDocument, diagnostics)
  }

  private createInvalidActionDiagnosticFor(action: string, textDocument: TextDocument, range: Range) {
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      range: range,
      message: `"${action}" isn't a valid action descriptor`,
      source: this.diagnosticsSource,
      code: "stimulus.action.invalid",
      data: {
        action,
      },
    }

    const diagnostics = this.diagnostics.get(textDocument) || []
    diagnostics.push(diagnostic)

    this.diagnostics.set(textDocument, diagnostics)
  }

  private createInvalidControllerActionDiagnosticFor(
    identifier: string,
    actionName: string,
    textDocument: TextDocument,
    range: Range
  ) {
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      range: range,
      message: `"${actionName}" isn't a valid Controller Action on the "${identifier}" controller.`,
      source: this.diagnosticsSource,
      code: "stimulus.controller.invalid_action",
      data: {
        identifier,
        actionName,
      },
    }

    const diagnostics = this.diagnostics.get(textDocument) || []
    diagnostics.push(diagnostic)

    this.diagnostics.set(textDocument, diagnostics)
  }

  private createMissingValueOnControllerDiagnosticFor(
    identifier: string,
    valueName: string,
    textDocument: TextDocument,
    range: Range
  ) {
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      range: range,
      message: `"${valueName}" isn't a valid Stimulus Value name on the "${identifier}" controller.`,
      source: this.diagnosticsSource,
      code: "stimulus.controller.values.missing",
      data: {
        identifier,
        valueName,
      },
    }

    const diagnostics = this.diagnostics.get(textDocument) || []
    diagnostics.push(diagnostic)

    this.diagnostics.set(textDocument, diagnostics)
  }

  private createValueMismatchOnControllerDiagnosticFor(
    identifier: string,
    valueName: string,
    expectedType: string,
    actualType: string,
    textDocument: TextDocument,
    range: Range
  ) {
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      range: range,
      message: `The value you passed for the "${valueName}" Stimulus Value is of type "${actualType}". But the "${valueName}" Stimulus Value defined in the "${identifier}" controller is of type "${expectedType}".`,
      source: this.diagnosticsSource,
      code: "stimulus.controller.values.type_mismatch",
      data: {
        identifier,
        valueName,
      },
    }

    const diagnostics = this.diagnostics.get(textDocument) || []
    diagnostics.push(diagnostic)

    this.diagnostics.set(textDocument, diagnostics)
  }

  private sendDiagnosticsFor(textDocument: TextDocument) {
    const diagnostics = this.diagnostics.get(textDocument) || []

    this.connection.sendDiagnostics({
      uri: textDocument.uri,
      diagnostics,
    })

    this.diagnostics.delete(textDocument)
  }

  private parseValueType(string: any) {
    switch (typeof string) {
      case "boolean":
        return "Boolean"
      case "number":
        return "Number"
      case "string":
        return "String"
    }

    if (Array.isArray(string)) return "Array"
    if (Object.prototype.toString.call(string) === "[object Object]") return "Object"
  }
}
