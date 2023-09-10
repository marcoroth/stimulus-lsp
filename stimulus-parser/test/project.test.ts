import { expect, test } from "vitest"
import { Project } from "../src"

const project = new Project("/Users/marcoroth/Development/stimulus-parser")

test("relativePath", () => {
  expect(project.relativePath("/Users/marcoroth/Development/stimulus-parser/path/to/some/file.js")).toEqual(
    "path/to/some/file.js"
  )
})

test("relativeControllerPath", () => {
  expect(
    project.relativeControllerPath(
      "/Users/marcoroth/Development/stimulus-parser/app/javascript/controllers/some_controller.js"
    )
  ).toEqual("some_controller.js")
  expect(
    project.relativeControllerPath(
      "/Users/marcoroth/Development/stimulus-parser/app/javascript/controllers/nested/some_controller.js"
    )
  ).toEqual("nested/some_controller.js")
  expect(
    project.relativeControllerPath(
      "/Users/marcoroth/Development/stimulus-parser/app/javascript/controllers/nested/deeply/some_controller.js"
    )
  ).toEqual("nested/deeply/some_controller.js")
})
