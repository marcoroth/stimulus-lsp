import { expect, test } from "vitest"
import { Project, Parser } from "../src"

const project = new Project("/Users/marcoroth/Development/stimulus-parser")
const parser = new Parser(project)

test("parse targets", () => {
  const code = `
    import { Controller } from "@hotwired/stimulus"

    export default class extends Controller {
      static targets = ["one", "two", "three"]
    }
  `
  const controller = parser.parseController(code, "target_controller.js")

  expect(controller.targets).toEqual(["one", "two", "three"])
})

test("parse classes", () => {
  const code = `
    import { Controller } from "@hotwired/stimulus"

    export default class extends Controller {
      static classes = ["one", "two", "three"]
    }
  `
  const controller = parser.parseController(code, "class_controller.js")

  expect(controller.classes).toEqual(["one", "two", "three"])
})

test("parse values", () => {
  const code = `
    import { Controller } from "@hotwired/stimulus"

    export default class extends Controller {
      static values = {
        string: String,
        object: Object,
        boolean: Boolean,
        array: Array,
        number: Number
      }
    }
  `
  const controller = parser.parseController(code, "value_controller.js")

  expect(controller.values).toEqual({
    string: { type: "String", default: "" },
    object: { type: "Object", default: {} },
    boolean: { type: "Boolean", default: false },
    array: { type: "Array", default: [] },
    number: { type: "Number", default: 0 },
  })
})

test("parse values with with default values", () => {
  const code = `
    import { Controller } from "@hotwired/stimulus"

    export default class extends Controller {
      static values = {
        string: { type: String, default: "string" },
        object: { type: Object, default: { object: "Object" } },
        boolean: { type: Boolean, default: true },
        array: { type: Array, default: ["Array"] },
        number: { type: Number, default: 1 }
      }
    }
  `
  const controller = parser.parseController(code, "value_controller.js")

  expect(controller.values).toEqual({
    string: { type: "String", default: "string" },
    object: { type: "Object", default: { object: "Object" } },
    boolean: { type: "Boolean", default: true },
    array: { type: "Array", default: ["Array"] },
    number: { type: "Number", default: 1 },
  })
})

// TODO
test.skip("parse nested object/array default value types", () => {
  const code = `
    import { Controller } from "@hotwired/stimulus"

    export default class extends Controller {
      static values = {
        object: { type: Object, default: { object: { some: { more: { levels: {} } } } } },
        array: { type: Array, default: [["Array", "with", ["nested", ["values"]]]] },
      }
    }
  `
  const controller = parser.parseController(code, "value_controller.js")

  expect(controller.values).toEqual({
    object: { type: "Object", default: { object: { some: { more: { levels: {} } } } } },
    array: { type: "Array", default: [["Array", "with", ["nested", ["values"]]]] },
  })
})
