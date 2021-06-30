import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import glob from 'fast-glob'

import chokidar, { FSWatcher } from 'chokidar'
import findUp from 'find-up'
import normalizePath from 'normalize-path'
import minimatch from 'minimatch'


import { URI } from 'vscode-uri'

import {
  createConnection,
  Connection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeWatchedFilesNotification,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  FileChangeType,
  BulkUnregistration,
  CompletionList,
  CompletionParams,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  Disposable
} from 'vscode-languageserver/node';

import { DocumentService } from './document_service'
import { ProjectService } from './project_service'
import { State, Settings } from './util/state'


// import { TextDocument } from 'vscode-languageserver-textdocument';

// import { getLanguageService } from 'vscode-html-languageservice'

export async function createProjectService(folder: string, connection: Connection, params: InitializeParams, documentService: DocumentService): Promise<ProjectService> {
  const disposables: Disposable[] = []

  const state: State = {
    enabled: false,
    editor: {
      connection: connection,
      globalSettings: params.initializationOptions.configuration as Settings,
      userLanguages: params.initializationOptions.userLanguages ? params.initializationOptions.userLanguages : {},

      capabilities: {
        configuration: true,
        diagnosticRelatedInformation: true,
      },

      documents: documentService.documents,

      getConfiguration: async (uri?: string) => {
        const config: Settings = {}
        return config
      },

      // getConfiguration: async (uri?: string) => {
      //   if (documentSettingsCache.has(uri as string)) {
      //     return documentSettingsCache.get(uri as string)
      //   }
      //
      //   let [editor, stimulus] = await Promise.all([
      //     connection.workspace.getConfiguration({
      //       section: 'editor',
      //       scopeUri: uri,
      //     }),
      //     connection.workspace.getConfiguration({
      //       section: 'stimulus',
      //       scopeUri: uri,
      //     })
      //   ])
      //
      //   let config: Settings = { editor, stimulus }
      //   documentSettingsCache.set(uri as string, config)
      //   return (config || ({} as Settings))
      // },

      getDocumentSymbols: (uri: string) => {
        return connection.sendRequest('@/tailwindCSS/getDocumentSymbols', { uri })
      },
    },
  }

  const documentSettingsCache: Map<string, Settings> = new Map()
  let registrations: Promise<BulkUnregistration>

  let chokidarWatcher: FSWatcher
  let ignore = [
    '**/.git/objects/**',
    '**/.git/subtree-cache/**',
    '**/node_modules/**',
    '**/.hg/store/**',
  ]

  function onFileEvents(changes: Array<{ file: string; type: FileChangeType }>): void {
    let needsInit = false
    let needsRebuild = false

    for (let change of changes) {
      let file = normalizePath(change.file)

      for (let ignorePattern of ignore) {
        if (minimatch(file, ignorePattern)) {
          continue
        }
      }

      let isConfigFile = minimatch(file, `**/`)
      let isPackageFile = minimatch(file, '**/package.json')
      // let isDependency = state.dependencies && state.dependencies.includes(change.file)

      if (!isConfigFile && !isPackageFile) continue

      if (change.type === FileChangeType.Created) {
        needsInit = true
        break
      } else if (change.type === FileChangeType.Changed) {
        if (!state.enabled || isPackageFile) {
          needsInit = true
          break
        } else {
          needsRebuild = true
        }
      } else if (change.type === FileChangeType.Deleted) {
        if (!state.enabled || isPackageFile || isConfigFile) {
          needsInit = true
          break
        } else {
          needsRebuild = true
        }
      }
    }

    if (needsInit) {
      tryInit()
    } else if (needsRebuild) {
      tryRebuild()
    }
  }

  chokidarWatcher = chokidar.watch([`**/`, '**/package.json'], {
    cwd: folder,
    ignorePermissionErrors: true,
    ignoreInitial: true,
    ignored: ignore,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 20,
    },
  })

  await new Promise<void>((resolve) => {
    chokidarWatcher.on('ready', () => resolve())
  })

  chokidarWatcher.on('add',    (file) => onFileEvents([{ file, type: FileChangeType.Created }]))
                 .on('change', (file) => onFileEvents([{ file, type: FileChangeType.Changed }]))
                 .on('unlink', (file) => onFileEvents([{ file, type: FileChangeType.Deleted }]))

  disposables.push({
    dispose() {
      chokidarWatcher.close()
    },
  })


  // function registerCapabilities(watchFiles: string[] = []): void {
  //   if (supportsDynamicRegistration(connection, params)) {
  //     if (registrations) {
  //       registrations.then((r) => r.dispose())
  //     }
  //
  //     let capabilities = BulkRegistration.create()
  //
  //     capabilities.add(HoverRequest.type, {
  //       documentSelector: null,
  //     })
  //     capabilities.add(DocumentColorRequest.type, {
  //       documentSelector: null,
  //     })
  //     capabilities.add(CodeActionRequest.type, {
  //       documentSelector: null,
  //     })
  //     capabilities.add(CompletionRequest.type, {
  //       documentSelector: null,
  //       resolveProvider: true,
  //       triggerCharacters: [...TRIGGER_CHARACTERS, state.separator],
  //     })
  //     if (watchFiles.length > 0) {
  //       capabilities.add(DidChangeWatchedFilesNotification.type, {
  //         watchers: watchFiles.map((file) => ({ globPattern: file })),
  //       })
  //     }
  //
  //     registrations = connection.client.register(capabilities)
  //   }
  // }

  function resetState(): void {
    // clearAllDiagnostics(state)

    // Object.keys(state).forEach((key) => {
    //   // Keep `dependencies` to ensure that they are still watched
    //   if (key !== 'editor' && key !== 'dependencies') {
    //     delete state[key as string]
    //   }
    // })

    state.enabled = false
    // registerCapabilities(state.dependencies)
  }

  async function tryInit() {
    try {
      await init()
    } catch (error) {
      resetState()
      new Error(connection.toString() + error.toString())
    }
  }

  async function tryRebuild() {
    try {
      await rebuild()
    } catch (error) {
      resetState()
      new Error(connection.toString() + error.toString())
    }
  }

  function clearRequireCache(): void {

  }

  async function init() {
    clearRequireCache()

    await tryRebuild()
  }

  async function rebuild() {
    clearRequireCache()

    state.controllers = [
      "clipboard",
      "user",
      "slide",
      "test",
      "controller"
    ]

    state.enabled = true
  }

  return {
    state,
    // tryInit,

    // dispose() {
    //   for (let { dispose } of disposables) {
    //     dispose()
    //   }
    // },

    // onUpdateSettings(settings: any): void {
    //   documentSettingsCache.clear()
    //   if (state.enabled) {
    //     updateAllDiagnostics(state)
    //   }
    //   if (settings.editor.colorDecorators) {
    //     registerCapabilities(state.dependencies)
    //   } else {
    //     connection.sendNotification('@/tailwindCSS/clearColors')
    //   }
    // },

    // onHover(params: TextDocumentPositionParams): Promise<Hover> {
    //   if (!state.enabled) return null
    //   let document = documentService.getDocument(params.textDocument.uri)
    //   if (!document) return null
    //   return doHover(state, document, params.position)
    // },

    // onCompletion(params: CompletionParams): Promise<CompletionList> {
    //   if (!state.enabled) return null
    //   let document = documentService.getDocument(params.textDocument.uri)
    //   if (!document) return null
    //   return doComplete(state, document, params.position, params.context)
    // },
    //
    // onCompletionResolve(item: CompletionItem): Promise<CompletionItem> {
    //   if (!state.enabled) return null
    //   return []
    //   // return resolveCompletionItem(state, item)
    // },

    // onCodeAction(params: CodeActionParams): Promise<CodeAction[]> {
    //   if (!state.enabled) return null
    //   return doCodeActions(state, params)
    // },

    // provideDiagnostics: debounce((document: TextDocument) => {
    //   if (!state.enabled) return
    //   provideDiagnostics(state, document)
    // }, 500),

    // async onDocumentColor(params: DocumentColorParams): Promise<ColorInformation[]> {
    //   if (!state.enabled) return []
    //   let document = documentService.getDocument(params.textDocument.uri)
    //   if (!document) return []
    //   return getDocumentColors(state, document)
    // },

    // async onColorPresentation(params: ColorPresentationParams): Promise<ColorPresentation[]> {
    //   let document = documentService.getDocument(params.textDocument.uri)
    //   let className = document.getText(params.range)
    //   let match = className.match(
    //     new RegExp(`-\\[(${colorNames.join('|')}|(?:(?:#|rgba?\\(|hsla?\\())[^\\]]+)\\]$`, 'i')
    //   )
    //   // let match = className.match(/-\[((?:#|rgba?\(|hsla?\()[^\]]+)\]$/i)
    //   if (match === null) return []
    //
    //   let currentColor = match[1]
    //
    //   let isNamedColor = colorNames.includes(currentColor)
    //   let color = fromRatio({
    //     r: params.color.red,
    //     g: params.color.green,
    //     b: params.color.blue,
    //     a: params.color.alpha,
    //   })
    //
    //   let hexValue = color.toHex8String(
    //     !isNamedColor && (currentColor.length === 4 || currentColor.length === 5)
    //   )
    //   if (hexValue.length === 5) {
    //     hexValue = hexValue.replace(/f$/, '')
    //   } else if (hexValue.length === 9) {
    //     hexValue = hexValue.replace(/ff$/, '')
    //   }
    //
    //   let prefix = className.substr(0, match.index)
    //
    //   return [
    //     hexValue,
    //     color.toRgbString().replace(/ /g, ''),
    //     color.toHslString().replace(/ /g, ''),
    //   ].map((value) => ({ label: `${prefix}-[${value}]` }))
    // },
  }
}
