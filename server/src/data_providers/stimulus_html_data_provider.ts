import { IHTMLDataProvider } from 'vscode-html-languageservice'
import { EVENTS } from '../events'

import * as fs from 'fs';
import glob from 'glob'

const { Parser } = require("acorn")
const staticClassFeatures = require('acorn-static-class-features')

import { parse, ControllerDeclaration } from '../util/parse'

export class StimulusHTMLDataProvider implements IHTMLDataProvider {
  private folder: string
  private controllers: Array<ControllerDeclaration> = []
  private controllersPaths: Array<string> = []
  private parser: typeof Parser = Parser.extend(staticClassFeatures)

  constructor(private id: string, private projectPath: string) {
    this.folder = this.projectPath.replace("file://", "")

    glob(`${this.folder}/**/*_controller.js`, { ignore: `${this.folder}/node_modules/**/*` }, (_err, files) => {
      files.forEach(file => {
        this.controllersPaths.push(file)
        this.analyzeController(file)
      })
    })
  }

  analyzeController (file: string) {
    return fs.readFile(file, 'utf8', (_err, data) => {
      const controller = parse(this.parser, data, file)
      this.controllers.push(controller)
    })
  }

  isApplicable() {
    return true
  }

  getId() {
    return this.id
  }

  provideTags() {
    console.log("provideTags")
    return []
  }

  provideAttributes(tag: string) {
    console.log("provideAttributes", tag)

    const targetAttribtues = this.controllers.map((controller) => {
      return { name: `data-${controller.identifier}-target` }
    })

    return [
      { name: "data-controller"},
      { name: "data-action" },
      { name: "data-target" },
      ...targetAttribtues
    ]
  }

  provideValues(tag: string, attribute: string) {
    console.log("provideValues", tag, attribute)

    if (attribute == "data-controller") {
      return this.controllers.map(controller => ({ name: controller.identifier }))
    }

    if (attribute == "data-action") {
      const events = EVENTS.map(name => ({ name }))

      const eventControllers = events.map(event => {
        return this.controllers.map(controller => {
          return { name: `${event.name}->${controller.identifier}`, controller }
        })
      }).flat()

      const eventControllerActions = eventControllers.map(eventController => {
        const actions = eventController.controller.methods

        return actions.map(action => {
          return { name: `${eventController.name}#${action}` }
        })
      }).flat()

      return [
        ...events,
        ...eventControllers,
        ...eventControllerActions
      ]
    }

    const matches = attribute.match(/data-(.+)-target/)

    if (matches && Array.isArray(matches) && matches[1]) {
      const identifier = matches[1]

      return this.controllers.filter(c => c.identifier == identifier).map(c => c.targets).flat().map(target => {
        return { name: target }
      })
    }

    return []
  }
}
