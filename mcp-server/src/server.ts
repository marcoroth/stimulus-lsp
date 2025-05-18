import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { Project } from "stimulus-parser" 
import type { ControllerDefinition } from "stimulus-parser"

export const Server = new McpServer({
  name: "stimulus-mcp-server",
  version: "0.0.1",
  capabilities: {
    resources: {},
    tools: {},
  },
})

function formatController(controllerDefinition: ControllerDefinition): string {
  return [
    `Guessed Controller Identifier: ${controllerDefinition.guessedIdentifier}`,
    `File Path: ${controllerDefinition.path || "Unknown"}`,
    `Target Names: ${controllerDefinition.targetNames.join(", ") || "[]"}`,
    `Action Names: ${controllerDefinition.actionNames.join(", ") || "[]"}`,
    `Value Names: ${controllerDefinition.valueNames.join(", ") || "[]"}`,
    "---",
  ].join("\n");
}

Server.tool(
  "check-stimulus-usage",
  "Checks if a given app uses Stimulus.js",
  {
    projectPath: z.string().describe("An absolute path to the repository/codebase/project"),
  },
  async ({ projectPath }) => {
    return {
      content: [
        { 
          type: "text", 
          text: `Yes the project at the path ${projectPath} is using Stimulus`
        }
      ]
    }
  }
)

Server.tool(
  "get-javascript-bundling-approach",
  "Checks what kind of JavaScript bundling a Ruby on Rails application is using. Modern Rails Applications have a lot of different ways to use and bundle JavaScript.",
  {
    projectPath: z.string().describe("An absolute path to the repository/codebase/project"),
  },
  async ({ projectPath }) => {
    return {
      content: [
        { 
          type: "text", 
          text: `Yes the project at the path ${projectPath} is using importmap-rails to bundle JavScript`
        }
      ]
    }
  }
)

Server.tool(
  "get-stimulus-application-file-path",
  "Get the path of the Stimulus application file",
  {
    projectPath: z.string().describe("An absolute path to the repository/codebase/project"),
  },
  async ({ projectPath }) => {
    return {
      content: [
        {
          type: "text",
          text: `The path of the Stimulus application file is:`,
        },
      ],
    };
  }
)

Server.tool(
  "get-stimulus-application-file-content",
  "Get the content of the Stimulus application file",
  {
    projectPath: z.string().describe("An absolute path to the repository/codebase/project"),
  },
  async ({ projectPath }) => {
    return {
      content: [
        {
          type: "text",
          text: `The content of the Stimulus application file is:`,
        },
      ],
    };
  }
)

Server.tool(
  "get-stimulus-controller-index-file-path",
  "Get the path of the Stimulus controller index file",
  {
    projectPath: z.string().describe("An absolute path to the repository/codebase/project"),
  },
  async ({ projectPath }) => {
    return {
      content: [
        {
          type: "text",
          text: `The path of the Stimulus controller index file is:`,
        },
      ],
    };
  }
)

Server.tool(
  "get-stimulus-controller-file-content",
  "Get the content of a Stimulus controller file",
  {
    controllerIdentifier: z.string().describe("The identifier of the Stimulus controller"),
  },
  async ({ controllerIdentifier }) => {
    return {
      content: [
        {
          type: "text",
          text: `The content of the Stimulus controller file for ${controllerIdentifier} is:`,
        },
      ],
    };
  }
)

Server.tool(
  "get-stimulus-controller-file-path",
  "Get the path of a Stimulus controller file",
  {
    controllerIdentifier: z.string().describe("The identifier of the Stimulus controller"),
  },
  async ({ controllerIdentifier }) => {
    return {
      content: [
        {
          type: "text",
          text: `The path of the Stimulus controller file for ${controllerIdentifier} is:`,
        },
      ],
    };
  }
)

Server.tool(
  "get-stimulus-controller-target-names",
  "Get the Stimulus target names of a Stimulus controller",
  {
    controllerIdentifier: z.string().describe("The identifier of the Stimulus controller"),
  },
  async ({ controllerIdentifier }) => {
    return {
      content: [
        {
          type: "text",
          text: `The target names of the Stimulus controller ${controllerIdentifier} are:`,
        },
      ],
    };
  }
)

Server.tool(
  "get-stimulus-controller-action-names",
  "Get the Stimulus action names of a Stimulus controller",
  {
    controllerIdentifier: z.string().describe("The identifier of the Stimulus controller"),
  },
  async ({ controllerIdentifier }) => {
    return {
      content: [
        {
          type: "text",
          text: `The action names of the Stimulus controller ${controllerIdentifier} are:`,
        },
      ],
    };
  }
)

Server.tool(
  "get-stimulus-controller-value-names",
  "Get the Stimulus value names and types of a Stimulus controller",
  {
    controllerIdentifier: z.string().describe("The identifier of the Stimulus controller"),
  },
  async ({ controllerIdentifier }) => {
    return {
      content: [
        {
          type: "text",
          text: `The value names and types of the Stimulus controller ${controllerIdentifier} are:`,
        },
      ],
    };
  }
)

Server.tool(
  "get-stimulus-controller-classes",
  "Get the Stimulus classes of a Stimulus controller",
  {
    controllerIdentifier: z.string().describe("The identifier of the Stimulus controller"),
  },
  async ({ controllerIdentifier }) => {
    return {
      content: [
        {
          type: "text",
          text: `The classes of the Stimulus controller ${controllerIdentifier} are:`,
        },
      ],
    };
  }
) 

Server.tool(
  "get-stimulus-controller-possible-html-attributes",
  "Get all possible and valid HTML attributes of a Stimulus controller",
  {
    controllerIdentifier: z.string().describe("The identifier of the Stimulus controller"),
  },
  async ({ controllerIdentifier }) => {
    return {
      content: [
        {
          type: "text",
          text: `The possible and valid HTML attributes of the Stimulus controller ${controllerIdentifier} are:`,
        },
      ],
    };
  }
)

Server.tool(
  "stimulus-controller-example-usage-documentation",
  "Get the example usage documentation of a Stimulus controller",
  {
    controllerIdentifier: z.string().describe("The identifier of the Stimulus controller"),
  },
  async ({ controllerIdentifier }) => {
    return {
      content: [
        {
          type: "text",
          text: `The example usage documentation of the Stimulus controller ${controllerIdentifier} is:`,
        },
      ],
    };
  }
)

Server.tool(
  "check-if-stimulus-controller-exists",
  "Check if a Stimulus controller exists",
  {
    controllerIdentifier: z.string().describe("The identifier of the Stimulus controller"),
  },
  async ({ controllerIdentifier }) => {
    return {
      content: [
        {
          type: "text",
          text: `The Stimulus controller ${controllerIdentifier} exists.`,
        },
      ],
    };
  }
)

Server.tool(
  "check-if-stimulus-controller-is-registered-on-stimulus-application",
  "Check if a Stimulus controller is registered on a Stimulus application",
  {
    controllerIdentifier: z.string().describe("The identifier of the Stimulus controller"),
  },
  async ({ controllerIdentifier }) => {
    return {
      content: [
        {
          type: "text",
          text: `The Stimulus controller ${controllerIdentifier} is registered on the Stimulus application.`,
        },
      ],
    };
  }
)

Server.tool(
  "create-stimulus-controller",
  "Create a new Stimulus controller",
  {
    controllerIdentifier: z.string().describe("The identifier of the Stimulus controller"),
  },
  async ({ controllerIdentifier }) => {
    return {
      content: [
        {
          type: "text",
          text: `The Stimulus controller ${controllerIdentifier} has been created.`,
        },
      ],
    };
  }
)

Server.tool(
  "register-stimulus-controller-on-stimulus-application",
  "Register a Stimulus controller on a Stimulus application",
  {
    controllerIdentifier: z.string().describe("The identifier of the Stimulus controller"),
  },
  async ({ controllerIdentifier }) => {
    return {
      content: [
        {
          type: "text",
          text: `The Stimulus controller ${controllerIdentifier} has been registered on the Stimulus application.`,
        },
      ],
    };
  }
)

Server.tool(
  "get-stimulus-controller-identifiers",
  "Get a list of valid controller identifiers in an app/project that uses Stimulus",
  {
    projectPath: z.string().describe("An absolute path to the repository/codebase/project"),
  },
  async ({ projectPath }) => {

    // TODO: check if projectPath exists
    if (false) {
      return {
        content: [
          {
            type: "text",
            text: "Project doesn't exist.",
          },
        ],
      };
    }

    const project = new Project(projectPath)

    await project.initialize()

    if (project.controllerDefinitions.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No Stimulus controllers found in project at ${projectPath}`,
          },
        ],
      };
    }

    const formattedControllers = project.controllerDefinitions.map(formatController);
    const formattedText = `Detected the following Stimulus Controllers in the project at ${projectPath}:\n\n${formattedControllers.join("\n")}`;

    return {
      content: [
        {
          type: "text",
          text: formattedText,
        },
      ],
    };
  },
);
