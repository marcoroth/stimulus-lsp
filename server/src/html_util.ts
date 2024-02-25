import { Node } from "vscode-html-languageservice"

export function attributeValue(node: Node, attribute: string) {
  if (!node.attributes) return null

  const value = node.attributes[attribute]

  if (!value) return null

  return unquote(value)
}

export function tokenList(node: Node, attribute: string) {
  let value = attributeValue(node, attribute)

  if (!value) return []

  value = squish(value).trim()

  if (value.length === 0) return []

  return splitOnSpaceIgnoreTags(value)
}

export function unquote(string: string) {
  return string.substr(1, string.length - 2)
}

export function reverseString(string: string) {
  return string.split("").reverse().join("")
}

export function squish(string: string) {
  return string.replace(/\s+/g, " ")
}

export function splitOnSpaceIgnoreTags(string: string) {
  // All spaces inside certain opening/closing tags are ignored in this regex pattern
  // Supported tags:
  // - Opening: <%=, <%, <%-, <?php, <?=, {{
  // - Closing: %>, -%>, ?>, }}
  const pattern = /(?<!<%=|<%|<%-|<\?php|<\?=|\{\{.*?)\s+(?![^<]*?%>|-%>|\?>|\}\})/g
  return string.split(pattern)
}
