export interface NodeElement {
  key: { name: string }
  value: PropertyValue
  properties: PropertyElement[]
  elements: NodeElement[]
  type: string
}

export interface PropertyValue {
  name: string
  value: PropertyValue
  raw: string
  properties: PropertyElement[]
  elements: NodeElement[]
  type: string
}

export interface PropertyElement {
  key: { name: string }
  value: PropertyValue
  properties: PropertyElement[]
}
