import { Range, DefinitionParams, Location } from 'vscode-languageserver/node';
import { getLanguageService } from 'vscode-html-languageservice';

import { tokenList } from "./html_util"
import { DocumentService } from './document_service';
import { StimulusHTMLDataProvider } from './data_providers/stimulus_html_data_provider';

export class Definitions {
  private readonly documentService: DocumentService
  private readonly stimulusDataProvider: StimulusHTMLDataProvider

  constructor(documentService: DocumentService, stimulusDataProvider: StimulusHTMLDataProvider) {
    this.documentService = documentService
    this.stimulusDataProvider = stimulusDataProvider;
  }

  get controllers() {
    return this.stimulusDataProvider.controllers
  }

  onDefinition(params: DefinitionParams) {
    const uri = params.textDocument.uri

    const textDocument = this.documentService.get(uri)

    if (!textDocument) return

    const html = getLanguageService().parseHTMLDocument(textDocument);
    const offset = textDocument.offsetAt(params.position)
    const node = html.findNodeAt(offset)

    const identifiers = tokenList(node, "data-controller")
    const controllers = this.controllers.filter(controller => identifiers.includes(controller.identifier))
    const locations = controllers.map(controller => Location.create(controller.path, Range.create(0, 0, 0, 0)))

    if (controllers.length === 1) return locations[0]

    return locations
  }
}
