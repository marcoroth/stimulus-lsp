import { IHTMLDataProvider } from 'vscode-html-languageservice'
import { EVENTS } from '../events'

export class StimulusHTMLDataProvider implements IHTMLDataProvider {
  constructor(private id: string, private controllers: Array<string>) {}

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
      return { name: `data-${controller}-target` }
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
      return this.controllers.map(name => ({ name }))
    }

    if (attribute == "data-action") {
      const actions = ["initialize", "connect", "copy", "handle", "next", "previous", "disconnect"]
      const events = EVENTS.map(name => ({ name }))

      const eventControllers = events.map(event => {
        return this.controllers.map(controller => {
          return { name: `${event.name}->${controller}` }
        })
      }).flat()

      const eventControllerActions = eventControllers.map(eventController => {
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

    return []
  }
}
