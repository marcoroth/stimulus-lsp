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

   return split_ignore_tags(value);
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

export function split_ignore_tags(string: string) {
    const regex = /<%=(.*?)%>|<%.*?%>|<\?php.*?\?>|<\?=.*?\?>|\{\{.*?\}\}|(\S+)|\s+/g;
    const splitted_string = string.match(regex);

    if (!splitted_string || splitted_string.length === 1) {
        return [string];
    }

    return splitted_string.filter(match => match !== " " && match.trim() !== "");
}
