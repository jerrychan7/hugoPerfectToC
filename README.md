
# Hugo Perfect ToC Generator

[中文](./README.cn.md)

A Hugo template library for generating the intuitive table of contents.

- [Hugo Perfect ToC Generator](#hugo-perfect-toc-generator)
  - [Feature](#feature)
  - [Usage](#usage)
  - [Reason for the project](#reason-for-the-project)
  - [Principle](#principle)
  - [What is an intuitive ToC](#what-is-an-intuitive-toc)

## Feature

* [x] Intuitive table of contents generation
* [x] No extra or empty levels
* [x] Proper handling of table of contents in blockquotes/lists
* [ ] Hugo Goldmark Extras extension support ([hugo#12605](https://github.com/gohugoio/hugo/issues/12605))
* [x] ul element renderer
* [ ] ol element renderer
* [x] details element renderer
* [ ] ASCII style renderer
* [ ] User-defined renderers
* [x] Free-to-use ToC tree for any advanced features you want
* [ ] Configurable `startLevel` and `endLevel`
* [ ] Performance optimization

## Usage

Download the latest package in [Releases Page](./releases).
Put all the html files in the `partials/tocLib` folder. Then you can start using it.

For example, if you want to add a ToC at the beginning of the article, `layouts/_default/single.html`:

```hugo
{{ define "main" }}
  <h1>{{ .Title }}</h1>

  {{- partial "tocLib/gen.html" (dict
    "page" .
    "renderer" "tocLib/tocTree2ul.html"
  ) -}}

  {{ .Content }}
{{ end }}
```

The performance of the current project is not very good, you can use `partialCached` to speed it up slightly, using `PAGE.Content` as the unique cache key:

```hugo
{{- partialCached "tocLib/gen.html" (dict
  "page" .
  "renderer" "tocLib/tocTree2ul.html"
) .Content -}}
```

Params `renderer`:

* `"tocLib/tocTree2ul.html"` Default value. Corresponding to Hugo configuration `markup.tableOfContents.ordered = false`
* `"tocLib/tocTree2ol.html"` Corresponding to Hugo configuration `markup.tableOfContents.ordered = true`
* `"tocLib/tocTree2details.html"`

If you want to customize the renderer, or do any advanced usage, you may want to check out the source code of this project.

## Reason for the project

Although Hugo has a built-in table of contents function `PAGE.TableOfContents`, it generates non-intuitive tables of contents in some scenarios.
It is rare, but some issues have shown that this problem still occurs, such as [hugo#1778](https://github.com/gohugoio/hugo/issues/1778), [hugo#7128](https://github.com/gohugoio/hugo/issues/7128), [hugo#12917](https://github.com/gohugoio/hugo/issues/12917).
To summarize the problem, it is basically:

1. If the first heading of the article is not h1/h2, an extra level will be output as the first item in the ToC, which is difficult to adjust with the `startLevel` option (because h1/h2 is still quite common in articles)
2. Non-strictly increasing headings will output extra levels, such as jumping directly from h1 to h6. Some authors have a bad habit of using headings to highlight certain content. Yeah, it's bad practice, but it can happen.
3. The Hugo generated ToC does not make sense when a heading is inside a block quote or an ordered/unordered list. The intuitive approach would be to treat it as a subheading.
4. Some headings of the Hugo Goldmark Extras extension were not rendering correctly ([hugo#12605](https://github.com/gohugoio/hugo/issues/12605)).

> As for what is counter-intuitive? What is intuitive? Please see the section at the end of this article [# What is an intuitive ToC](#what-is-an-intuitive-toc).

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

> # H1
>
> ## H2

------------------------------

## Table

##### non-incrementing heading

↑ Some non-incrementing headings.

------------------------------

# heading in ul/ol

* ## h2
  * ### 3
* #### h4

------------------------------

# test ~~del~~

```

|`PAGE.TableOfContents`|本项目的输出|
|---|---|
|<ul><li><ul><li><ul><li><ul><li>not h1/h2 first</li></ul></li></ul></li><li>Headings</li></ul></li><li>H1<ul><li>H2</li><li>Table<ul><li><ul><li><ul><li>non-incrementing heading</li></ul></li></ul></li></ul></li></ul></li><li>heading in ul/ol<ul><li>h2<ul><li>h3<ul><li>h4</li></ul></li></ul></li></ul></li><li>test del</li></ul>|<ul><li>not h1/h2 first</li><li>Headings<ul><li>H1<ul><li>H2</li></ul></li></ul></li><li>Table<ul><li>non-incrementing heading</li></ul></li><li>heading in ul/ol<ul><li>h2<ul><li>h3</li></ul></li><li>h4</li></ul></li><li>test <del>del</del></li></ul>|

## Principle

1. `PAGE.Content` stores the HTML parsed from the markdown file.
2. Build a document tree by parsing HTML.
3. Build a ToC tree based on the real document structure by parsing the document tree.
4. Through the ToC tree, users can choose different renderers to render different ToC contents. By default, ordered/unordered lists and details are provided.

> Why not use `PAGE.Fragments`?  
> This is because this structure is generated by Hugo when it generates `PAGE.TableOfContents`, so it is impossible to accurately restore the intuitive directory through this.

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

```txt
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
   
   ```txt
   +-- h1
   `-- h2
   ```
2. h2 is a child of h1 (Solution 2). This will produce:
   
   ```txt
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

```txt
+-- h1
|   +-- h2 - 1
|   `-- h3
`-- h2 - 2
```
