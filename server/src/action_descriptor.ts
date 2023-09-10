// https://github.com/hotwired/stimulus/blob/8cbca6db3b1b2ddb384deb3dd98397d3609d25a0/src/core/action_descriptor.ts

export interface ActionDescriptor {
  eventTarget: string
  eventOptions: AddEventListenerOptions
  eventName: string
  identifier: string
  methodName: string
  keyFilter: string
}

// capture nos.:                  1      1    2   2     3   3      4               4      5   5    6      6     7  7
const descriptorPattern = /^(?:(?:([^.]+?)\+)?(.+?)(?:\.(.+?))?(?:@(window|document))?->)?(.+?)(?:#([^:]+?))(?::(.+))?$/

export function parseActionDescriptorString(descriptorString: string): Partial<ActionDescriptor> {
  const source = descriptorString.trim()
  const matches = source.match(descriptorPattern) || []
  let eventName = matches[2]
  let keyFilter = matches[3]

  if (keyFilter && !["keydown", "keyup", "keypress"].includes(eventName)) {
    eventName += `.${keyFilter}`
    keyFilter = ""
  }

  return {
    eventTarget: matches[4],
    eventName,
    eventOptions: matches[7] ? parseEventOptions(matches[7]) : {},
    identifier: matches[5],
    methodName: matches[6],
    keyFilter: matches[1] || keyFilter,
  }
}

function parseEventOptions(eventOptions: string): AddEventListenerOptions {
  return eventOptions
    .split(":")
    .reduce((options, token) => Object.assign(options, { [token.replace(/^!/, "")]: !/^!/.test(token) }), {})
}
