import { Range, DefinitionParams, Location } from 'vscode-languageserver/node';
import { getLanguageService } from 'vscode-html-languageservice';

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

    const controllerIdentifier = node.attributes && node.attributes["data-controller"]

    if (!controllerIdentifier) return

    const identifier = controllerIdentifier.substring(1, controllerIdentifier.length - 1)
    const controller = this.controllers.find(controller => controller.identifier === identifier)

    if (!controller) return

    return Location.create(controller.path, Range.create(0, 0, 0, 0));
  }
}
