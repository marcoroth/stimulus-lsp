import { IHTMLDataProvider } from 'vscode-html-languageservice'
import { EVENTS } from '../events'

import { Project } from "stimulus-parser"

export class StimulusHTMLDataProvider implements IHTMLDataProvider {
  private folder: string
  private project: Project

  constructor(private id: string, private projectPath: string) {
    this.folder = this.projectPath.replace("file://", "")

    this.project = new Project(this.folder)
    this.project.analyze()
  }

  get controllers() {
    return this.project.controllerDefinitions
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
      return { name: `data-${controller.dasherized}-target` }
    })

    const valueAttribtues = this.controllers.map((controller) => {
      return Object.keys(controller.values).map(value => {
        return { name: `data-${controller.dasherized}-${value}-value` }
      })
    }).flat()

    const classAttribtues = this.controllers.map((controller) => {
      return controller.classes.map(klass => {
        return { name: `data-${controller.dasherized}-${klass}-class` }
      })
    }).flat()

    return [
      { name: "data-controller"},
      { name: "data-action" },
      { name: "data-target" },
      ...targetAttribtues,
      ...valueAttribtues,
      ...classAttribtues
    ]
  }

  provideValues(tag: string, attribute: string) {
    console.log("provideValues", tag, attribute)

    if (attribute == "data-controller") {
      return this.controllers.map(controller => ({ name: controller.dasherized }))
    }

    if (attribute == "data-action") {
      const events = EVENTS.map(name => ({ name }))

      const eventControllers = events.map(event => {
        return this.controllers.map(controller => {
          return { name: `${event.name}->${controller.dasherized}`, controller }
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

    const targetMatches = attribute.match(/data-(.+)-target/)

    if (targetMatches && Array.isArray(targetMatches) && targetMatches[1]) {
      const dasherized = targetMatches[1]

      return this.controllers.filter(c => c.dasherized == dasherized).map(c => c.targets).flat().map(target => {
        return { name: target }
      })
    }

    const valueMatches = attribute.match(/data-(.+)-(.+)-value/)

    if (valueMatches && Array.isArray(valueMatches) && valueMatches[1]) {
      const dasherized = valueMatches[1]
      const value = valueMatches[2]

      const controller = this.controllers.find(c => c.dasherized == dasherized)

      if (controller) {
        const valueDefiniton = controller.values[value]

        if (valueDefiniton === "Boolean") {
          return [
            { name: "true" },  
            { name: "false" },
            { name: "null" }
          ]
        }

        if (valueDefiniton === "Number") {
          return [
            { name: "-1" },  
            { name: "0" },  
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

        if (valueDefiniton === "Object") {
          return [ { name: "{}" } ]
        }

        if (valueDefiniton === "Array") {
          return [ { name: "[]" } ]
        }

        if (valueDefiniton === "String") {
          return [
            { name: "string" },
            { name: dasherized },
            { name: value },
          ]
        }
      }
    }

    return []
  }
}
