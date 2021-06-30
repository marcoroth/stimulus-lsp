import * as fs from 'fs'
const { Parser, Node: AcornNode } = require("acorn")

const staticClassFeatures = require('acorn-static-class-features')
const walk  = require("acorn-walk")
// import * as path from "path"
import glob from 'glob'

interface ControllerDeclaration {
  identifier: string
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

glob(`${folder}/**/*_controller.js`, { ignore: `${folder}/node_modules/**/*` }, (_err, files) => {
  files.forEach(file => analyzeController(file))
})

const analyzeController = (file: string) => {
  return fs.readFile(file, 'utf8', (_err, data) => {
    const tree = StimulusParser.parse(data, { sourceType: 'module', ecmaVersion: 2020 })

    const splits = file.split("/")
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

    console.log(controller)
  })
}
