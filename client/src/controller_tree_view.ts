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

import type { ControllerDefinition, ControllerDefinitionsResponse, ControllerDefinitionsOrigin } from "./requests"

type ControllerDefinitionTreeItem = ControllerTreeItem | ControllerDefinitionsStateItem

export class ControllerTreeView implements TreeDataProvider<ControllerDefinitionTreeItem>, Disposable {
  private client: Client
  private readonly treeView: TreeView<ControllerDefinitionTreeItem>
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
    vscode.commands.registerCommand("controllerDefinitions.registerControllerDefinition", (item) =>
      this.registerControllerDefinition(item),
    )

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

  getTreeItem(element: ControllerDefinitionTreeItem) {
    return element
  }

  async getChildren(element?: ControllerDefinitionTreeItem) {
    if (element) {
      return element.getChildren()
    } else {
      const response = await this.requestControllerDefinitions()

      return [
        new ControllerDefinitionsStateItem("Unregistered", [
          response.unregistered.project,
          ...response.unregistered.nodeModules,
        ]),
        new ControllerDefinitionsStateItem("Registered", [response.registered]),
      ]
    }
  }

  refresh() {
    this._onDidChangeTreeData.fire(undefined)
  }

  registerControllerDefinition(item: ControllerTreeItem) {
    if (item.isImportable) {
      this.client.sendRequest("workspace/executeCommand", {
        command: "stimulus.controller.register",
        arguments: [
          item.controllerDefinition.importStatement,
          item.controllerDefinition.identifier,
          item.controllerDefinition.localName,
        ],
      })
    }
  }

  private async requestControllerDefinitions(): Promise<ControllerDefinitionsResponse> {
    return await this.client.requestControllerDefinitions()
  }
}

class ControllerDefinitionsStateItem extends TreeItem {
  public children: ControllerDefinitionsOrigin[] = []

  constructor(name: string, children: ControllerDefinitionsOrigin[]) {
    const collapisbleState =
      name === "Registered" ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.Collapsed

    super(name, collapisbleState)

    this.tooltip = name
    this.children = children

    const controllersCount = this.children.flatMap((c) => c.controllerDefinitions).length
    this.description = `(${controllersCount} controller${controllersCount == 1 ? "" : "s"})`
  }

  getChildren() {
    return this.controllerTreeItems.sort((a, b) => a.label.toString().localeCompare(b.label.toString()))
  }

  private get controllerTreeItems() {
    return this.controllerDefinitions.flatMap(([definition, child]) => new ControllerTreeItem(definition, child))
  }

  private get controllerDefinitions(): [ControllerDefinition, ControllerDefinitionsOrigin][] {
    return this.children
      .map((child) =>
        child.controllerDefinitions.map(
          (definition) => [definition, child] as [ControllerDefinition, ControllerDefinitionsOrigin],
        ),
      )
      .flat(1)
  }
}

class ControllerTreeItem extends TreeItem {
  public registered: boolean = false
  public controllerDefinition: ControllerDefinition

  constructor(item: ControllerDefinition, origin: ControllerDefinitionsOrigin) {
    super(item.identifier, TreeItemCollapsibleState.None)

    this.controllerDefinition = item
    this.id = `${item.path}-${item.identifier}-${item.registered}`
    this.tooltip = item.path
    this.registered = item.registered
    this.iconPath = new ThemeIcon("outline-view-icon")
    this.resourceUri = Uri.parse(`file://${item.path}`)
    this.contextValue = `controllerDefinition-${item.registered ? "registered" : "unregistered"}${this.isImportable ? "importable" : "non-importable"}`

    if (!item.registered) {
      this.description = `(${origin.name})`
    }

    this.command = {
      command: "vscode.open",
      title: "Open",
      arguments: [this.resourceUri],
    }
  }

  get isImportable() {
    return (
      !!this.controllerDefinition.importStatement &&
      !!this.controllerDefinition.identifier &&
      !!this.controllerDefinition.localName
    )
  }

  getChildren() {
    return []
  }
}
