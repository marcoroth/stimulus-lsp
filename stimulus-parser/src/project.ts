import { ControllerDefinition } from "./controller_definition"
import { Parser } from "./parser"

import { promises as fs } from "fs"
import { glob } from "glob"

interface ControllerFile {
  filename: string
  content: string
}

export class Project {
  readonly projectPath: string
  readonly controllerPath = "app/javascript/controllers"

  controllerDefinitions: ControllerDefinition[] = []

  private controllerFiles: Array<ControllerFile> = []
  private parser: Parser = new Parser(this)

  constructor(projectPath: string) {
    this.projectPath = projectPath
  }

  relativePath(path: string) {
    return path.replace(`${this.projectPath}/`, "")
  }

  relativeControllerPath(path: string) {
    return this.relativePath(path).replace(`${this.controllerPath}/`, "")
  }

  async analyze() {
    this.controllerFiles = []
    this.controllerDefinitions = []

    await this.readControllerFiles()

    this.controllerFiles.forEach((file: ControllerFile) => {
      this.controllerDefinitions.push(this.parser.parseController(file.content, file.filename))
    })
  }

  private async readControllerFiles() {
    const controllerFiles = await glob(`${this.projectPath}/**/*_controller.js`, {
      ignore: `${this.projectPath}/node_modules/**/*`,
    })

    await Promise.allSettled(
      controllerFiles.map(async (filename: string) => {
        const content = await fs.readFile(filename, "utf8")

        this.controllerFiles.push({ filename, content })
      })
    )
  }
}
