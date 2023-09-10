import {
  createConnection,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  DidChangeWatchedFilesNotification,
  CompletionItem,
  TextDocumentSyncKind,
  InitializeResult,
  Diagnostic,
  DefinitionParams,
} from 'vscode-languageserver/node';

import { Service } from './service';
import { StimulusSettings } from "./settings";

let service: Service;
const connection = createConnection(ProposedFeatures.all);

connection.onInitialize(async (params: InitializeParams) => {
  service = new Service(connection, params);
  await service.init();

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true
      },
      codeActionProvider: true,
      definitionProvider: true,
      executeCommandProvider: {
        commands: ['stimulus.controller.create']
      }
    }
  };

  if (service.settings.hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    };
  }

  return result;
});

connection.onInitialized(() => {
  if (service.settings.hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined);
  }

  if (service.settings.hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(_event => {
      connection.console.log('Workspace folder change event received.');
    });
  }

  connection.client.register(DidChangeWatchedFilesNotification.type, {
    watchers: [
      { globPattern: `**/app/javascript/**/*` },
    ],
  });
});

connection.onDidChangeConfiguration(change => {
  if (service.settings.hasConfigurationCapability) {
    // Reset all cached document settings
    service.settings.documentSettings.clear();
  } else {
    service.settings.globalSettings = <StimulusSettings>(
      (change.settings.languageServerStimulus || service.settings.defaultSettings)
    );
  }

  service.diagnostics.refreshAllDocuments();
});

connection.onDidOpenTextDocument(params => {
  const document = service.documentService.get(params.textDocument.uri)

  if (document) {
    service.diagnostics.refreshDocument(document)
  }
})

connection.onDefinition((params: DefinitionParams) => {
  return service.definitions.onDefinition(params);
});

connection.onDidChangeWatchedFiles(async _change => {
  if (service.stimulusDataProvider) {
    await service.stimulusDataProvider.refresh();
  }

  service.diagnostics.refreshAllDocuments();
});

connection.onCodeAction(params => {
  return service.codeActions.onCodeAction(params);
});

connection.onExecuteCommand(async (params) => {
  if (params.command === "stimulus.controller.create" && params.arguments) {
    const [identifier, diagnostic] = params.arguments as [string, Diagnostic];

    await service.commands.createController(identifier, diagnostic);
  } else {
    return;
  }
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

  const document = service.documentService.get(textDocumentPosition.textDocument.uri);

  if (!document) return null;

  return service.htmlLanguageService.doComplete(
    document,
    textDocumentPosition.position,
    service.htmlLanguageService.parseHTMLDocument(document)
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
