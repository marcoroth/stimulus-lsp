import { IHTMLDataProvider } from "vscode-html-languageservice"
// import { CompletionItemKind } from 'vscode-languageserver/node';

import { EVENTS } from "../events"

import { Project } from "stimulus-parser"

export class StimulusHTMLDataProvider implements IHTMLDataProvider {
  private folder: string
  private project: Project

  constructor(private id: string, private projectPath: string) {
    this.folder = this.projectPath.replace("file://", "")
    this.project = new Project(this.folder)
  }

  get controllers() {
    return this.project.controllerDefinitions
  }

  async refresh() {
    await this.project.analyze()
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
      const name = `data-${controller.identifier}-target`
      return { name }
    })

    const valueAttribtues = this.controllers
      .map((controller) => {
        return Object.keys(controller.values).map((value) => {
          return { name: `data-${controller.identifier}-${value}-value` }
        })
      })
      .flat()

    const classAttribtues = this.controllers
      .map((controller) => {
        return controller.classes.map((klass) => {
          return { name: `data-${controller.identifier}-${klass}-class` }
        })
      })
      .flat()

    return [
      { name: "data-controller" },
      { name: "data-action" },
      { name: "data-target" },
      ...targetAttribtues,
      ...valueAttribtues,
      ...classAttribtues,
    ]
  }

  provideValues(tag: string, attribute: string) {
    console.log("provideValues", tag, attribute)

    if (attribute == "data-controller") {
      return this.controllers.map((controller) => ({ name: controller.identifier }))
    }

    if (attribute == "data-action") {
      const events = EVENTS.map((name) => ({ name }))

      const eventControllers = events.flatMap((event) => {
        return this.controllers.map((controller) => {
          return { name: `${event.name}->${controller.identifier}`, controller }
        })
      })

      const eventControllerActions = eventControllers.flatMap((eventController) => {
        const actions = eventController.controller.methods

        return actions.map((action) => {
          return { name: `${eventController.name}#${action}` }
        })
      })

      return [...events, ...eventControllers, ...eventControllerActions]
    }

    const targetMatches = attribute.match(/data-(.+)-target/)

    if (targetMatches && Array.isArray(targetMatches) && targetMatches[1]) {
      const dasherized = targetMatches[1]

      return this.controllers
        .filter((c) => c.identifier == dasherized)
        .flatMap((c) => c.targets)
        .map((target) => {
          return { name: target }
        })
    }

    const valueMatches = attribute.match(/data-(.+)-(.+)-value/)

    if (valueMatches && Array.isArray(valueMatches) && valueMatches[1]) {
      const dasherized = valueMatches[1]
      const value = valueMatches[2]

      const controller = this.controllers.find((c) => c.identifier == dasherized)

      if (controller) {
        const valueDefiniton = controller.values[value]

        if (valueDefiniton.type === "Boolean") {
          return [
            { name: "true" },
            { name: "false" },
            { name: "null" },
            { name: JSON.stringify(valueDefiniton.default) },
          ]
        }

        if (valueDefiniton.type === "Number") {
          return [
            { name: "-1" },
            { name: "0" },
            { name: JSON.stringify(valueDefiniton.default) },
            { name: "1" },
            { name: "2" },
            { name: "3" },
            { name: "4" },
            { name: "5" },
            { name: "6" },
            { name: "7" },
            { name: "8" },
            { name: "9" },
          ]
        }

        if (valueDefiniton.type === "Object") {
          return [
            { name: JSON.stringify(valueDefiniton.default) },
            { name: "{}" },
          ]
        }

        if (valueDefiniton.type === "Array") {
          return [
            { name: JSON.stringify(valueDefiniton.default) },
            { name: "[]" },
          ]
        }

        if (valueDefiniton.type === "String") {
          return [
            { name: JSON.stringify(valueDefiniton.default) },
            { name: dasherized },
            { name: value }
          ]
        }
      }
    }

    return []
  }
}
