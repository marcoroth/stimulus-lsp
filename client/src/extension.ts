import { ExtensionContext } from "vscode"
import { Client } from "./client"

let client: Client

export async function activate(context: ExtensionContext) {
  client = new Client(context)

  await client.start()
}

export async function deactivate(): Promise<void> {
  if (client) {
    await client.stop()
  } else {
    return undefined
  }
}
