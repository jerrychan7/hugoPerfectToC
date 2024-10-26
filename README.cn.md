
# Hugo Perfect ToC Generator

[English](./README.md)

一个用于生成符合直觉的目录的 [Hugo](https://gohugo.io/) 模板库。

开发不易，如果你使用了或喜欢本仓库，可以给我一个Star。~~关注项目不迷路~~

- [Hugo Perfect ToC Generator](#hugo-perfect-toc-generator)
  - [特性](#特性)
  - [用法](#用法)
  - [项目存在理由](#项目存在理由)
  - [原理](#原理)
  - [数据结构](#数据结构)
    - [`DocNode` 文档树节点](#docnode-文档树节点)
    - [`TagInfo` 标签信息](#taginfo-标签信息)
    - [`TocNode` 目录树节点](#tocnode-目录树节点)
  - [什么是符合直觉的目录](#什么是符合直觉的目录)

## 特性

* [x] 符合直觉的目录生成
* [x] 不输出任何多余的层级或空白层级
* [x] 合理的处理引用块/列表中的目录
* [x] Hugo Goldmark Extras 扩展支持（[hugo#12605](https://github.com/gohugoio/hugo/issues/12605)）
* [x] 在 Hugo 的 [heading render hooks](https://gohugo.io/render-hooks/headings/) 之后渲染
* [x] ul 元素渲染
* [x] ol 元素渲染
* [x] details 元素渲染
* [x] ASCII 风格渲染
* [x] 用户自定义渲染器
* [x] 能随意使用的目录树，以实现任何你想要的高级功能
* [x] 配置 `startLevel` 和 `endLevel`
* [x] 配置 `startDepth` 和 `endDepth`
* [ ] 性能优化

## 用法

将本项目中 `/tocLib` 目录下所有的html文件都放在 `你的网站或主题/layouts/partials/tocLib` 文件夹中。然后你就可以开始使用了。

例如你想在文章的开头添加目录，`layouts/_default/single.html`：

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

目前项目的性能比较差，你可以使用 `partialCached` 来略微加速，将 `PAGE.Content` 作为唯一缓存键：

```html
{{- partialCached "tocLib/gen.html" (dict "page" .) .Content -}}
```

参数 `renderer`：

* `"tocLib/tocTree2ul.html"` 缺省值。对应 Hugo 配置 [`markup.tableOfContents.ordered = false`](https://gohugo.io/getting-started/configuration-markup/#ordered) 功能
* `"tocLib/tocTree2ol.html"` 对应 Hugo 配置 [`markup.tableOfContents.ordered = true`](https://gohugo.io/getting-started/configuration-markup/#ordered) 功能
* `"tocLib/tocTree2details.html"`
* `"tocLib/tocTree2ascii.html"`

参数 `startLevel`：和 [`markup.tableOfContents.startLevel`](https://gohugo.io/getting-started/configuration-markup/#startlevel) 逻辑一样，缺省值 `2`。

参数 `endLevel`：和 [`markup.tableOfContents.endLevel`](https://gohugo.io/getting-started/configuration-markup/#endlevel) 逻辑一样，缺省值 `3`。

参数 `startDepth`：定义了目录树的起始深度（包含）。缺省值 1。  
参数 `endDepth`：定义了目录树的结束深度（包含）。缺省值 255。

> [!Tip]
> `startDepth` 和 `endDepth` 是在 `startLevel` 和 `endLevel` 之后运行的。

例如，对于以下文档：

```md
# depth 1, heading level 1

> # depth 2, heading level 1
> ## depth 3, heading level 2
> ### depth 4, heading level 3
> #### depth 5, heading level 4
> ##### depth 6, heading level 5
```

如果使用配置项 `startLevel = 2, endLevel = 5; startDepth = 2, endDepth = 3`，则会生成：

```text
`-- depth 4, heading level 3
    `-- depth 5, heading level 4
```

> [!NOTE]
> 如果你要控制目录的深度范围，应该使用 `startDepth` 和 `endDepth` 而非 `startLevel` 和 `endLevel`。  
> `startLevel` 和 `endLevel` 本意只是为了兼容 Hugo 用来控制要显示的目录级别的设置。但单纯通过这两个配置项是无法控制目录显示的深度的。

如果你想自定义渲染器，或者任何高级的玩法，你可能需要查看下面的[原理](#原理)和[数据结构](#数据结构)章节，并参考源码。

> 如果你想要和 `PAGE.TableOfContents` 生成的格式类似，你需要一个 `nav` 包装：
> 
> ```hugo
> <nav id="TableOfContents">
>   {{ partial "tocLib/gen.html" (dict "page" .) }}
> </nav>
> ```

## 项目存在理由

虽然 Hugo 自带有生成目录的功能 `PAGE.TableOfContents`，但在一些场景中会生成不符合直觉的目录。
虽然不多，但有些 issue 已经表明了这个问题还是会有发生。例如：[hugo#1778](https://github.com/gohugoio/hugo/issues/1778)、[hugo#7128](https://github.com/gohugoio/hugo/issues/7128)、[hugo#12917](https://github.com/gohugoio/hugo/issues/12917)。总结下基本是：

1. 非 h1/h2 打头的将会在目录的第一项输出多余的层级，这很难通过 `startLevel` 选项进行调整（因为文章中h1/h2还是比较常见的）
2. 非严格递增的标题将会输出多余的层级，例如从 h1 直接跳到 h6。有一些作者有坏习惯喜欢用标题来高亮以突出某些内容，是坏习惯但有可能出现
3. 在引用块或有序/无序列表中的标题输出是不合逻辑的。符合直觉的应该是将其视为子标题。
4. Hugo Goldmark Extras 扩展的一些标题无法正确呈现（[hugo#12605](https://github.com/gohugoio/hugo/issues/12605)）

> 至于什么叫不符合直觉的？究竟什么是符合直觉的？请看文末章节 [# 什么是符合直觉的目录](#什么是符合直觉的目录)。

假设启用了扩展：

```yaml
markup:
  goldmark:
    extensions:
      strikethrough: false
    extras:
      subscript:
        enable: true
```

对于如下的 markdown：

```md
---
title: "Markdown 语法指南"
date: 2024-10-01T23:17:15+08:00
draft: false
---

#### 非 h1/h2 打头

------------------------------

## 标题

↓ blockquote 元素中的标题。希望和其他标题元素一样能够通过 ID 跳转。

> # H1 在 blockquote 中
>
> ## H2 在 blockquote 中

------------------------------

## 表格

##### 非递增标题

↑ 一些非递增的标题。

------------------------------

# ul/ol 元素中的标题

* ## h2 在顶层
  * ### h3 在第二层
* #### h4 在顶层

------------------------------

# H~2~O

```

| `PAGE.TableOfContents` | 本项目的输出 |
|---|---|
| <ul><li><ul><li><ul><li><ul><li>非 h1/h2 打头</li></ul></li></ul></li><li>标题</li></ul></li><li>H1 在 blockquote 中<ul><li>H2 在 blockquote 中</li><li>表格<ul><li><ul><li><ul><li>非递增标题</li></ul></li></ul></li></ul></li></ul></li><li>ul/ol 元素中的标题<ul><li>h2 在顶层<ul><li>h3 在第二层<ul><li>h4 在顶层</li></ul></li></ul></li></ul></li><li>H2O</li></ul> | <ul><li>非 h1/h2 打头</li><li>标题<ul><li>H1 在 blockquote 中<ul><li>H2 在 blockquote 中</li></ul></li></ul></li><li>表格<ul><li>非递增标题</li></ul></li><li>ul/ol 元素中的标题<ul><li>h2 在顶层<ul><li>h3 在第二层</li></ul></li><li>h4 在顶层</li></ul></li><li>H<sub>2</sub>O</li></ul> |

## 原理

1. `PAGE.Content` 中存放的是从 md 中解析好的 html。
2. 通过解析 html 构建文档树。
3. 通过解析文档树，构建基于真实文档结构的目录树。
4. 通过目录树，用户可以选择不同的渲染器去渲染不同的目录内容，默认提供了有序/无序列表，和 details。

> 为何不用 `PAGE.Fragments`？  
> 这是由于这个结构本身就是 Hugo 在生成 `PAGE.TableOfContents` 时一起生成的，因此无法通过这个来准确的还原出符合直觉的目录。

## 数据结构

### `DocNode` 文档树节点

| 字段 | 类型 | 解释 |
|---|---|---|
| `start` | `int` | 节点在 `PAGE.Content` 中的起始下标 |
| `end` | `int` | 节点在 `PAGE.Content` 中的结束下标 + 1 |
| `id` | `string` | 节点唯一标识符，辅助后续算法实现，值为 `"start,end"` |
| `type` | `string` | 节点的类型。可能的值有：`root`, `text`, `tag`, `comment` |

对于 `type` 为 `root` 的节点，拥有以下额外字段：

| 字段 | 类型 | 解释 |
|---|---|---|
| `children` | `[]DocNode` | 包含了所有子节点 |

对于 `type` 为 `text` 的节点，拥有以下额外字段：

| 字段 | 类型 | 解释 |
|---|---|---|
| `str` | `string` | `slicestr PAGE.Content start end` |

对于 `type` 为 `tag` 的节点，拥有以下额外字段：

| 字段 | 类型 | 解释 |
|---|---|---|
| `tagInfo` | `TagInfo` | [标签的信息](#taginfo-标签信息) |
| `headingLevel` | `bool`/`int` | 如果是 h1 \~ h6 并且有 id 属性则值为 1\~6，否则为 `false` 或者 0 |
| `children` | `[]DocNode` | 包含了所有子节点 |
| `str` | `string` | `slicestr PAGE.Content start end` （相当于 `outerHTML`） |
| `innerHTML` | `string` | 去除起始和结束标签后内部的内容 |

对于 `type` 为 `comment` 的节点，拥有以下额外字段：

| 字段 | 类型 | 解释 |
|---|---|---|
| `str` | `string` | `slicestr PAGE.Content start end` （包含 `<!--` 和 `-->`） |

### `TagInfo` 标签信息

| 字段 | 类型 | 解释 |
|---|---|---|
| `original` | `string` | 原始的起始标签字符串 |
| `tagName` | `string` | 标签名 |
| `attributes` | `dict` | 属性，详见下 |
| `isSelfClose` | `bool` | 是否是自闭合标签 |

例如，对于：

```html
<p open data-a = "asdf" data-b = qwer data-c = 'zxcv' asdf-a = >qwer</p>
```

将会有 `attributes`：

```json
{ "open": "", "data-a": "asdf", "data-b": "qwer", "data-c": "zxcv", "asdf-a": "" }
```


### `TocNode` 目录树节点

| 字段 | 类型 | 解释 |
|---|---|---|
| `start` | `int` | 节点在 `PAGE.Content` 中的起始下标 |
| `end` | `int` | 节点在 `PAGE.Content` 中的结束下标 + 1 |
| `headingLevel` | `bool`/`int` | 如果根节点则为 `false`，否则为1\~6 |
| `children` | `[]TocNode` | 包含了所有子节点 |

如果不是根节点（`headingLevel != false`），拥有以下额外字段：

| 字段 | 类型 | 解释 |
|---|---|---|
| `innerHTML` | `string` | 去除标签后内部的内容 |
| `tagInfo` | `TagInfo` | [标签的信息](#taginfo-标签信息) |

## 什么是符合直觉的目录

什么叫不符合直觉的？究竟什么是符合直觉的？

对于普通的标题，例如：

```md
# h1
## h2
```

很明显，h2 是 h1 的子标题。这点上 Hugo 本身是可以处理的。但如果：

1. 标题不是严格递增的呢？
2. 标题不是 h1 或 h2 开始呢？
3. 标题不是在同一层级的呢？（目前 markdown 中会产生层级的是在引用块或有序/无序列表内。）

这些情况下 Hugo 本身生成的目录就会出现问题。
情况1和2都是在同一层级下的，正确的逻辑应该是同一层级下只要下一个标题大于上一个，则应该视为上一个的直接子标题。
情况3比较复杂，但整体的思路是，子层级下的所有标题应该都是本层级的子标题。

一个比较纠结的点是，在ol和ul中的标题的层级问题。一般来说，在其他元素中：

```md
# h1
## h2
## h2
### h3
# h1
```

产生的目录是：

```
+-- h1
|   +-- h2
|   `-- h2
|       `-- h3
`-- h1
```

但是在有序/无序列表中这个逻辑可能就行不通了，例1：

```md
* # h1
* ## h2
```

这符合直觉的目录是怎样的呢？这有两种可能的方案：

1. h1 和 h2 作为同级的看待（方案1）。将会产生：
   
   ```text
   +-- h1
   `-- h2
   ```
2. h2 作为 h1 的子代（方案2）。将会产生：
   
   ```text
   `-- h1
       `-- h2
   ```

那例2：

```md
* # h1
  * ## h2 - 1
  * ### h3
* ## h2 - 2
```

这种的怎么才是符合直觉的呢？对于这种情况，只有 `h1` 和 `h2 - 2` 是同级的，`h2 - 1` 和 `h3` 是同级的，才是符合直觉的。

因此目前计划是在有序/无序列表中只采用同级的方案，而只有子列表才会视为子代。

> 另一方面，作者这么写可能是想通过有序/无序列表来划分逻辑层级，那这个方案也是符合直觉的。

最终本项目采用的是方案1。那例2的目录是：

```text
+-- h1
|   +-- h2 - 1
|   `-- h3
`-- h2 - 2
```
