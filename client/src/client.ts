import * as path from "path"

import { workspace, ExtensionContext } from "vscode"
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient/node"

export class Client {
  private client: LanguageClient
  private serverModule: string
  private languageClientId = "languageServerStimulus"
  private languageClientName = "Stimulus LSP"

  constructor(context: ExtensionContext) {
    this.serverModule = context.asAbsolutePath(path.join("server", "out", "server.js"))

    this.client = new LanguageClient(
      this.languageClientId,
      this.languageClientName,
      this.serverOptions,
      this.clientOptions
    )
  }

  async start() {
    try {
      this.client.start()
    } catch (error: any) {
      console.error(`Error restarting the server: ${error.message}`)
      return
    }
  }

  async stop(): Promise<void> {
    if (this.client) {
      await this.client.stop()
    }
  }

  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  private get debugOptions() {
    return {
      execArgv: ["--nolazy", "--inspect=6009"],
    }
  }

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  private get serverOptions(): ServerOptions {
    return {
      run: {
        module: this.serverModule,
        transport: TransportKind.ipc,
      },
      debug: {
        module: this.serverModule,
        transport: TransportKind.ipc,
        options: this.debugOptions,
      },
    }
  }

  private get clientOptions(): LanguageClientOptions {
    return {
      documentSelector: [
        { scheme: "file", language: "ruby" },
        { scheme: "file", language: "erb" },
        { scheme: "file", language: "blade" },
        { scheme: "file", language: "php" },
        { scheme: "file", language: "html" },
      ],
      synchronize: {
        // Notify the server about file changes to '.clientrc files contained in the workspace
        fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
      },
    }
  }
}
