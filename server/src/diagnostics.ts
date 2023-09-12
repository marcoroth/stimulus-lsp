import { Connection, Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { getLanguageService, Node } from "vscode-html-languageservice"

import { parseActionDescriptorString } from "./action_descriptor"

import { DocumentService } from "./document_service"
import { attributeValue, tokenList } from "./html_util"
import { didyoumean } from "./utils"
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
  targetAttribute = /data-(.+)-target/
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
      const attributeValueRange = this.attributeValueRange(textDocument, node, this.controllerAttribute, identifier)

      this.createInvalidControllerDiagnosticFor(identifier, textDocument, attributeValueRange)
    })
  }

  validateDataActionAttribute(node: Node, textDocument: TextDocument) {
    const actions = tokenList(node, this.actionAttribute)

    actions.forEach((action) => {
      const actionDescriptor = parseActionDescriptorString(action)
      const { identifier, methodName } = actionDescriptor


      if (!identifier || !methodName) {
        const attributeValueRange = this.attributeValueRange(textDocument, node, this.actionAttribute, action)

        this.createInvalidActionDiagnosticFor(action, textDocument, attributeValueRange)

        return
      }

      const controller = identifier ? this.controllers.find((controller) => controller.identifier === identifier) : null

      if (!controller) {
        const attributeValueRange = this.attributeValueRange(textDocument, node, this.actionAttribute, identifier)

        this.createInvalidControllerDiagnosticFor(identifier, textDocument, attributeValueRange)
      }

      if (controller && methodName && !controller.methods.includes(methodName)) {
        const attributeValueRange = this.attributeValueRange(textDocument, node, this.actionAttribute, methodName)

        this.createInvalidControllerActionDiagnosticFor(identifier, methodName, textDocument, attributeValueRange)
      }
    })
  }

  validateDataValueAttribute(node: Node, textDocument: TextDocument) {
    const attributes = node.attributes || {}

    const valueAttributeNames = Object.keys(attributes).filter((attribute) => attribute.match(this.valueAttribute))

    valueAttributeNames.forEach((attribute) => {
      const value = attributeValue(node, attribute) || ""
      const attributeMatches = attribute.match(this.valueAttribute)

      // TODO: skip when value contains <%= or %>

      if (attributeMatches && Array.isArray(attributeMatches) && attributeMatches[1]) {
        const identifier = attributeMatches[1]
        const valueName = attributeMatches[2]

        const controller = this.controllers.find((controller) => controller.identifier === identifier)

        if (!controller) {
          const attributeNameRange = this.attributeNameRange(textDocument, node, attribute, identifier)
          this.createInvalidControllerDiagnosticFor(identifier, textDocument, attributeNameRange)

          return
        }

        const valueDefiniton = controller.values[valueName]

        if (controller && !valueDefiniton) {
          const attributeNameRange = this.attributeNameRange(textDocument, node, attribute, valueName)
          this.createMissingValueOnControllerDiagnosticFor(identifier, valueName, textDocument, attributeNameRange)

          return
        }

        let actualType
        const expectedType = valueDefiniton.type

        try {
          actualType = this.parseValueType(JSON.parse(value))
        } catch (e) {
          try {
            actualType = this.parseValueType(JSON.parse(`"${value}"`))
          } catch (e: any) {
            actualType = e?.message || "unparsable"
          }
        }

        if (actualType !== expectedType) {
          const attributeValueRange = this.attributeValueRange(textDocument, node, attribute, value)

          this.createValueMismatchOnControllerDiagnosticFor(
            identifier,
            valueName,
            expectedType,
            actualType,
            textDocument,
            attributeValueRange
          )
        }
      }
    })
  }

  validateDataTargetAttribute(node: Node, textDocument: TextDocument) {
    const attributes = node.attributes || {}

    const targetAttributeNames = Object.keys(attributes).filter((attribute) => attribute.match(this.targetAttribute))

    targetAttributeNames.forEach((attribute) => {
      const targetName = attributeValue(node, attribute) || ""
      const targetMatches = attribute.match(this.targetAttribute)
      const matchedTarget = targetMatches && Array.isArray(targetMatches)
      const identifier = matchedTarget && targetMatches[1]

      if (identifier) {
        const controller = this.controllers.find((controller) => controller.identifier === identifier)

        if (!controller) {
          const attributeNameRange = this.attributeNameRange(textDocument, node, attribute, identifier)
          this.createInvalidControllerDiagnosticFor(identifier, textDocument, attributeNameRange)

          return
        }

        if (controller && !controller.targets.includes(targetName)) {
          const attributeNameRange = this.attributeValueRange(textDocument, node, attribute, targetName)

          this.createMissingTargetOnControllerDiagnosticFor(identifier, targetName, textDocument, attributeNameRange)
        }
      }
    })
  }

  visitNode(node: Node, textDocument: TextDocument) {
    this.validateDataControllerAttribute(node, textDocument)
    this.validateDataActionAttribute(node, textDocument)
    this.validateDataValueAttribute(node, textDocument)
    this.validateDataTargetAttribute(node, textDocument)

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

  private attributeNameRange(textDocument: TextDocument, node: Node, attribute: string, search: string) {
    const range = this.rangeFromNode(textDocument, node)
    const startTagContent = textDocument.getText(range)

    return this.rangeForAttributeName(textDocument, startTagContent, node, attribute, search)
  }

  private rangeForAttributeName(
    textDocument: TextDocument,
    tagContent: string,
    node: Node,
    attribute: string,
    search: string
  ) {
    const searchIndex = attribute.indexOf(search) || 0
    const attributeNameStartIndex = tagContent.indexOf(attribute)

    const attributeNameStart = node.start + attributeNameStartIndex + searchIndex
    const attributeNameEnd = attributeNameStart + search.length

    return Range.create(textDocument.positionAt(attributeNameStart), textDocument.positionAt(attributeNameEnd))
  }

  private attributeValueRange(textDocument: TextDocument, node: Node, attribute: string, search: string) {
    const range = this.rangeFromNode(textDocument, node)
    const startTagContent = textDocument.getText(range)

    return this.rangeForAttributeValue(textDocument, startTagContent, node, attribute, search)
  }

  private rangeForAttributeValue(
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
    const match = didyoumean(
      identifier,
      this.controllers.map((controller) => controller.identifier)
    )
    const suggestion = match ? `Did you mean "${match}"?` : ""

    this.pushDiagnostic(
      `"${identifier}" isn't a valid Stimulus controller. ${suggestion}`,
      "stimulus.controller.invalid",
      range,
      textDocument,
      { identifier }
    )
  }

  private createInvalidActionDiagnosticFor(action: string, textDocument: TextDocument, range: Range) {
    this.pushDiagnostic(`"${action}" isn't a valid action descriptor`, "stimulus.action.invalid", range, textDocument, {
      action,
    })
  }

  private createInvalidControllerActionDiagnosticFor(
    identifier: string,
    actionName: string,
    textDocument: TextDocument,
    range: Range
  ) {
    const controller = this.controllers.find((controller) => controller.identifier === identifier)
    const match = controller ? didyoumean(actionName, controller.methods) : null
    const suggestion = match ? `Did you mean "${match}"?` : ""

    this.pushDiagnostic(
      `"${actionName}" isn't a valid Controller Action on the "${identifier}" controller. ${suggestion}`,
      "stimulus.controller.action.invalid",
      range,
      textDocument,
      { identifier, actionName }
    )
  }

  private createMissingValueOnControllerDiagnosticFor(
    identifier: string,
    valueName: string,
    textDocument: TextDocument,
    range: Range
  ) {
    const controller = this.controllers.find((controller) => controller.identifier === identifier)
    const match = controller ? didyoumean(valueName, Object.keys(controller.values)) : null
    const suggestion = match ? `Did you mean "${match}"?` : ""

    this.pushDiagnostic(
      `"${valueName}" isn't a valid Stimulus Value name on the "${identifier}" controller. ${suggestion}`,
      "stimulus.controller.value.missing",
      range,
      textDocument,
      { identifier, valueName }
    )
  }

  private createMissingTargetOnControllerDiagnosticFor(
    identifier: string,
    targetName: string,
    textDocument: TextDocument,
    range: Range
  ) {
    const controller = this.controllers.find((controller) => controller.identifier === identifier)
    const match = controller ? didyoumean(targetName, controller.targets) : null
    const suggestion = match ? `Did you mean "${match}"?` : ""

    this.pushDiagnostic(
      `"${targetName}" isn't a valid Stimulus Target on the "${identifier}" controller. ${suggestion}`,
      "stimulus.controller.target.missing",
      range,
      textDocument,
      { identifier, targetName }
    )
  }

  private createValueMismatchOnControllerDiagnosticFor(
    identifier: string,
    valueName: string,
    expectedType: string,
    actualType: string,
    textDocument: TextDocument,
    range: Range
  ) {
    this.pushDiagnostic(
      `The value you passed for the "${valueName}" Stimulus Value is of type "${actualType}". But the "${valueName}" Stimulus Value defined in the "${identifier}" controller is of type "${expectedType}".`,
      "stimulus.controller.value.type_mismatch",
      range,
      textDocument,
      { identifier, valueName }
    )
  }

  private pushDiagnostic(
    message: string,
    code: string,
    range: Range,
    textDocument: TextDocument,
    data = {},
    severity = DiagnosticSeverity.Error
  ) {
    const diagnostic: Diagnostic = {
      source: this.diagnosticsSource,
      severity,
      range,
      message,
      code,
      data,
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
