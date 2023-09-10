import { expect, test } from "vitest"
import { Project, ControllerDefinition } from "../src"

const project = new Project("/Users/marcoroth/Development/stimulus-parser")

test("top-level", () => {
  const controller = new ControllerDefinition(project, "some_controller.js")

  expect(controller.identifier).toEqual("some")
})

test("top-level underscored", () => {
  const controller = new ControllerDefinition(project, "some_underscored_controller.js")

  expect(controller.identifier).toEqual("some-underscored")
})

test("top-level dasherized", () => {
  const controller = new ControllerDefinition(project, "some-underscored_controller.js")

  expect(controller.identifier).toEqual("some-underscored")
})

test("namespaced", () => {
  const controller = new ControllerDefinition(project, "namespaced/some_controller.js")

  expect(controller.identifier).toEqual("namespaced--some")
})

test("deeply nested", () => {
  const controller = new ControllerDefinition(project, "a/bunch/of/levels/some_controller.js")

  expect(controller.identifier).toEqual("a--bunch--of--levels--some")
})

test("deeply nested underscored", () => {
  const controller = new ControllerDefinition(project, "a/bunch/of/levels/some_underscored_controller.js")

  expect(controller.identifier).toEqual("a--bunch--of--levels--some-underscored")
})

test("deeply nested dasherized", () => {
  const controller = new ControllerDefinition(project, "a/bunch/of/levels/some-underscored_controller.js")

  expect(controller.identifier).toEqual("a--bunch--of--levels--some-underscored")
})

test("deeply nested all dasherized", () => {
  const controller = new ControllerDefinition(project, "a/bunch/of/levels/some-underscored-controller.js")

  expect(controller.identifier).toEqual("a--bunch--of--levels--some-underscored")
})

// https://github.com/hotwired/stimulus-webpack-helpers/pull/3
test.skip("nested with only controller", () => {
  const controller = new ControllerDefinition(project, "a/bunch/of/levels/controller.js")

  expect(controller.identifier).toEqual("a--bunch--of--levels")
})
