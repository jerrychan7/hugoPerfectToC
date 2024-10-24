
# Hugo Perfect ToC Generator

[中文](./README.cn.md)

A [Hugo](https://gohugo.io/) template library for generating the intuitive table of contents.

- [Hugo Perfect ToC Generator](#hugo-perfect-toc-generator)
  - [Feature](#feature)
  - [Usage](#usage)
  - [Reason for the project](#reason-for-the-project)
  - [Principle](#principle)
  - [Data structure](#data-structure)
    - [`DocNode` Node for document tree](#docnode-node-for-document-tree)
    - [`TagInfo` Tag information](#taginfo-tag-information)
    - [`TocNode` Node for ToC tree](#tocnode-node-for-toc-tree)
  - [What is an intuitive ToC](#what-is-an-intuitive-toc)

## Feature

* [x] Intuitive table of contents generation
* [x] No extra or empty levels
* [x] Proper handling of table of contents in blockquotes/lists
* [x] Hugo Goldmark Extras extension support ([hugo#12605](https://github.com/gohugoio/hugo/issues/12605))
* [x] Rendered after Hugo's [heading render hooks](https://gohugo.io/render-hooks/headings/)
* [x] ul element renderer
* [x] ol element renderer
* [x] details element renderer
* [x] ASCII style renderer
* [x] User-defined renderers
* [x] Free-to-use ToC tree for any advanced features you want
* [x] Configurable `startLevel` and `endLevel`
* [ ] Configurable `startDepth` and `endDepth`
* [ ] Performance optimization

## Usage

Put all the HTML files in the `/tocLib` directory of this project into the `your site or theme/layouts/partials/tocLib` folder. Then you can start using it.

For example, if you want to add a ToC at the beginning of the article, `layouts/_default/single.html`:

```html
{{ define "main" }}
  <h1>{{ .Title }}</h1>

  {{- partial "tocLib/gen.html" (dict
    "page" .
    "startLevel" 2
    "endLevel" 3
    "renderer" "tocLib/tocTree2ul.html"
  ) -}}

  {{ .Content }}
{{ end }}
```

The performance of the current project is not very good, you can use `partialCached` to speed it up slightly, using `PAGE.Content` as the unique cache key:

```html
{{- partialCached "tocLib/gen.html" (dict "page" .) .Content -}}
```

Params `renderer`:

* `"tocLib/tocTree2ul.html"` Default value. Corresponding to Hugo configuration [`markup.tableOfContents.ordered = false`](https://gohugo.io/getting-started/configuration-markup/#ordered)
* `"tocLib/tocTree2ol.html"` Corresponding to Hugo configuration [`markup.tableOfContents.ordered = true`](https://gohugo.io/getting-started/configuration-markup/#ordered)
* `"tocLib/tocTree2details.html"`
* `"tocLib/tocTree2ascii.html"`

Params `startLevel`: Same logic as [`markup.tableOfContents.startLevel`](https://gohugo.io/getting-started/configuration-markup/#startlevel), default value `2`.

Params `endLevel`: Same logic as [`markup.tableOfContents.endLevel`](https://gohugo.io/getting-started/configuration-markup/#endlevel), default value `3`.

If you want to customize the renderer, or any advanced usage, you may need to read the [principle](#principle) and [data structure](#data-structure) sections below and check out the source code of this project.

> If you want a format similar to what is produced by `PAGE.TableOfContents`, you need a `nav` wrapper:
> 
> ```html
> <nav id="TableOfContents">
>   {{ partial "tocLib/gen.html" (dict "page" .) }}
> </nav>
> ```

## Reason for the project

Although Hugo has a built-in table of contents function `PAGE.TableOfContents`, it generates non-intuitive tables of contents in some scenarios.
It is rare, but some issues have shown that this problem still occurs, such as [hugo#1778](https://github.com/gohugoio/hugo/issues/1778), [hugo#7128](https://github.com/gohugoio/hugo/issues/7128), [hugo#12917](https://github.com/gohugoio/hugo/issues/12917).
To summarize the problem, it is basically:

1. If the first heading of the article is not h1/h2, an extra level will be output as the first item in the ToC, which is difficult to adjust with the `startLevel` option (because h1/h2 is still quite common in articles)
2. Non-strictly increasing headings will output extra levels, such as jumping directly from h1 to h6. Some authors have a bad habit of using headings to highlight certain content. Yeah, it's bad practice, but it can happen.
3. The Hugo generated ToC does not make sense when a heading is inside a block quote or an ordered/unordered list. The intuitive approach would be to treat it as a subheading.
4. Some headings of the Hugo Goldmark Extras extension were not rendering correctly ([hugo#12605](https://github.com/gohugoio/hugo/issues/12605)).

> As for what is counter-intuitive? What is intuitive? Please see the section at the end of this article [# What is an intuitive ToC](#what-is-an-intuitive-toc).

Assuming the extension is enabled:

```yaml
markup:
  goldmark:
    extensions:
      strikethrough: false
    extras:
      subscript:
        enable: true
```

For the following markdown:

```md
---
title: "Markdown Syntax Guide"
date: 2024-10-01T23:17:15+08:00
draft: false
---

#### not h1/h2 first

------------------------------

## Headings

↓ The heading in the blockquote element.
  Hopefully it will be possible to jump by ID, the same behavior as other heading elements.

> # H1 in blockquote
>
> ## H2 in blockquote

------------------------------

## Table

##### non-incrementing heading

↑ Some non-incrementing headings.

------------------------------

# heading in ul/ol

* ## h2 in top level
  * ### h3 in sub-level
* #### h4 in top level

------------------------------

# H~2~O

```

| `PAGE.TableOfContents` | ToC generated by this project |
|---|---|
| <ul><li><ul><li><ul><li><ul><li>not h1/h2 first</li></ul></li></ul></li><li>Headings</li></ul></li><li>H1 in blockquote<ul><li>H2 in blockquote</li><li>Table<ul><li><ul><li><ul><li>non-incrementing heading</li></ul></li></ul></li></ul></li></ul></li><li>heading in ul/ol<ul><li>h2 in top level<ul><li>h3 in sub-level<ul><li>h4 in top level</li></ul></li></ul></li></ul></li><li>H2O</li></ul> | <ul><li>not h1/h2 first</li><li>Headings<ul><li>H1 in blockquote<ul><li>H2 in blockquote</li></ul></li></ul></li><li>Table<ul><li>non-incrementing heading</li></ul></li><li>heading in ul/ol<ul><li>h2 in top level<ul><li>h3 in sub-level</li></ul></li><li>h4 in top level</li></ul></li><li>H<sub>2</sub>O</li></ul> |

## Principle

1. `PAGE.Content` stores the HTML parsed from the markdown file.
2. Build a document tree by parsing HTML.
3. Build a ToC tree based on the real document structure by parsing the document tree.
4. Through the ToC tree, users can choose different renderers to render different ToC contents. By default, ordered/unordered lists and details are provided.

> Why not use `PAGE.Fragments`?  
> This is because this structure is generated by Hugo when it generates `PAGE.TableOfContents`, so it is impossible to accurately restore the intuitive directory through this.

## Data structure

### `DocNode` Node for document tree

| Field name | Type | Description |
|---|---|---|
| `start` | `int` | The starting index of the node in `PAGE.Content` string |
| `end` | `int` | The ending index + 1 of the node in `PAGE.Content` string |
| `id` | `string` | Node unique identifier, assists in the implementation of subsequent algorithms,<br/>value is `"start,end"` |
| `type` | `string` | The type of the node. Possible values ​​are: `root`, `text`, `tag`, `comment` |

For nodes whose `type` is `root`, they have the following additional fields:

| Field name | Type | Description |
|---|---|---|
| `children` | `[]DocNode` | Contains all child nodes |

For nodes whose `type` is `text`, they have the following additional fields:

| Field name | Type | Description |
|---|---|---|
| `str` | `string` | `slicestr PAGE.Content start end` |

For nodes whose `type` is `tag`, they have the following additional fields:

| Field name | Type | Description |
|---|---|---|
| `tagInfo` | `TagInfo` | [Tag information](#taginfo-tag-information) |
| `headingLevel` | `bool`/`int` | If it is h1\~h6 and has an id attribute, the value is 1\~6, otherwise it is false or 0 |
| `children` | `[]DocNode` | Contains all child nodes |
| `str` | `string` | `slicestr PAGE.Content start end` (similar to `outerHTML` in js) |
| `innerHTML` | `string` | Contents inside after removing the begin and end tags |

For nodes whose `type` is `comment`, they have the following additional fields:

| Field name | Type | Description |
|---|---|---|
| `str` | `string` | `slicestr PAGE.Content start end` (include `<!--` and `-->`) |

### `TagInfo` Tag information

| Field name | Type | Description |
|---|---|---|
| `original` | `string` | The original begin tag string |
| `tagName` | `string` | Tag name |
| `attributes` | `dict` | See below for details |
| `isSelfClose` | `bool` | Is it a self-closing tag? |

For example:

```html
<p open data-a = "asdf" data-b = qwer data-c = 'zxcv' asdf-a = >qwer</p>
```

There will be `attributes`:

```json
{ "open": "", "data-a": "asdf", "data-b": "qwer", "data-c": "zxcv", "asdf-a": "" }
```

### `TocNode` Node for ToC tree

| Field name | Type | Description |
|---|---|---|
| `start` | `int` | The starting index of the node in `PAGE.Content` string |
| `end` | `int` | The ending index + 1 of the node in `PAGE.Content` string |
| `headingLevel` | `bool`/`int` | If it is the root node, it is false, otherwise it is 1\~6 |
| `children` | `[]TocNode` | Contains all child nodes |

If it is not a root node (`headingLevel != false`), it has the following additional fields:

| Field name | Type | Description |
|---|---|---|
| `innerHTML` | `string` | Contents inside after removing the begin and end tags |
| `tagInfo` | `TagInfo` | [Tag information](#taginfo-tag-information) |

## What is an intuitive ToC

What is counter-intuitive? What is intuitive?
For common headings, for example:

```md
# h1
## h2
```

Obviously, h2 is a subheading of h1. Hugo can handle this. But if:

1. What if the headings are not strictly increasing?
2. What if the first heading of the article is not h1 or h2?
3. What if the headings are not at the same level? (Currently, the only places where levels are generated in markdown are in block quotes and ordered/unordered lists.)

In these cases, there will be problems with the ToC generated by Hugo itself.
Cases 1 and 2 are both at the same level. The correct logic should be that as long as the next heading is larger than the previous one, the next one should be regarded as a direct subheading of the previous one.
Case 3 is more complicated, but the overall idea is that all headings under the sub-level should be sub-headings of this level.

One of the more tangled points is the hierarchy of headings in ol and ul. Generally:

```md
# h1
## h2
## h2
### h3
# h1
```

The resulting ToC is:

```text
+-- h1
|   +-- h2
|   `-- h2
|       `-- h3
`-- h1
```

But this logic may not work in an ordered/unordered list, Example 1:

```md
* # h1
* ## h2
```

What would this intuitive ToC look like? There are two possible solutions:

1. h1 and h2 are treated as peers (Solution 1). This will produce:
   
   ```text
   +-- h1
   `-- h2
   ```
2. h2 is a child of h1 (Solution 2). This will produce:
   
   ```text
   `-- h1
       `-- h2
   ```

Example 2:

```md
* # h1
  * ## h2 - 1
  * ### h3
* ## h2 - 2
```

What is the intuitive ToC in Example 2? In this case, it is intuitive only if `h1` and `h2 - 2` are at the same level, and `h2 - 1` and `h3` are at the same level.

Therefore the current plan is to use only siblings in ordered/unordered lists, and only sublists will be considered children (Solution 1).

> On the other hand, the author may have written this to divide the logical hierarchy through ordered/unordered lists, so this solution is also intuitive.

Finally, this project adopted solution 1. The ToC of Example 2 is:

```text
+-- h1
|   +-- h2 - 1
|   `-- h3
`-- h2 - 2
```
