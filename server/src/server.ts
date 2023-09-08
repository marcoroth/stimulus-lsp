import {
  createConnection,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  TextDocumentSyncKind,
  InitializeResult,
  // TextDocumentPositionParams,
  // CompletionItemKind,
  Diagnostic,
  DiagnosticSeverity
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { getLanguageService, LanguageService } from 'vscode-html-languageservice';

import { StimulusHTMLDataProvider } from './data_providers/stimulus_html_data_provider';
import { Settings, StimulusSettings } from './settings';
import { DocumentService } from './document_service';
import { Diagnostics } from './diagnostics';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

let settings: Settings;
let htmlLanguageService: LanguageService;
let stimulusDataProvider: StimulusHTMLDataProvider;
let diagnostics: Diagnostics;

const documentService = new DocumentService(connection);

connection.onInitialize((params: InitializeParams) => {
  settings = new Settings(params, connection);
  stimulusDataProvider = new StimulusHTMLDataProvider("id", settings.projectPath);
  diagnostics = new Diagnostics(connection, stimulusDataProvider)

  htmlLanguageService = getLanguageService({
    customDataProviders: [
      stimulusDataProvider
    ]
  });

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        resolveProvider: true
      }
    }
  };

  if (settings.hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    };
  }

  return result;
});

connection.onInitialized(() => {
  if (settings.hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }

  if (settings.hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(_event => {
      connection.console.log('Workspace folder change event received.');
    });
  }
});

connection.onDidChangeConfiguration(change => {
  if (settings.hasConfigurationCapability) {
    // Reset all cached document settings
    settings.documentSettings.clear();
  } else {
    settings.globalSettings = <StimulusSettings>(
      (change.settings.languageServerStimulus || settings.defaultSettings)
    );
  }

  // Revalidate all open documents
  if (diagnostics) {
    documentService.getAll().forEach(diagnostics.validateDataControllerAttributes);
  }
});

// Only keep settings for open documents
documentService.onDidClose(e => {
  settings.documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documentService.onDidChangeContent(change => {
  if (diagnostics) {
    diagnostics.validateDataControllerAttributes(change.document);
  }
});

connection.onDidChangeWatchedFiles(_change => {
  // Monitored files have change in VSCode
  connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
// connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
//     // The pass parameter contains the position of the text document in
//     // which code complete got requested. For the example we ignore this
//     // info and always provide the same completion items.
//
//     // textDocumentPosition.position
//     //
//     // document.getText()
//
//     return [
//       {
//         label: document.getText(),
//         kind: CompletionItemKind.File,
//         data: {
//           detail: "abc",
//           documentation: "def"
//         }
//       }
//     ]
//
//     return [
//       {
//         label: `TypeScript ${textDocumentPosition.position.character}:${textDocumentPosition.position.line}`,
//         kind: CompletionItemKind.Text,
//         data: {
//           detail : 'TypeScript details',
//           documentation: 'TypeScript documentation'
//         }
//       },
//       {
//         label: 'JavaScript',
//         kind: CompletionItemKind.Text,
//         data: {
//           detail : 'JavaScript details',
//           documentation: 'JavaScript documentation'
//         },
//       }
//     ];
//   }
// );

connection.onCompletion(async (textDocumentPosition, token) => {
  console.log("onCompletion", token);

  const document = documentService.get(textDocumentPosition.textDocument.uri);

  if (!document) return null;

  return htmlLanguageService.doComplete(
    document,
    textDocumentPosition.position,
    htmlLanguageService.parseHTMLDocument(document)
  );
});


// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
  (item: CompletionItem): CompletionItem => {
    // const { detail, documentation } = item.data


    // if (item.data.detail && item.data.documentation) {
    //   item.detail = item.data.detail
    //   item.documentation = item.data.documentation
    //   item.kind = CompletionItemKind.Class
    // }


    return item;
  }
);

// Listen on the connection
connection.listen();
