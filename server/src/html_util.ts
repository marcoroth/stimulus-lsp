import { Node } from 'vscode-html-languageservice';

export function attributeValue(node: Node, attribute: string) {
  if (!node.attributes) return null

  return unquote(node.attributes[attribute] || "")
}

export function tokenList(node: Node, attribute: string) {
  const value = (attributeValue(node, attribute) || "").trim()

  return value.split(" ")
}

export function unquote(string: String) {
  return string.substr(1, string.length - 2)
}

export function reverseString(string: String) {
  return string.split("").reverse().join("")
}
