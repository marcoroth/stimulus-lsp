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
  readonly controllerDefinitions: ControllerDefinition[] = []

  private controllersFiles: Array<ControllerFile> = []
  private parser: Parser = new Parser()

  constructor(projectPath: string) {
    this.projectPath = projectPath
  }

  async analyze() {
    await this.readControllerFiles()

    this.controllersFiles.forEach((file: ControllerFile) => {
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

        this.controllersFiles.push({ filename, content })
      })
    )
  }
}
