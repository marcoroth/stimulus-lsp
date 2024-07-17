import path from "path"
import { levenshtein } from "./levenshtein"

import type { Project, ExportDeclaration, ControllerDefinition } from "stimulus-parser"

function rank(input: string, list: string[]) {
  return list
    .map((item) => {
      const score = levenshtein(input.toLowerCase(), item.toLowerCase())

      return { item, score }
    })
    .sort((a, b) => a.score - b.score)
}

export function didyoumean(input: string, list: string[]): string | null {
  if (list.length === 0) return null

  const scores = rank(input, list)

  if (scores.length === 0) return null

  return scores[0].item
}

export function camelize(value: string) {
  return value.replace(/(?:[_-])([a-z0-9])/g, (_, char) => char.toUpperCase())
}

export function dasherize(value: string) {
  return value.replace(/([A-Z])/g, (_, char) => `-${char.toLowerCase()}`)
}

export function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function importStatementForController(controllerDefinition: ControllerDefinition, project: Project) {
  const importSource = importSourceForController(controllerDefinition, project)
  const exportDeclaration = exportDeclarationFromControllerDefinition(controllerDefinition, project)

  if (!exportDeclaration) return { importStatement: undefined, localName: undefined, importSpecifier: undefined, importSource, exportDeclaration }

  return importStatementFromExportDeclaration(exportDeclaration, controllerDefinition, importSource)
}

export function importSourceForController(controllerDefinition: ControllerDefinition, project: Project) {
  if (controllerDefinition.sourceFile.isProjectFile) {
    return relativeControllersFilePath(project, controllerDefinition.sourceFile.path)
  }

  const nodeModule = nodeModleForController(controllerDefinition, project)

  return nodeModule?.name || ""
}

export function nodeModleForController(controllerDefinition: ControllerDefinition, project: Project) {
  return project.detectedNodeModules.find((module) => module.sourceFiles.includes(controllerDefinition.sourceFile))
}

export function localNameForExportDeclaration(exportDeclaration: ExportDeclaration, controller: ControllerDefinition) {
  return exportDeclaration.type === "default"
    ? controller.classDeclaration.className || `${capitalize(camelize(controller.guessedIdentifier))}Controller`
    : exportDeclaration.exportedName || controller.guessedIdentifier
}

export function importStatementFromExportDeclaration(
  exportDeclaration: ExportDeclaration,
  controller: ControllerDefinition,
  importSource: string,
) {
  const exportType = exportDeclaration?.type
  const localName = localNameForExportDeclaration(exportDeclaration, controller)
  const importSpecifier = exportType === "default" ? localName : `{ ${localName} }`
  const importStatement = `import ${importSpecifier} from "${importSource}"`

  return {
    exportDeclaration,
    localName,
    importSpecifier,
    importStatement,
    importSource,
  }
}

export function relativeControllersFilePath(project: Project, filePath: string): string {
  if (project.controllersIndexFiles.length === 0) return ""

  // TODO: Account for importmaps
  const relativePath = path.relative(
    path.dirname(project.controllersIndexFiles[0].path),
    filePath,
  )

  const fileName = path.basename(
    relativePath,
    path.extname(relativePath)
  )

  const controllerPath = path.join(
    path.dirname(relativePath),
    fileName
  )

  return controllerPath.startsWith(".") ? controllerPath : `./${controllerPath}`
}

export function exportDeclarationFromControllerDefinition(controllerDefinition: ControllerDefinition, project: Project) {
  if (controllerDefinition.sourceFile.isProjectFile) return controllerDefinition.classDeclaration.exportDeclaration

  const nodeModule = nodeModleForController(controllerDefinition, project)

  if (!nodeModule) return undefined

  return nodeModule.entrypointSourceFile?.exportDeclarations.find((exportDeclaration) => {
    try {
      return exportDeclaration.nextResolvedClassDeclaration?.controllerDefinition === controllerDefinition
    } catch(error: any) {
      return false
    }
  })
}
