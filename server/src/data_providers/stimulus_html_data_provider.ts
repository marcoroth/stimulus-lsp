import { IHTMLDataProvider } from "@herb-tools/language-service"

import { EVENTS } from "../events"

import { Project } from "stimulus-parser"
import { dasherize } from "../utils"

export class StimulusHTMLDataProvider implements IHTMLDataProvider {
  private id: string;
  private project: Project

  constructor(id: string, project: Project) {
    this.id = id;
    this.project = project;
  }

  get controllers() {
    return this.project.registeredControllers
  }

  get controllerRoots() {
    return this.project.controllerRoots
  }

  isApplicable() {
    return true
  }

  getId() {
    return this.id
  }

  provideTags() {
    return []
  }

  provideAttributes(_tag: string) {
    const targetAttribtues = this.controllers
      .filter((controller) => controller.controllerDefinition.targetNames.length > 0)
      .map((controller) => {
        const name = `data-${controller.identifier}-target`
        return { name }
      })

    const valueAttribtues = this.controllers.flatMap((controller) => {
      return controller.controllerDefinition.values.map((definition) => {
        return { name: `data-${controller.identifier}-${dasherize(definition.name)}-value` }
      })
    })

    const classAttribtues = this.controllers.flatMap((controller) => {
      return controller.controllerDefinition.classNames.map((klass) => {
        return { name: `data-${controller.identifier}-${dasherize(klass)}-class` }
      })
    })

    return [
      { name: "data-controller" },
      { name: "data-action" },
      { name: "data-target" },
      ...targetAttribtues,
      ...valueAttribtues,
      ...classAttribtues,
    ]
  }

  provideValues(_tag: string, attribute: string) {
    if (attribute == "data-controller") {
      return this.controllers.map((controller) => ({ name: controller.identifier }))
    }

    if (attribute == "data-action") {
      const events = EVENTS.map((name) => ({ name }))
      const controllers = this.controllers.map((controller) => ({ name: `${controller.identifier}`, controller }))

      // const keys = [
      //   "alt",
      //   "ctrl",
      //   "meta",
      //   "shift",
      //   "enter",
      //   "tab",
      //   "esc",
      //   "space",
      //   "up",
      //   "down",
      //   "left",
      //   "right",
      //   "home",
      //   "end",
      //   "page_up",
      //   "page_down",
      //   ..."abcdefghijklmnopqrstuvwxyz".split(""),
      //   ..."0123456789".split(""),
      // ]

      const controllersWithEvents = EVENTS.flatMap((event) => {
        return controllers.flatMap((item) => {
          const { controller } = item

          // const keyEvents = (["keydown", "keyup", "keypress"].includes(event)) ? keys.flatMap((key1) =>
          //   keys.flatMap((key2) => [
          //     { name: `${event}.${key1}+${key2}->${controller.identifier}`, controller },
          //     { name: `${event}.${key1}+${key2}@window->${controller.identifier}`, controller },
          //     { name: `${event}.${key1}+${key2}@document->${controller.identifier}`, controller }
          //   ])
          // ) : []

          return [
            { name: `${event}->${item.controller.identifier}`, controller },
            { name: `${event}@window->${item.controller.identifier}`, controller },
            { name: `${event}@document->${item.controller.identifier}`, controller },
            // ...keyEvents
          ]
        })
      })

      const controllersWithActions = controllers.concat(controllersWithEvents).flatMap((item) => {
        const { controller } = item
        const { actionNames } = controller.controllerDefinition

        return actionNames.map((action) => {
          return { name: `${item.name}#${action}`, controller }
        })
      })

      // const options = [
      //   "capture",
      //   "once",
      //   "passive",
      //   "!passive",
      //   "stop",
      //   "self",
      // ]

      // const controllersWithActionOptions = controllersWithActions.flatMap((item) => {
      //   const { controller } = item
      //
      //   return options.map((option) => {
      //     return { name: `${item.name}:${option}`, controller }
      //   })
      // })

      return [
        ...events,
        ...controllers,
        ...controllersWithEvents,
        ...controllersWithActions,
        // ...controllersWithActionOptions,
      ]
    }

    const targetMatches = attribute.match(/data-(.+)-target/)

    if (targetMatches && Array.isArray(targetMatches) && targetMatches[1]) {
      const identifier = targetMatches[1]
      const controller = this.controllers.find((controller) => controller.identifier == identifier)

      if (!controller) return []

      return controller.controllerDefinition.targetNames.map((name) => ({ name }))
    }

    const valueMatches = attribute.match(/data-(.+)-(.+)-value/)

    if (valueMatches && Array.isArray(valueMatches) && valueMatches[1]) {
      const identifier = valueMatches[1]
      const value = valueMatches[2]

      const controller = this.controllers.find((controller) => controller.identifier == identifier)

      if (controller) {
        const valueDefiniton = controller.controllerDefinition.values.find((definition) => definition.name === value)

        if (!valueDefiniton) return []

        const defaultValue = (valueDefiniton.hasExplicitDefaultValue) ? { name: JSON.stringify(valueDefiniton.default).replace(/"/g, '\\"') } : { name: "" }

        if (valueDefiniton.type === "Boolean") {
          return [
            defaultValue,
            { name: "true" },
            { name: "false" },
            { name: "null" },
          ]
        }

        if (valueDefiniton.type === "Number") {
          return [
            { name: "-1" },
            { name: "0" },
            defaultValue,
            { name: "1" },
            { name: "2" },
            { name: "3" },
            { name: "4" },
            { name: "5" },
            { name: "6" },
            { name: "7" },
            { name: "8" },
            { name: "9" },
            { name: "10" },
          ]
        }

        if (valueDefiniton.type === "Object") {
          return [defaultValue, { name: "{}" }]
        }

        if (valueDefiniton.type === "Array") {
          return [defaultValue, { name: "[]" }]
        }

        if (valueDefiniton.type === "String") {
          return [defaultValue, { name: identifier }, { name: value }]
        }
      }
    }

    return []
  }
}
