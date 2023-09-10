import { Node } from 'vscode-html-languageservice';

export function attributeValue(node: Node, attribute: string) {
  if (!node.attributes) return null;

  return unquote(node.attributes[attribute] || "");
}

export function tokenList(node: Node, attribute: string) {
  const value = (squish(attributeValue(node, attribute) || "")).trim();

  return value.split(" ");
}

export function unquote(string: string) {
  return string.substr(1, string.length - 2);
}

export function reverseString(string: string) {
  return string.split("").reverse().join("");
}

export function squish(string: string) {
  return string.replace(/\s+/g, ' ');
}
