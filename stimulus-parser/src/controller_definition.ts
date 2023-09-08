export interface ControllerDefinition {
  identifier: string
  dasherized: string
  methods: Array<string>
  targets: Array<string>
  classes: Array<string>
  values: { [key: string]: string }
}

// export class ControllerDefinition {
//   readonly identifier: string
//   readonly path: string
//
//   readonly targets = []
//   readonly values = []
//   readonly classes = []
//   readonly outlets = []
//
//   constructor(identifier: string, path: string) {
//     this.identifier = identifier
//     this.path = path
//   }
// }
