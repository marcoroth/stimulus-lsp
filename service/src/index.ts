import * as fs from 'fs'
import glob from 'glob'

import { Parser, Node as _AcornNode } from "acorn"
import staticClassFeatures from 'acorn-static-class-features'
import { simple } from "acorn-walk"

// TODO: unify types with types from server
interface ControllerDeclaration {
  identifier: string
  dasherized: string
  methods: Array<string>
  targets: Array<string>
  classes: Array<string>
  values: {[key: string]: string}
}

interface NodeElement {
  value: string
}

interface PropertyElement {
  key: {
    name: string
  }
  value: {
    name: string
  }
}

interface AstNode {
  kind: string
  value: {
    name: string
    elements: Array<NodeElement>
    properties: Array<PropertyElement>
  }
  key: {
    name: string
  }
}

const StimulusParser = Parser.extend(staticClassFeatures)
const folder = "/Users/marcoroth/Development/boxdrop"

export const getValues = () => {
  return [
    { name: "data-controller-from-index" },
    { name: "data-action-from-index" },
    { name: "data-target-from-index" },
  ]
}

glob(`${folder}/**/*_controller.js`, { ignore: `${folder}/node_modules/**/*` }, (_err, files) => {
  files.forEach(file => analyzeController(file))
})

const analyzeController = (file: string) => {
  return fs.readFile(file, 'utf8', (_err, data) => {
    const tree = StimulusParser.parse(data, { sourceType: 'module', ecmaVersion: 2020 })

    const splits = file.split("/")
    const file_name = splits[splits.length - 1]
    const identifier = file_name.split("_controller.js")[0]

    const controller: ControllerDeclaration = {
      identifier: identifier,
      dasherized: dasherize(camelize(identifier)),
      methods: [],
      targets: [],
      classes: [],
      values: {}
    }

    simple(tree, {
      MethodDefinition(node: any): void {
        if (node.kind === "method") {
          controller.methods.push(node.key.name)
        }
      },

      PropertyDefinition(node: any): void {
        const { name } = node.key

        if (name === "targets") {
          controller.targets = node.value.elements.map((e: NodeElement) => e.value)
        }

        if (name === "classes") {
          controller.classes = node.value.elements.map((e: NodeElement) => e.value)
        }

        if (name === "values") {
          node.value.properties.forEach((p: PropertyElement) => {
            controller.values[p.key.name] = p.value.name
          })
        }
      }
    })

    console.log(controller)
  })
}

// TODO refactor into common utils
function camelize(value: string) {
  return value.replace(/(?:[_-])([a-z0-9])/g, (_, char) => char.toUpperCase())
}

// TODO refactor into common utils
function dasherize(value: string) {
  return value.replace(/([A-Z])/g, (_, char) => `-${char.toLowerCase()}`)
}
