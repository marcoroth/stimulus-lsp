import * as vscode from "vscode"

import { getDocUri, assertCompletion } from "./helper"

suite("Completion", () => {
  test("completes data-controller attribute", async () => {
    const docUri = getDocUri("index.html")
    const position = new vscode.Position(1, 23)
    const completions = {
      items: [{ label: "data-controller", kind: vscode.CompletionItemKind.Text }],
    }

    await assertCompletion(docUri, position, completions)
  })
})
