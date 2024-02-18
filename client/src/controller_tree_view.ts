import {
  TreeView,
  TreeItem,
  TreeItemCollapsibleState,
  TreeDataProvider,
  Disposable,
  ThemeIcon,
  EventEmitter,
  Uri,
  Event,
} from "vscode"

import * as vscode from "vscode"

import { Client } from "./client"

class ControllerTreeItem extends TreeItem {
  constructor(identifier: string, path: string) {
    super(identifier, TreeItemCollapsibleState.None)

    this.tooltip = path
    this.id = `${path}-${identifier}`
    this.iconPath = new ThemeIcon("outline-view-icon")
    this.resourceUri = Uri.parse(`file://${path}`)

    this.command = {
      command: "vscode.open",
      title: "Open",
      arguments: [this.resourceUri],
    }
  }
}

export class ControllerTreeView implements TreeDataProvider<ControllerTreeItem>, Disposable {
  private client: Client
  private readonly treeView: TreeView<ControllerTreeItem>
  private readonly subscriptions: Disposable[] = []
  private _onDidChangeTreeData: EventEmitter<any> = new EventEmitter<any>()
  readonly onDidChangeTreeData: Event<any> = this._onDidChangeTreeData.event

  constructor(client: Client) {
    this.client = client

    this.treeView = vscode.window.createTreeView("controllerDefinitions", {
      treeDataProvider: this,
      showCollapseAll: true,
    })

    vscode.commands.registerCommand("controllerDefinitions.refreshEntry", () => this.refresh())

    this.subscriptions.push(
      this.treeView.onDidChangeVisibility(() => this.refresh()),
      vscode.workspace.onDidRenameFiles(() => this.refresh()),
      vscode.workspace.onDidSaveTextDocument(() => this.refresh()),
    )
  }

  dispose() {
    this.subscriptions.forEach((item) => item.dispose())
    this.treeView.dispose()
  }

  getTreeItem(element: ControllerTreeItem) {
    return element
  }

  getChildren(_element?: ControllerTreeItem) {
    return this.requestControllerDefinitions()
  }

  refresh() {
    this._onDidChangeTreeData.fire(undefined)
  }

  private async requestControllerDefinitions(): Promise<ControllerTreeItem[]> {
    const controllerDefinitions = await this.client.requestControllerDefinitions()

    return controllerDefinitions.map(({ path, identifier }) => new ControllerTreeItem(identifier, path))
  }
}
