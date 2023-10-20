# Stimulus LSP

Intelligent Stimulus tooling for Visual Studio Code


![](/assets/stimulus-intellisense.png)

## Functionality

This Language Server works for HTML and ERB files. It has the following language features:

### Completions

* Data Attributes
* Completions for controller identifiers
* Completions for controller actions
* Completions for controller targets
* Completions for controller values
* Completions for controller classes

### Diagnostics

* Missing controllers (`stimulus.controller.invalid`)
* Missing controller actions (`stimulus.action.invalid`)
* Missing controller targets (`stimulus.controller.target.missing`)
* Missing controller values (`stimulus.controller.value.missing`)
* Invalid action descriptions (`stimulus.action.invalid`)
* Data attributes format mismatches (`stimulus.attribute.mismatch`)
* Controller values type mismatches (`stimulus.controller.value.type_mismatch`)

### Quick-Fixes

* Create unknown controllers (`stimulus.controller.create`)

## Structure

```
.
├── client // Language Client
│   ├── src
│   │   └── extension.ts // Language Client entry point
├── package.json // The extension manifest.
└── server // Language Server
    └── src
        └── server.ts // Language Server entry point
```

## Running the extension locally

- Run `yarn install` in this folder. This installs all necessary npm modules in both the client and server folder
- Open VS Code on this folder.
- Press Ctrl+Shift+B to compile the client and server.
- Switch to the Debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server`
- In the [Extension Development Host] instance of VSCode, open a HTML file.
  - Type `<div data-controller="|">`, place your cursor where the `|` is, hit Ctrl+Space and you should see completions.
