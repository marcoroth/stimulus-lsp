const { Parser, Node: AcornNode } = require("acorn")
const walk = require("acorn-walk")

export interface ControllerDeclaration {
  identifier: string
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

  const splits = filename.split("/")
  const file_name = splits[splits.length - 1]

  const controller: ControllerDeclaration = {
    identifier: file_name.split("_controller.js")[0],
    methods: [],
    targets: [],
    classes: [],
    values: {}
  }

  walk.simple(tree, {
    MethodDefinition(node: typeof AcornNode) {
      if (node.kind === "method") {
        controller.methods.push(node.key.name)
      }
    },

    PropertyDefinition(node: typeof AcornNode) {
      const { name } = node.key

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
