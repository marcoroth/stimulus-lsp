const fs = require('fs');
const { Parser } = require("acorn");
const staticClassFeatures = require('acorn-static-class-features');
const walk = require("acorn-walk");
const path = require("path");
const glob = require('glob');

const StimulusParser = Parser.extend(staticClassFeatures);
const folder = "/Users/marcoroth/Development/boxdrop";

glob(`${folder}/**/*_controller.js`, { ignore: `${folder}/node_modules/**/*` }, (err, files) => {
  files.forEach(file => analyzeController(file));
});

const analyzeController = (file) => {
  return fs.readFile(file, 'utf8', (err, data) => {
    const tree = StimulusParser.parse(data, { sourceType: 'module', ecmaVersion: 2020 });

    const splits = file.split("/");
    const file_name = splits[splits.length - 1];

    const controller = {
      identifier: file_name.split("_controller.js")[0],
      methods: [],
      targets: [],
      classes: [],
      values: {}
    };

    walk.simple(tree, {
      MethodDefinition(node) {
        if (node.kind === "method") {
          controller.methods.push(node.key.name);
        }
      },

      PropertyDefinition(node) {
        const { name } = node.key;

        if (name === "targets") {
          controller.targets = node.value.elements.map(e => e.value);
        }

        if (name === "classes") {
          controller.classes = node.value.elements.map(e => e.value);
        }

        if (name === "values") {
          node.value.properties.forEach(p => {
            controller.values[p.key.name] = p.value.name;
          });
        }
      }
    });
  });
};
