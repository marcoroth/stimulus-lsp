import { simple } from "acorn-walk"
import { Parser as AcornParser } from "acorn"
import staticClassFeatures from "acorn-static-class-features"

import { dasherize, camelize } from "./util"

import { ControllerDefinition } from "./controller_definition"
import { NodeElement, PropertyElement } from "./types"

export class Parser {
  private parser: typeof AcornParser

  constructor() {
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

    // TODO also check for namespaced controllers
    const splits = filename.split("/")
    const fileName = splits[splits.length - 1]
    const identifier = fileName.split("_controller.js")[0]

    const controller: ControllerDefinition = {
      path: filename,
      identifier: identifier,
      dasherized: dasherize(camelize(identifier)),
      methods: [],
      targets: [],
      classes: [],
      values: {},
    }

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
