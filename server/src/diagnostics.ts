import dedent from "dedent"
import { Connection, Diagnostic, DiagnosticSeverity, Position, Range } from "vscode-languageserver/node"
import { TextDocument } from "vscode-languageserver-textdocument"
import { getLanguageService, Node } from "vscode-html-languageservice"

import { parseActionDescriptorString } from "./action_descriptor"

import { DocumentService } from "./document_service"
import { attributeValue, tokenList } from "./html_util"
import { didyoumean, camelize, dasherize } from "./utils"
import { StimulusHTMLDataProvider } from "./data_providers/stimulus_html_data_provider"

import type { Project, SourceFile } from "stimulus-parser"
import type * as Acorn from "acorn"

export interface InvalidControllerDiagnosticData {
  identifier: string
  suggestion: string
}

export interface InvalidActionDiagnosticData {
  identifier: string
  actionName: string
  suggestion: string
}

export class Diagnostics {
  private readonly connection: Connection
  private readonly stimulusDataProvider: StimulusHTMLDataProvider
  private readonly documentService: DocumentService
  private readonly project: Project
  private readonly diagnosticsSource = "Stimulus LSP "
  private diagnostics: Map<TextDocument, Diagnostic[]> = new Map()

  controllerAttribute = "data-controller"
  actionAttribute = "data-action"
  targetAttribute = /data-(.+)-target/
  valueAttribute = /data-(.+)-(.+)-value/

  constructor(
    connection: Connection,
    stimulusDataProvider: StimulusHTMLDataProvider,
    documentService: DocumentService,
    project: Project,
  ) {
    this.connection = connection
    this.stimulusDataProvider = stimulusDataProvider
    this.documentService = documentService
    this.project = project
  }

  get controllers() {
    return this.stimulusDataProvider.controllers
  }

  get controllerIdentifiers() {
    return this.controllers.map((controller) => controller.identifier)
  }

  validateParsedControllerWithoutErrors(node: Node, textDocument: TextDocument) {
    const identifiers = tokenList(node, this.controllerAttribute)

    identifiers.forEach((identifier) => {
      const controller = this.controllers.find((controller) => controller.identifier === identifier)

      if (!controller || !controller.controllerDefinition.hasErrors) return

      const attributeValueRange = this.attributeValueRange(textDocument, node, this.controllerAttribute, identifier)

      controller.controllerDefinition.errors.forEach((error) => {
        this.createParseErrorDiagnosticFor(identifier, error.message || "", textDocument, attributeValueRange)
      })
    })
  }

  populateSourceFileErrorsAsDiagnostics(sourceFile: SourceFile, textDocument: TextDocument) {
    const errors = sourceFile.errors.concat(
      sourceFile.classDeclarations.flatMap((classDeclaration) => classDeclaration.controllerDefinition?.errors || []),
    )

    errors.map((error) => {
      const range = this.rangeFromLoc(textDocument, error.loc)

      this.pushDiagnostic(
        error.message,
        "stimulus.source_file.error",
        range,
        textDocument,
        {},
        DiagnosticSeverity.Warning,
      )
    })
  }

  validateDataControllerAttribute(node: Node, textDocument: TextDocument) {
    const identifiers = tokenList(node, this.controllerAttribute)
    const invalidIdentifiers = identifiers.filter(
      (identifier) => !this.controllerIdentifiers.includes(identifier) && !this.foundSkippableTags(identifier),
    )

    invalidIdentifiers.forEach((identifier) => {
      const attributeValueRange = this.attributeValueRange(textDocument, node, this.controllerAttribute, identifier)

      this.createInvalidControllerDiagnosticFor(identifier, textDocument, attributeValueRange)
    })
  }

  validateDataActionAttribute(node: Node, textDocument: TextDocument) {
    const actions = tokenList(node, this.actionAttribute)

    actions.forEach((action) => {
      const actionDescriptor = parseActionDescriptorString(action)
      const { identifier, methodName } = actionDescriptor

      if (!identifier || !methodName) {
        const attributeValueRange = this.attributeValueRange(textDocument, node, this.actionAttribute, action)

        this.createInvalidActionDiagnosticFor(action, textDocument, attributeValueRange)

        return
      }

      const controller = this.controllers.find((controller) => controller.identifier === identifier)

      if (!controller && !this.foundSkippableTags(identifier)) {
        const attributeValueRange = this.attributeValueRange(textDocument, node, this.actionAttribute, identifier)

        this.createInvalidControllerDiagnosticFor(identifier, textDocument, attributeValueRange)
      }

      if (controller && controller.controllerDefinition.hasErrors) return

      if (
        controller &&
        methodName &&
        !controller.controllerDefinition.actionNames.includes(methodName) &&
        !this.foundSkippableTags(methodName)
      ) {
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

      // cannot analyze value if it is interpolated
      if (this.foundSkippableTags(value)) {
        return
      }

      if (attributeMatches && Array.isArray(attributeMatches) && attributeMatches[1]) {
        let identifier = attributeMatches[1]
        let valueName = attributeMatches[2]

        let controller = this.controllers.find((controller) => controller.identifier === identifier)

        if (!controller) {
          const identifierSplits = identifier.split("--")

          let valuePart
          let namespacePart

          // has namespace
          if (identifierSplits.length > 1) {
            namespacePart = identifierSplits.slice(0, -1).join("--")
            valuePart = identifierSplits[identifierSplits.length - 1]
          } else {
            namespacePart = null
            valuePart = identifierSplits[0]
          }

          const allParts = valuePart.split("-").concat(valueName.split("-"))

          for (let i = 1; i <= allParts.length; i++) {
            if (controller) continue

            let potentialIdentifier = allParts.slice(0, i).join("-")

            if (namespacePart) {
              potentialIdentifier = `${namespacePart}--${potentialIdentifier}`
            }

            const potentialValueName = allParts.slice(i, allParts.length).join("-")

            controller = this.controllers.find((controller) => controller.identifier === potentialIdentifier)

            if (controller) {
              identifier = potentialIdentifier
              valueName = potentialValueName
            }
          }
        }

        if (!controller) {
          const attributeNameRange = this.attributeNameRange(textDocument, node, attribute, identifier)
          this.createInvalidControllerDiagnosticFor(identifier, textDocument, attributeNameRange)

          return
        }

        const hasUppercaseLetter = valueName.match(/[A-Z]/g)

        if (hasUppercaseLetter) {
          const attributeNameRange = this.attributeNameRange(textDocument, node, attribute, valueName)
          this.createAttributeFormatMismatchDiagnosticFor(identifier, valueName, textDocument, attributeNameRange)

          return
        }

        const camelizedValueName = camelize(valueName)
        const valueDefiniton = controller.controllerDefinition.values.find(
          (definition) => definition.name === camelizedValueName,
        )

        if (controller && controller.controllerDefinition.hasErrors) return

        if (controller && !valueDefiniton) {
          const attributeNameRange = this.attributeNameRange(textDocument, node, attribute, valueName)
          this.createMissingValueOnControllerDiagnosticFor(
            identifier,
            camelizedValueName,
            textDocument,
            attributeNameRange,
          )

          return
        }

        if (!valueDefiniton) return

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
            camelizedValueName,
            expectedType,
            actualType,
            textDocument,
            attributeValueRange,
          )
        }
      }
    })
  }

  validateDataClassAttribute(_node: Node, _textDocument: TextDocument) {
    // TODO: implement
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

        if (controller && controller.controllerDefinition.hasErrors) return

        if (
          controller &&
          !controller.controllerDefinition.targetNames.includes(targetName) &&
          this.foundSkippableTags(targetName)
        ) {
          const attributeNameRange = this.attributeValueRange(textDocument, node, attribute, targetName)

          this.createMissingTargetOnControllerDiagnosticFor(identifier, targetName, textDocument, attributeNameRange)
        }
      }
    })
  }

  validateValueDefinitions(sourceFile: SourceFile, textDocument: TextDocument) {
    sourceFile.controllerDefinitions.forEach((controller) => {
      if (controller.values.length === 0) return

      controller.values.forEach((valueDefinition) => {
        const range = this.rangeFromLoc(textDocument, valueDefinition.node.loc)
        const defaultValueType = this.parseValueType(valueDefinition.default)

        if (!["Array", "Boolean", "Number", "Object", "String"].includes(valueDefinition.type)) {
          this.pushDiagnostic(
            `Unknown Value type. The "${valueDefinition.name}" value is defined as type "${valueDefinition.type}". \nPossible Values: \`Array\`, \`Boolean\`, \`Number\`, \`Object\`, or \`String\`.\n`,
            "stimulus.controller.value_definition.unknown_type",
            range,
            textDocument,
            {},
            DiagnosticSeverity.Error,
          )

          return
        }

        if (valueDefinition.type !== defaultValueType) {
          const message = dedent`
            The type of the default value you provided doesn't match the type you defined.
            The "${valueDefinition.name}" Stimulus Value is of type \`${valueDefinition.type}\`.
            The default value you provided for "${valueDefinition.name}" is of type \`${defaultValueType}\`.
          `

          this.pushDiagnostic(
            message,
            "stimulus.controller.value_definition.default_value.type_mismatch",
            range,
            textDocument,
            {},
            DiagnosticSeverity.Error,
          )
        }
      })
    })
  }

  visitNode(node: Node, textDocument: TextDocument) {
    this.validateParsedControllerWithoutErrors(node, textDocument)
    this.validateDataControllerAttribute(node, textDocument)
    this.validateDataActionAttribute(node, textDocument)
    this.validateDataValueAttribute(node, textDocument)
    this.validateDataClassAttribute(node, textDocument)
    this.validateDataTargetAttribute(node, textDocument)

    node.children.forEach((child) => {
      this.visitNode(child, textDocument)
    })
  }

  validate(textDocument: TextDocument) {
    if (["javascript", "typescript"].includes(textDocument.languageId)) {
      this.validateJavaScriptDocument(textDocument)
    } else {
      this.validateHTMLDocument(textDocument)
    }

    this.sendDiagnosticsFor(textDocument)
  }

  validateJavaScriptDocument(textDocument: TextDocument) {
    const sourceFile = this.project.projectFiles.find((file) => `file://${file.path}` === textDocument.uri)

    if (sourceFile) {
      this.populateSourceFileErrorsAsDiagnostics(sourceFile, textDocument)
      this.validateValueDefinitions(sourceFile, textDocument)
    }
  }

  validateHTMLDocument(textDocument: TextDocument) {
    const service = getLanguageService()
    const html = service.parseHTMLDocument(textDocument)

    html.roots.forEach((node: Node) => {
      this.visitNode(node, textDocument)
    })
  }

  refreshDocument(document: TextDocument) {
    this.validate(document)
  }

  refreshAllDocuments() {
    this.documentService.getAll().forEach((document) => {
      this.refreshDocument(document)
    })
  }

  private rangeFromLoc(textDocument: TextDocument, loc?: Acorn.SourceLocation | null): Range {
    let range = Range.create(textDocument.positionAt(0), textDocument.positionAt(0))

    if (loc) {
      const start = Position.create(loc.start.line - 1, loc.start.column)
      const end = Position.create(loc.end.line - 1, loc.end.column)

      range = Range.create(start, end)
    }

    return range
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
    search: string,
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
    search: string,
  ) {
    const value = attributeValue(node, attribute) || ""

    const searchIndex = value.indexOf(search) || 0
    const attributeStartIndex = tagContent.indexOf(attribute)

    const attributeValueStart = node.start + attributeStartIndex + attribute.length + searchIndex + 2
    const attributeValueEnd = attributeValueStart + search.length

    return Range.create(textDocument.positionAt(attributeValueStart), textDocument.positionAt(attributeValueEnd))
  }

  private createParseErrorDiagnosticFor(identifier: string, error: string, textDocument: TextDocument, range: Range) {
    this.pushDiagnostic(
      `There was an error parsing the "${identifier}" Stimulus controller. Please check the controller for the following error: ${error}`,
      "stimulus.controller.parse_error",
      range,
      textDocument,
      { identifier },
    )
  }

  private createInvalidControllerDiagnosticFor(identifier: string, textDocument: TextDocument, range: Range) {
    const match = didyoumean(
      identifier,
      this.controllers.map((controller) => controller.identifier),
    )
    const suggestion = match ? `Did you mean "${match}"?` : ""

    this.pushDiagnostic(
      `"${identifier}" isn't a valid Stimulus controller. ${suggestion}`,
      "stimulus.controller.invalid",
      range,
      textDocument,
      { identifier, suggestion: match, textDocument, range },
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
    range: Range,
  ) {
    const controller = this.controllers.find((controller) => controller.identifier === identifier)
    const match = controller ? didyoumean(actionName, controller.controllerDefinition.actionNames) : null
    const suggestion = match ? `Did you mean "${match}"?` : ""

    this.pushDiagnostic(
      `"${actionName}" isn't a valid Controller Action on the "${identifier}" controller. ${suggestion}`,
      "stimulus.controller.action.invalid",
      range,
      textDocument,
      { identifier, actionName, suggestion: match, textDocument, range },
    )
  }

  private createAttributeFormatMismatchDiagnosticFor(
    identifier: string,
    valueName: string,
    textDocument: TextDocument,
    range: Range,
  ) {
    this.pushDiagnostic(
      `The data attribute for "${valueName}" on the "${identifier}" controller is camelCased, but should be dasherized ("${dasherize(valueName)}"). Please use dashes for Stimulus data attributes.`,
      "stimulus.attribute.mismatch",
      range,
      textDocument,
      { identifier, valueName },
    )
  }

  private createMissingValueOnControllerDiagnosticFor(
    identifier: string,
    valueName: string,
    textDocument: TextDocument,
    range: Range,
  ) {
    const controller = this.controllers.find((controller) => controller.identifier === identifier)
    const match = controller ? didyoumean(valueName, Object.keys(controller.controllerDefinition.values)) : null
    const suggestion = match ? `Did you mean "${match}"?` : ""

    this.pushDiagnostic(
      `"${valueName}" isn't a valid Stimulus Value name on the "${identifier}" controller. ${suggestion}`,
      "stimulus.controller.value.missing",
      range,
      textDocument,
      { identifier, valueName },
    )
  }

  private createMissingTargetOnControllerDiagnosticFor(
    identifier: string,
    targetName: string,
    textDocument: TextDocument,
    range: Range,
  ) {
    const controller = this.controllers.find((controller) => controller.identifier === identifier)
    const match = controller ? didyoumean(targetName, controller.controllerDefinition.targetNames) : null
    const suggestion = match ? `Did you mean "${match}"?` : ""

    this.pushDiagnostic(
      `"${targetName}" isn't a valid Stimulus Target on the "${identifier}" controller. ${suggestion}`,
      "stimulus.controller.target.missing",
      range,
      textDocument,
      { identifier, targetName },
    )
  }

  private createValueMismatchOnControllerDiagnosticFor(
    identifier: string,
    valueName: string,
    expectedType: string,
    actualType: string,
    textDocument: TextDocument,
    range: Range,
  ) {
    this.pushDiagnostic(
      `The value you passed for the "${valueName}" Stimulus Value is of type "${actualType}". But the "${valueName}" Stimulus Value defined in the "${identifier}" controller is of type "${expectedType}".`,
      "stimulus.controller.value.type_mismatch",
      range,
      textDocument,
      { identifier, valueName },
    )
  }

  private pushDiagnostic(
    message: string,
    code: string,
    range: Range,
    textDocument: TextDocument,
    data = {},
    severity: DiagnosticSeverity = DiagnosticSeverity.Error,
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

    return diagnostic
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

  private foundSkippableTags(value: string) {
    const skippableTags = ["<%", "<%=", "<%-", "%>", "<?=", "<?php", "?>", "{{", "}}"]
    return skippableTags.some((tag) => value.includes(tag))
  }
}
