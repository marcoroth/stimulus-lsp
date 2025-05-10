import {
  createConnection,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  DidChangeWatchedFilesNotification,
  TextDocumentSyncKind,
  InitializeResult,
  Diagnostic,
} from "vscode-languageserver/node"

import { Service } from "./service"
import { StimulusSettings } from "./settings"

import { ControllerDefinitionsRequest } from "./requests/controller_definitions"

import type {
  ControllerDefinitionsRequest as ControllerDefinitionsRequestType,
  ControllerDefinitionsResponse,
} from "./requests"

let service: Service
const connection = createConnection(ProposedFeatures.all)

connection.onInitialize(async (params: InitializeParams) => {
  service = new Service(connection, params)
  await service.init()

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: { resolveProvider: true },
      codeLensProvider: { resolveProvider: true },
      codeActionProvider: true,
      definitionProvider: true,
      executeCommandProvider: {
        commands: [
          "stimulus.controller.create",
          "stimulus.controller.update",
          "stimulus.controller.register",
          "stimulus.controller.action.update",
          "stimulus.controller.action.implement",
          "stimulus.config.create",
          "stimulus.config.controller.ignore",
          "stimulus.config.attribute.ignore",
          "stimulus.import.source.update",
        ],
      },
    },
  }

  if (service.settings.hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    }
  }

  return result
})

connection.onInitialized(() => {
  if (service.settings.hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(DidChangeConfigurationNotification.type, undefined)
  }

  if (service.settings.hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log("Workspace folder change event received.")
    })
  }

  connection.client.register(DidChangeWatchedFilesNotification.type, {
    watchers: service.project.controllerRoots.map((root) => ({ globPattern: `**/${root}/**/*` })),
  })

  connection.client.register(DidChangeWatchedFilesNotification.type, {
    watchers: [
      { globPattern: `**/**/*.{ts,js}` },
      { globPattern: `**/**/.stimulus-lsp/config.json` },
    ],
  })
})

connection.onDidChangeConfiguration((change) => {
  if (service.settings.hasConfigurationCapability) {
    // Reset all cached document settings
    service.settings.documentSettings.clear()
  } else {
    service.settings.globalSettings = (
      (change.settings.languageServerStimulus || service.settings.defaultSettings)
    ) as StimulusSettings
  }

  service.refresh()
})

connection.onDidOpenTextDocument((params) => {
  const document = service.documentService.get(params.textDocument.uri)

  if (document) {
    service.diagnostics.refreshDocument(document)
  }
})


connection.onDidChangeWatchedFiles((params) => {
  params.changes.forEach(async (event) => {
    if (event.uri.endsWith("/.stimulus-lsp/config.json")) {
      await service.refreshConfig()

      service.documentService.getAll().forEach((document) => {
        service.diagnostics.refreshDocument(document)
      })
    }
  })
})

connection.onDefinition((params) => service.definitions.onDefinition(params))
connection.onCodeAction((params) => service.codeActions.onCodeAction(params))
connection.onCodeLens((params) => service.codeLens.onCodeLens(params))
connection.onCodeLensResolve((codeLens) => service.codeLens.onCodeLensResolve(codeLens))

connection.onExecuteCommand((params) => {
  if (!params.arguments) return

  if (params.command === "stimulus.controller.create") {
    const [identifier, diagnostic, controllerRoot] = params.arguments as [string, Diagnostic, string]

    service.commands.createController(identifier, diagnostic, controllerRoot)
  }

  if (params.command === "stimulus.controller.update") {
    const [identifier, diagnostic, suggestion] = params.arguments as [string, Diagnostic, string]

    service.commands.updateControllerReference(identifier, diagnostic, suggestion)
  }

  if (params.command === "stimulus.controller.action.update") {
    const [actionName, diagnostic, suggestion] = params.arguments as [string, Diagnostic, string]

    service.commands.updateControllerActionReference(actionName, diagnostic, suggestion)
  }

  if (params.command === "stimulus.controller.action.implement") {
    const [identifer, actionName, diagnostic] = params.arguments as [string, string, Diagnostic]

    service.commands.implementControllerAction(identifer, actionName, diagnostic)
  }

  if (params.command === "stimulus.import.source.update") {
    const [diagnostic] = params.arguments as [Diagnostic]

    service.commands.updateImportSource(diagnostic)
  }

  if (params.command === "stimulus.config.create") {
    const [_identifier, _diagnostic] = params.arguments as [string, Diagnostic]

    service.commands.createStimulusLSPConfig()
  }

  if (params.command === "stimulus.config.controller.ignore") {
    const [identifier, _diagnostic] = params.arguments as [string, Diagnostic]

    service.commands.addIgnoredControllerToConfig(identifier)
  }

  if (params.command === "stimulus.config.attribute.ignore") {
    const [attribute, _diagnostic] = params.arguments as [string, Diagnostic]

    service.commands.addIgnoredAttributeToConfig(attribute)
  }

  if (params.command === "stimulus.controller.register") {
    const [importStatement, identifier, localName] = params.arguments as [string, string, string]

    service.commands.registerControllerDefinition(importStatement, identifier, localName)
  }
})

connection.onCompletion((textDocumentPosition) => {
  const document = service.documentService.get(textDocumentPosition.textDocument.uri)

  if (!document) return null

  return service.htmlLanguageService.doComplete(
    document,
    textDocumentPosition.position,
    service.htmlLanguageService.parseHTMLDocument(document),
  )
})

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item) => {
  if (item.data?.detail) item.detail = item.data.detail
  if (item.data?.documentation) item.documentation = item.data.documentation
  if (item.data?.kind) item.kind = item.data.kind

  return item
})

connection.onRequest(
  "stimulus-lsp/controllerDefinitions",
  (request: ControllerDefinitionsRequestType): Promise<ControllerDefinitionsResponse> =>
    new ControllerDefinitionsRequest(service).handleRequest(request),
)

// Listen on the connection
connection.listen()
