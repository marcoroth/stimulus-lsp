import { Project } from "./project"
import { identifierForContextKey } from "@hotwired/stimulus-webpack-helpers"

export class ControllerDefinition {
  readonly path: string
  readonly project: Project

  methods: Array<string> = []
  targets: Array<string> = []
  classes: Array<string> = []
  values: { [key: string]: string } = {}

  constructor(project: Project, path: string) {
    this.project = project
    this.path = path
  }

  get controllerPath() {
    return this.project.relativeControllerPath(this.path)
  }

  get identifier() {
    return identifierForContextKey(this.controllerPath) || ""
  }

  get isNamespaced() {
    return this.identifier.includes("--")
  }

  get namespace() {
    const splits = this.identifier.split("--")

    return splits.slice(0, splits.length - 1).join("--")
  }
}
