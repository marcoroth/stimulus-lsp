# Stimulus LSP

Intelligent Stimulus tooling for Visual Studio Code


![](/assets/stimulus-lsp.png)

## Functionality

Currently, this Language Server only works for HTML, though its utility extends to various file types such as ERB, PHP, or Blade files.

### Completions

* Data Attributes
* Completions for controller identifiers
* Completions for controller actions
* Completions for controller targets
* Completions for controller values
* Completions for controller classes

### Diagnostics

#### HTML Files

* Missing controllers (`stimulus.controller.invalid`)
* Missing controller actions (`stimulus.action.invalid`)
* Missing controller targets (`stimulus.controller.target.missing`)
* Missing controller values (`stimulus.controller.value.missing`)
* Invalid action descriptors (`stimulus.action.invalid`)
* Data attributes format mismatches (`stimulus.attribute.mismatch`)
* Controller values type mismatches (`stimulus.controller.value.type_mismatch`)

#### JavaScript Files/Stimulus Controller Files

* Controller value definition default value type mismatch (`stimulus.controller.value_definition.default_value.type_mismatch`)
* Unknown value definition type (`stimulus.controller.value_definition.unknown_type`)
* Controller parsing errors (`stimulus.controller.parse_error`)
* Import from deprecated packages (`stimulus.package.deprecated.import`)

### Quick-Fixes

* Create a controller with the given identifier (`stimulus.controller.create`)
* Update controller identifier with did you mean suggestion (`stimulus.controller.update`)
* Register a controller definition from your project or a NPM package (`stimulus.controller.register`)
* Update controller action name with did you mean suggestion (`stimulus.controller.action.update`)
* Implement a missing controller action on controller (`stimulus.controller.action.implement`)
* Create a default config file at `.stimulus-lsp/config.json` (`stimulus.config.create`)
* Ignore diagnostics for a HTML attribute by adding it to the `ignoredAttributes` config (`stimulus.config.attribute.ignore`)
* Ignore diagnostics for a Stimulus controller identifier by adding it to the `ignoredControllerIdentifiers` config (`stimulus.config.controller.ignore`)

## Structure

```
.
├── package.json // The extension manifest.
|
├── client // Language Client
│   └── src
│      └── extension.ts // Language Client entry point
|
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

## Install instructions: Neovim

[Install instructions can be found at nvim-lspconfig](https://github.com/neovim/nvim-lspconfig/blob/master/doc/configs.md#stimulus_ls)
