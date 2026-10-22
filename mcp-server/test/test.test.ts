import { expect, test } from "vitest"
import { Project } from "stimulus-parser"

test("test", async () => {
	const project = new Project("/Users/marcoroth/Development/rubyvideo")
        
	await project.initialize()
	await project.analyze()

	const controller = project.controllerDefinitions[0]

  expect(controller).toBeDefined()

	console.log(controller.actionNames)
	console.log(controller.targetNames)
	console.log(controller.classNames)
	console.log(controller.valueNames)
	console.log(controller.values)
})
