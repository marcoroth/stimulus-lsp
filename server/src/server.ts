import {
  createConnection,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  DidChangeWatchedFilesNotification,
  TextDocumentSyncKind,
  InitializeResult,
  Diagnostic,
  Position,
} from "vscode-languageserver/node"

import { Service } from "./service"
import { StimulusSettings } from "./settings"
import { RegisteredController, ControllerDefinition } from "stimulus-parser"

import type {
  ControllerDefinition as ControllerDefinitionRequestType,
  ControllerDefinitionsRequest,
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
        commands: ["stimulus.controller.create", "stimulus.controller.update"],
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
    watchers: service.stimulusDataProvider.controllerRoots.map((root) => ({ globPattern: `**/${root}/**/*` })),
  })

  connection.client.register(DidChangeWatchedFilesNotification.type, {
    watchers: [{ globPattern: `**/**/*.{ts,js}` }],
  })
})

connection.onDidChangeConfiguration((change) => {
  if (service.settings.hasConfigurationCapability) {
    // Reset all cached document settings
    service.settings.documentSettings.clear()
  } else {
    service.settings.globalSettings = <StimulusSettings>(
      (change.settings.languageServerStimulus || service.settings.defaultSettings)
    )
  }

  service.refresh()
})

connection.onDidOpenTextDocument((params) => {
  const document = service.documentService.get(params.textDocument.uri)

  if (document) {
    service.diagnostics.refreshDocument(document)
  }
})

connection.onDidChangeWatchedFiles(() => service.refresh())
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
  async (_request: ControllerDefinitionsRequest): Promise<ControllerDefinitionsResponse> => {
    const sort = (a: ControllerDefinitionRequestType, b: ControllerDefinitionRequestType) =>
      a.identifier.localeCompare(b.identifier)

    const mapRegisteredController = ({ path, identifier, classDeclaration: { node } }: RegisteredController) => ({
      path,
      identifier,
      registered: true,
      position: Position.create(node?.loc?.start.line || 1, node?.loc?.start.column || 1),
    })

    const mapControllerDefinition = ({
      path,
      guessedIdentifier,
      classDeclaration: { node },
    }: ControllerDefinition) => ({
      path,
      identifier: guessedIdentifier,
      registered: false,
      position: Position.create(node?.loc?.start.line || 1, node?.loc?.start.column || 1),
    })

    const registeredControllerPaths = service.project.registeredControllers.map((c) => c.path)
    const unregisteredControllerDefinitions = service.project.controllerDefinitions.filter(
      (definition) => !registeredControllerPaths.includes(definition.path),
    )

    const registered = service.project.registeredControllers.map(mapRegisteredController).sort(sort)
    const unregistered = unregisteredControllerDefinitions.map(mapControllerDefinition).sort(sort)

    const nodeModules = service.project.detectedNodeModules
      .map(({ name, controllerDefinitions }) => ({
        name,
        controllerDefinitions: controllerDefinitions
          .filter((definition) => !registeredControllerPaths.includes(definition.path))
          .map(mapControllerDefinition)
          .sort(sort),
      }))
      .filter((m) => m.controllerDefinitions.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name))

    return {
      registered: {
        name: "project",
        controllerDefinitions: registered,
      },
      unregistered: {
        project: {
          name: "project",
          controllerDefinitions: unregistered,
        },
        nodeModules,
      },
    }
  },
)

// Listen on the connection
connection.listen()
