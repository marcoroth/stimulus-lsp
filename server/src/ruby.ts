import { Template } from "ejs"
import { loadPrism, Visitor } from "@ruby/prism"
import type { HashNode, KeywordHashNode } from "@ruby/prism"

// const str = "Hello<h1><%= div.tag(data: { controller: 'test' }) %></h1>"

const str = `
<%= turbo_frame_tag dom_id(@connected_folder, "list") do %>
  <button data-controller="frame-reload" data-action="click->frame-reload#reload">Reload</button>

  <div class="grid grid-cols-2 gap-4">
    <div>
      Origin (ID: <%= @origin_connection.id %>):
      <pre class="bg-black text-white p-4 overflow-scroll"><%= @origin_connection.ls_output %></pre>
      <pre class="bg-black text-white p-4 overflow-scroll"><%= @origin_connection.diff_parsed.select { |file| file.diff_mode != "=" }.map { |file| "Mode: #{file.diff_mode}, Path: #{file.path}"}.join("\n") %></pre>
    </div>
    <div>
      Destination (ID: <%= @reverse_connection.id %>):
      <pre class="bg-black text-white p-4 overflow-scroll"><%= @reverse_connection.ls_output %></pre>
    </div>
  </div>
<% end %>
`

function extractSource(code: string) {
  const template = new Template(str)
  const matches = template.parseTemplateText();
  const d = template.opts.delimiter;
  const o = template.opts.openDelimiter;
  const c = template.opts.closeDelimiter;

  const source: string[] = []

  if (matches && matches.length) {
    matches.forEach(function (line: string, index: number) {

      const isTag = line.indexOf(o + d) === 0 // If it is a tag
      const isNotEscaped = line.indexOf(o + d + d) !== 0 // and is not escaped

      if (isTag && isNotEscaped) {
        const closing = matches[index + 2];

        if (!(closing == d + c || closing == '-' + d + c || closing == '_' + d + c)) {
          throw new Error('Could not find matching close tag for "' + line + '".');
        } else {
          source.push(matches[index + 1])
        }
      }
    });
  }

  return source.join("\n")
}


const parse = await loadPrism()
const parseResult = parse(extractSource(str))

console.log(JSON.stringify(parseResult, null, 2))

class FooCalls extends Visitor {
  visitHashNode(node: HashNode) {
    // console.log(JSON.stringify(node, null, 2))
  }

  visitKeywordHashNode(node) {
    super.visitKeywordHashNode(node)
  }
}

const fooVisitor = new FooCalls()

parseResult.value.accept(fooVisitor)
