import { Herb } from "@herb-tools/node-wasm"
import { Range, DefinitionParams, LocationLink } from "vscode-languageserver/node"
import { DocumentService } from "./document_service"
import { StimulusHTMLDataProvider } from "./data_providers/stimulus_html_data_provider"

import { getLanguageService } from "@herb-tools/language-service"
import { parseActionDescriptorString } from "./action_descriptor"
import { tokenList, reverseString } from "./html_util"

import type { Node, HerbHTMLNode } from "@herb-tools/language-service"
import type { TextDocument } from "vscode-languageserver-textdocument"

export class Definitions {
  private readonly documentService: DocumentService
  private readonly stimulusDataProvider: StimulusHTMLDataProvider

  constructor(documentService: DocumentService, stimulusDataProvider: StimulusHTMLDataProvider) {
    this.documentService = documentService
    this.stimulusDataProvider = stimulusDataProvider
  }

  get controllers() {
    return this.stimulusDataProvider.controllers
  }

  onDefinition(params: DefinitionParams) {
    const textDocument = this.documentService.get(params.textDocument.uri)
    if (!textDocument) return

    const html = getLanguageService({ herb: Herb }).parseHTMLDocument(textDocument)
    const offset = textDocument.offsetAt(params.position)
    const node = html.findNodeAt(offset)
    const content = textDocument.getText()

    const attributeNameResult = this.resolveAttributeNameDefinition(node, offset, content, textDocument)
    if (attributeNameResult) return attributeNameResult

    const herbNode = node as HerbHTMLNode
    let activeAttribute: string | null = null

    if (herbNode.attributeSourceRanges) {
      for (const [name, range] of Object.entries(herbNode.attributeSourceRanges)) {
        if (offset >= range.valueStart && offset <= range.valueEnd) {
          activeAttribute = name
          break
        }
      }
    }

    if (!activeAttribute) return []

    const attributeStart = this.previousIndex(content, ["'", '"'], offset)
    const attributeEnd = this.nextIndex(content, ["'", '"'], offset)
    const fullValue = content.substring(attributeStart, attributeEnd)

    let token: string
    let tokenStart: number

    if (!fullValue.includes(" ")) {
      token = fullValue
      tokenStart = attributeStart
    } else {
      const relativeStart = this.previousIndex(fullValue, [" "], offset - attributeStart)
      const relativeEnd = this.nextIndex(fullValue, [" "], offset - attributeStart)

      token = fullValue.substring(relativeStart, relativeEnd)
      tokenStart = attributeStart + relativeStart
    }

    if (activeAttribute === "data-action") {
      return this.resolveActionDefinition(token, tokenStart, offset, textDocument)
    }

    if (activeAttribute === "data-controller") {
      return this.resolveControllerDefinition(token, tokenStart, node, textDocument)
    }

    return []
  }

  private resolveAttributeNameDefinition(
    node: Node,
    offset: number,
    _content: string,
    textDocument: TextDocument,
  ): LocationLink[] | null {
    const herbNode = node as HerbHTMLNode
    if (!herbNode.attributeSourceRanges) return null

    for (const [attributeName, sourceRange] of Object.entries(herbNode.attributeSourceRanges)) {
      if (offset < sourceRange.nameStart || offset > sourceRange.nameEnd) continue

      if (!attributeName.startsWith("data-")) return []
      if (attributeName === "data-controller" || attributeName === "data-action") return []
      if (attributeName.startsWith("aria-")) return []

      const withoutPrefix = attributeName.slice(5)
      const identifier = this.findControllerIdentifierInAttribute(withoutPrefix)

      if (!identifier) continue

      const nameRange = herbNode.getAttributeNameRange(attributeName)
      if (!nameRange) continue

      const source = textDocument.getText()
      const nameInSource = source.slice(nameRange.start, nameRange.end)

      const identifierUnderscored = identifier.replace(/-/g, "_")
      const identifierPosition = nameInSource.indexOf(identifierUnderscored) !== -1
        ? nameInSource.indexOf(identifierUnderscored)
        : nameInSource.indexOf(identifier) !== -1
          ? nameInSource.indexOf(identifier)
          : 0

      const identifierLength = nameInSource.indexOf(identifierUnderscored) !== -1
        ? identifierUnderscored.length
        : identifier.length

      const originRange = Range.create(
        textDocument.positionAt(nameRange.start + identifierPosition),
        textDocument.positionAt(nameRange.start + identifierPosition + identifierLength),
      )

      return this.controllerLinks([identifier], originRange)
    }

    return null
  }

  private findControllerIdentifierInAttribute(withoutPrefix: string): string | null {
    const suffixes = ["-target", "-class"]
    const controllerIdentifiers = this.controllers.map((controller) => controller.identifier)

    for (const suffix of suffixes) {
      if (withoutPrefix.endsWith(suffix)) {
        const candidate = withoutPrefix.slice(0, -suffix.length)

        if (controllerIdentifiers.includes(candidate)) {
          return candidate
        }
      }
    }

    if (withoutPrefix.endsWith("-value")) {
      const withoutValue = withoutPrefix.slice(0, -6)
      const parts = withoutValue.split("-")

      for (let splitIndex = 1; splitIndex < parts.length; splitIndex++) {
        const candidate = parts.slice(0, splitIndex).join("-")

        if (controllerIdentifiers.includes(candidate)) {
          return candidate
        }
      }
    }

    if (controllerIdentifiers.includes(withoutPrefix)) {
      return withoutPrefix
    }

    return null
  }

  private resolveControllerDefinition(
    identifier: string,
    identifierStart: number,
    node: Node,
    textDocument: TextDocument,
  ): LocationLink[] {
    let identifiers: string[]

    if (this.controllers.some((controller) => controller.identifier === identifier)) {
      identifiers = [identifier]
    } else {
      identifiers = tokenList(node, "data-controller")
    }

    const originRange = Range.create(
      textDocument.positionAt(identifierStart),
      textDocument.positionAt(identifierStart + identifier.length),
    )

    return this.controllerLinks(identifiers, originRange)
  }

  private resolveActionDefinition(
    actionString: string,
    actionStringStart: number,
    cursorOffset: number,
    textDocument: TextDocument,
  ): LocationLink[] {
    const descriptor = parseActionDescriptorString(actionString)

    if (!descriptor.identifier || !descriptor.methodName) return []

    const arrowIndex = actionString.indexOf("->")
    const hashIndex = actionString.indexOf("#")

    const cursorRelative = cursorOffset - actionStringStart

    if (arrowIndex !== -1 && cursorRelative < arrowIndex) {
      return []
    }

    if (hashIndex !== -1 && cursorRelative > hashIndex) {
      const methodStart = actionStringStart + hashIndex + 1
      const colonIndex = actionString.indexOf(":", hashIndex)
      const methodEnd = colonIndex !== -1
        ? actionStringStart + colonIndex
        : actionStringStart + actionString.length

      const originRange = Range.create(
        textDocument.positionAt(methodStart),
        textDocument.positionAt(methodEnd),
      )

      return this.methodLinks(descriptor.identifier, descriptor.methodName, originRange)
    }

    const identifierStart = arrowIndex !== -1
      ? actionStringStart + arrowIndex + 2
      : actionStringStart

    const identifierEnd = hashIndex !== -1
      ? actionStringStart + hashIndex
      : actionStringStart + actionString.length

    const originRange = Range.create(
      textDocument.positionAt(identifierStart),
      textDocument.positionAt(identifierEnd),
    )

    return this.controllerLinks([descriptor.identifier], originRange)
  }

  private controllerLinks(identifiers: string[], originRange: Range): LocationLink[] {
    const controllers = this.controllers.filter(
      (controller) => identifiers.includes(controller.identifier),
    )

    return controllers.map((controller) =>
      LocationLink.create(
        `file://${controller.path}`,
        Range.create(0, 0, 0, 0),
        Range.create(0, 0, 0, 0),
        originRange,
      ),
    )
  }

  private methodLinks(identifier: string, methodName: string, originRange: Range): LocationLink[] {
    const controller = this.controllers.find(
      (controller) => controller.identifier === identifier,
    )

    if (!controller) return []

    const methodDefinition = controller.controllerDefinition.methodDefinitions.find(
      (method: any) => method.name === methodName,
    )

    if (methodDefinition?.node?.loc) {
      const targetRange = Range.create(
        methodDefinition.node.loc.start.line - 1,
        methodDefinition.node.loc.start.column,
        methodDefinition.node.loc.end.line - 1,
        methodDefinition.node.loc.end.column,
      )

      return [
        LocationLink.create(
          `file://${controller.path}`,
          targetRange,
          targetRange,
          originRange,
        ),
      ]
    }

    return this.controllerLinks([identifier], originRange)
  }

  private nextIndex(string: string, tokens: string[], offset: number) {
    const indexes = tokens
      .map((token) => string.indexOf(token, offset))
      .filter((index) => index !== -1)

    if (indexes.length === 0) return string.length

    return Math.min(...indexes)
  }

  private previousIndex(string: string, tokens: string[], offset: number) {
    const indexes = tokens
      .map((token) => reverseString(string).indexOf(token, string.length - offset))
      .filter((index) => index !== -1)
      .map((index) => string.length - index)

    if (indexes.length === 0) return 0

    return Math.min(...indexes)
  }
}
