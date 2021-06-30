import {
  Connection,
  InitializeParams,
  CompletionItem,
  CompletionList,
  CompletionParams
} from 'vscode-languageserver/node';

import { createProjectService } from './create_project_service'
import { ProjectService } from './project_service'
import { DocumentService } from './document_service'

export class StimulusExtension {
  private initialized = false
  private workspaces: Map<string, { name: string; workspaceFsPath: string }>
  private projects: Map<string, ProjectService>
  private documentService: DocumentService
  // public initializeParams: InitializeParams

  constructor(private connection: Connection) {
    this.documentService = new DocumentService(this.connection)
    this.workspaces = new Map()
    this.projects = new Map()
  }

  async init(): Promise<void> {
    if (this.initialized) return

    this.initialized = true

    // TODO
    // const workspaceFolders =
    //   false &&
    //   Array.isArray(this.initializeParams.workspaceFolders) &&
    //   this.initializeParams.capabilities.workspace?.workspaceFolders
    //     ? this.initializeParams.workspaceFolders.map((el) => ({
    //         name: el.name,
    //         fsPath: getFileFsPath(el.uri),
    //       }))
    //     : this.initializeParams.rootPath
    //     ? [{ name: '', fsPath: normalizeFileNameToFsPath(this.initializeParams.rootPath) }]
    //     : []

    // if (workspaceFolders.length === 0) {
    //   console.error('No workspace folders found, not initializing.')
    //   return
    // }
    //
    // await Promise.all(
    //   workspaceFolders.map(async (folder) => {
    //     return this.addProject(folder.fsPath, this.initializeParams)
    //   })
    // )

    this.setupLSPHandlers()

    // this.connection.onDidChangeConfiguration(async ({ settings }) => {
    //   for (let [, project] of this.projects) {
    //     project.onUpdateSettings(settings)
    //   }
    // })

    // this.connection.onShutdown(() => {
    //   this.dispose()
    // })

    // this.documentService.onDidChangeContent((change) => {
    //   const project = Array.from(this.projects.values())[0]
    //   project?.provideDiagnostics(change.document)
    // })
  }

  // private async addProject(folder: string, params: InitializeParams): Promise<void> {
  //   if (this.projects.has(folder)) {
  //     await this.projects.get(folder).tryInit()
  //   } else {
  //     const project = await createProjectService(
  //       folder,
  //       this.connection,
  //       params,
  //       this.documentService
  //     )
  //     await project.tryInit()
  //     this.projects.set(folder, project)
  //   }
  // }

  private setupLSPHandlers() {
    // this.connection.onHover(this.onHover.bind(this))
    // this.connection.onCompletion(this.onCompletion.bind(this))
    // this.connection.onCompletionResolve(this.onCompletionResolve.bind(this))
    // this.connection.onDocumentColor(this.onDocumentColor.bind(this))
    // this.connection.onColorPresentation(this.onColorPresentation.bind(this))
    // this.connection.onCodeAction(this.onCodeAction.bind(this))
  }

  // async onDocumentColor(params: DocumentColorParams): Promise<ColorInformation[]> {
  //   const project = Array.from(this.projects.values())[0]
  //   return project?.onDocumentColor(params) ?? []
  // }

  // async onColorPresentation(params: ColorPresentationParams): Promise<ColorPresentation[]> {
  //   const project = Array.from(this.projects.values())[0]
  //   return project?.onColorPresentation(params) ?? []
  // }

  // async onHover(params: TextDocumentPositionParams): Promise<Hover> {
  //   const project = Array.from(this.projects.values())[0]
  //   return project?.onHover(params) ?? null
  // }

  // async onCompletion(params: CompletionParams): Promise<CompletionList> {
  //   const project = Array.from(this.projects.values())[0]
  //   return project?.onCompletion(params) ?? null
  // }

  // async onCompletionResolve(item: CompletionItem): Promise<CompletionItem> {
  //   const project = Array.from(this.projects.values())[0]
  //   return project?.onCompletionResolve(item) ?? null
  // }

  // onCodeAction(params: CodeActionParams): Promise<CodeAction[]> {
  //   const project = Array.from(this.projects.values())[0]
  //   return project?.onCodeAction(params) ?? null
  // }

  listen() {
    this.connection.listen()
  }

  // dispose(): void {
  //   for (let [, project] of this.projects) {
  //     project.dispose()
  //   }
  // }
}
