import { simple } from "acorn-walk"
import { Parser as AcornParser } from "acorn"
import staticClassFeatures from "acorn-static-class-features"

import { Project } from "./project"
import { ControllerDefinition } from "./controller_definition"
import { NodeElement, PropertyElement } from "./types"

export class Parser {
  private readonly project: Project
  private parser: typeof AcornParser

  constructor(project: Project) {
    this.project = project
    this.parser = AcornParser.extend(staticClassFeatures)
  }

  parse(code: string) {
    return this.parser.parse(code, {
      sourceType: "module",
      ecmaVersion: 2020,
    })
  }

  parseController(code: string, filename: string) {
    const ast = this.parse(code)
    const controller = new ControllerDefinition(this.project, filename)

    simple(ast, {
      MethodDefinition(node: any): void {
        if (node.kind === "method") {
          controller.methods.push(node.key.name)
        }
      },

      PropertyDefinition(node: any): void {
        const { name } = node.key

        if (name === "targets") {
          controller.targets = node.value.elements.map((element: NodeElement) => element.value)
        }

        if (name === "classes") {
          controller.classes = node.value.elements.map((element: NodeElement) => element.value)
        }

        if (name === "values") {
          node.value.properties.forEach((property: PropertyElement) => {
            controller.values[property.key.name] = property.value.name
          })
        }
      },
    })

    return controller
  }
}
