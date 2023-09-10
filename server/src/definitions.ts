import { Range, DefinitionParams, Location } from 'vscode-languageserver/node';
import { getLanguageService } from 'vscode-html-languageservice';

import { tokenList, reverseString } from "./html_util";
import { DocumentService } from './document_service';
import { StimulusHTMLDataProvider } from './data_providers/stimulus_html_data_provider';

export class Definitions {
  private readonly documentService: DocumentService
  private readonly stimulusDataProvider: StimulusHTMLDataProvider

  constructor(documentService: DocumentService, stimulusDataProvider: StimulusHTMLDataProvider) {
    this.documentService = documentService;
    this.stimulusDataProvider = stimulusDataProvider;
  }

  get controllers() {
    return this.stimulusDataProvider.controllers;
  }

  onDefinition(params: DefinitionParams) {
    const uri = params.textDocument.uri;

    const textDocument = this.documentService.get(uri);

    if (!textDocument) return;

    const html = getLanguageService().parseHTMLDocument(textDocument);
    const offset = textDocument.offsetAt(params.position);
    const node = html.findNodeAt(offset);
    const content = textDocument.getText();

    let identifier: string;
    let identifiers: string[];

    const attributeStart = this.previousIndex(content, ["'", '"'], offset);
    const attributeEnd = this.nextIndex(content, ["'", '"'], offset);

    const value = content.substring(attributeStart, attributeEnd);

    if (!value.includes(" ")) {
      identifier = value;
    } else {
      identifier = value.substring(
        this.previousIndex(value, [" "], offset - attributeStart),
        this.nextIndex(value, [" "], offset - attributeStart),
      );
    }

    if (this.controllers.map(controller => controller.identifier).includes(identifier)) {
      identifiers = [identifier]
    } else {
      identifiers = tokenList(node, "data-controller");
    }

    const controllers = this.controllers.filter(controller => identifiers.includes(controller.identifier));
    const locations = controllers.map(controller => Location.create(controller.path, Range.create(0, 0, 0, 0)));

    if (controllers.length === 1) return locations[0];

    return locations;
  }

  private nextIndex(string: string, tokens: string[], offset: number) {
    const indexes = tokens.map(token => string.indexOf(token, offset)).filter(i => i !== -1);

    if (indexes.length === 0) return string.length;

    return Math.min(...indexes);
  }

  private previousIndex(string: string, tokens: string[], offset: number) {
    const indexes = tokens.map(token => reverseString(string).indexOf(token, string.length - offset)).filter(i => i !== -1).map(i => string.length - i);

    if (indexes.length === 0) return 0;

    return Math.min(...indexes);
  }
}
