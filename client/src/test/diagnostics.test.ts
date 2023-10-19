import * as vscode from "vscode"

import { getDocUri, toRange, assertDiagnostics } from "./helper"

suite("Diagnostics", () => {
  const docUri = getDocUri("unknown-controller.html")

  test.skip("Diagnoses unknown controllers", async () => {
    await assertDiagnostics(docUri, [
      {
        message: `"unknown" isn't a valid Stimulus controller. Did you mean "some"?`,
        range: toRange(0, 0, 0, 0),
        severity: vscode.DiagnosticSeverity.Error,
        source: "Stimulus LSP",
      }
    ])
  })
})
