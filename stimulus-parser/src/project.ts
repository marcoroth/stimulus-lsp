import { ControllerDefinition } from "./controller_definition"
import { Parser } from "./parser"

import * as fs from "fs"
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
    await this.detectControllerFiles()

    this.controllersFiles.forEach((file: ControllerFile) => {
      this.controllerDefinitions.push(this.parser.parseController(file.content, file.filename))
    })
  }

  async detectControllerFiles() {
    const controllerFiles = await glob(`${this.projectPath}/**/*_controller.js`, {
      ignore: `${this.projectPath}/node_modules/**/*`,
    })

    controllerFiles.forEach((filename: string) => {
      fs.readFile(filename, "utf8", (_err: any, content) => {
        this.controllersFiles.push({ filename, content })
      })
    })
  }
}
