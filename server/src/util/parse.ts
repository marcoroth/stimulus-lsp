import { Parser, Node as _AcornNode } from "acorn"
import { simple } from "acorn-walk"

export interface ControllerDeclaration {
  identifier: string
  dasherized: string
  methods: Array<string>
  targets: Array<string>
  classes: Array<string>
  values: {[key: string]: string}
}

export interface NodeElement {
  value: string
}

export interface PropertyElement {
  key: {
    name: string
  }
  value: {
    name: string
  }
}

export const parse = (parser: typeof Parser, data: string, filename: string) => {
  const tree = parser.parse(data, { sourceType: 'module', ecmaVersion: 2020 })

  // TODO also check for namespaced controllers
  const splits = filename.split("/")
  const fileName = splits[splits.length - 1]
  const identifier = fileName.split("_controller.js")[0]

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

  return controller
}

// TODO refactor into common utils
function camelize(value: string) {
  return value.replace(/(?:[_-])([a-z0-9])/g, (_, char) => char.toUpperCase())
}

// TODO refactor into common utils
function dasherize(value: string) {
  return value.replace(/([A-Z])/g, (_, char) => `-${char.toLowerCase()}`)
}
