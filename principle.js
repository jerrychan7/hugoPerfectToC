
function main(content) {
  /*
    构建文档树。
    node 有几个必须的字段：
      start 起始下标
      end 结束下标 + 1
      id 节点唯一字符串 "start,end"
      type 节点的类型
    node 根据type字段区分，有几种类型：
      "root" 根节点
        有一个 children 字段，是一个数组，包含了所有的子节点
      "text" 文本节点
        有一个 str 字段，是文本的内容
      "tag" 标签节点
        有一个 tagInfo 字段，是标签的信息。tagInfo 有几个字段：
          original 原始的标签字符串
          tagName 标签名
          attributes 属性
          isSelfClose 是否是自闭合标签
        有一个 headingLevel 如果是h1~h6并且有id属性则保留，则值为1~6，否则为false或者0
        有一个 children字段，是一个数组，包含了所有的子节点
        有一个 str 节点的字符串，是包括标签本身的内容在内的所有内容
        有一个 innerHTML 字段，是标签内部的内容
      "comment" 注释节点
        有一个 str 字段，是注释的内容（包括<!---->）
  */
  function buildTree($) {
    const $rootNodes = [];
    let $idx = $.offset;
    let $content = $.content;
    let $len = $content.length;

    for (; $idx < $len; ++$idx) {
      let $chr = $content[$idx];
      let $node = {
        "start": $idx,
        "end": $idx + 1,
        "id": $idx + "," + ($idx + 1),
        "type": "text",
        "str": $chr,
      };
      let $tc = $content.slice($idx);
      let $isText = true;
      if ($chr === "<") {
        if ($tc.startsWith("</" + $.parentTagName)) {
          let t = new RegExp("</" + $.parentTagName + "\\s*>");
          let $tag = $tc.match(t);
          if ($tag) {
            $idx += $tag[0].length - 1;
            break;
          }
        }
        else if ($tc.startsWith("<!--")) {
          let $comment = $tc.match(/<!--.*?-->/s);
          if ($comment) {
            $node = {
              "start": $idx,
              "end": $idx + $comment[0].length,
              "id": $idx + "," + ($idx + $comment[0].length),
              "type": "comment",
              "str": $comment[0],
            };
            $idx += $comment[0].length - 1;
            $isText = false;
          }
        }
        else {
          // TODO: 判断是否有相应的结束标签 但感觉场景比较少后面再说吧
          let $t = $tc.match(/<([\w-]+)(?:\s+[\w-]+(?:\s*=\s*(?:(?:"(?:[^""]*)")|(?:'(?:[^'']*)')|(?:[^\s>]*)))?)*\s*(\/?)>/);
          if ($t) {
            $isText = false;
            let [$ori, $tag, $isSelfClose] = $t;
            let $attr = {};
            // for `<p open data-a = "asdf" data-b = qwer data-c = 'zxcv' asdf-a = >qwer</p>`
            // to { "open": "", "data-a": "asdf", "data-b": "qwer", "data-c": "zxcv", "asdf-a": "" }
            for (let m of $ori.slice($tag.length + 1, $isSelfClose? -2: -1).matchAll(/([\w-]+)(?:\s*=\s*(?:(?:"([^"]*)")|(?:'([^']*)')|([^\s>]*)))?/g)) {
              let $key = m[1];
              let $val = m[2] || m[3] || m[4] || "";
              $attr[$key] = $val;
            }
            let $children = { "children": [], "start": $idx + $ori.length, "end": $idx + $ori.length };
            if ("br,meta,base,hr,img,input,col,frame,link,area,param,object,applet,embed,keygen,source".split(",").includes($tag)) {
              // 这里判断是否是自闭合标签 如果不是则需要将内部所有的内容都忽略掉
              if ($isSelfClose !== "/") {
                let reg = new RegExp(".*?</" + $tag + "\\s*>", "s");
                let $end = $tc.slice($ori.length).match(reg);
                if ($end) {
                  $children.end += $end[0].length - 1;
                }
                $isSelfClose = "/";
              } else --$children.end;
            }
            let $tagInfo = { "original": $ori, "tagName": $tag, "attributes": $attr, "isSelfClose": $isSelfClose === "/" };
            if ($isSelfClose !== "/") {
              $children = buildTree({ "offset": $idx + $ori.length, "content": $content, "parentTagName": $tag });
            }
            let $end = $children.end + 1;
            $node = {
              "start": $idx,
              "end": $end,
              "id": $idx + "," + $end,
              "type": "tag",
              "tagInfo": $tagInfo,
              "headingLevel": ["h1", "h2", "h3", "h4", "h5", "h6"].includes($tagInfo.tagName) && $tagInfo.attributes.id && +$tagInfo.tagName[1],
              "children": $children.children,
              "str": $content.slice($idx, $end),
              "innerHTML": $children.children.length === 0 ? "" : $content.slice($children.children[0].start, $children.children.at(-1).end),
            };
            $idx = $children.end;
          }
        }
      }

      if ($isText && $rootNodes.length !== 0 && $rootNodes.at(-1).type === "text") {
        let $t = $tc.match(/[^<]+/);
        $rootNodes.at(-1).str += $t[0];
        $idx += $t[0].length - 1;
        $rootNodes.at(-1).end = $idx + 1;
        $rootNodes.at(-1).id = $rootNodes.at(-1).start + "," + ($idx + 1);
        continue;
      }

      $rootNodes.push($node);
    }

    return {
      "start": $.offset,
      "end": $idx,
      "id": $.offset + "," + $idx,
      "type": "root",
      "children": $rootNodes,
    };
  }

  let $tree = buildTree({ "offset": 0, "content": content, "parentTagName": "" });

  // 剪枝
  // 将要转化为目录的h1~h6相关的内容保留下来，剩下其他的都删除
  // 有些需要缩减层数的也要处理

  // 精简文档树
  // 删除和目录无关的节点 返回布尔值 如果节点需要被删除（该节点及其子代都和目录无关）返回true 否则返回false
  function rmNodeNotRelated2ToC($tree) {
    if ($tree.type === "root") {
      $tree.children = $tree.children.filter($node => !rmNodeNotRelated2ToC($node));
    }
    else if ($tree.headingLevel) {
      // 如果是h1~h6并且有id属性则保留
      return false;
    }
    else if ($tree.type === "tag") {
      $tree.children = $tree.children.filter($node => !rmNodeNotRelated2ToC($node));
      return $tree.children.length === 0;
    }
    return true;
  }

  rmNodeNotRelated2ToC($tree);


  // 压缩层数 如果直接子代都不直接包含标题，则删除该节点，将子代提升到该节点的位置【暂时不做

  /*
    一个比较纠结的点是，在ol和ul中的标题的层级问题。一般来说，在其他元素中：
    # h1
    ## h2
    ## h2
    ### h3
    # h1
    产生的目录是：
    +-- h1
    |   +-- h2
    |   `-- h2
    |       `-- h3
    `-- h1
    但是在有序/无序列表中这个逻辑可能就行不通了，例1：
    * # h1
    * ## h2
    这符合直觉的目录是怎样的呢？这有两种可能：
    1. h1 和 h2 作为同级的看待
    2. h2 作为 h1 的子代
    那例2：
    * # h1
      * ## h2 - 1
      * ### h3
    * ## h2 - 2
    这种的怎么才是符合直觉的呢？对于这种情况，只有 h1 和 h2 - 2 是同级的，h2 - 1 和 h3 是同级的，才是符合直觉的

    因此目前计划是在有序/无序列表中只采用同级的方法，而只有子列表才会视为子代，采用这个方法，例1的目录是：
    +-- h1
    `-- h2
    例2的目录是：
    +-- h1
    |   +-- h2 - 1
    |   `-- h3
    `-- h2 - 2

    有两种情况视为子heading：兄弟heading且下一个大于当前的；子节点中包含的heading
    const actualToc = {};
    article.querySelectorAll("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]").forEach(ele => {
      const level = +ele.tagName[1];
      const node = {ele, id: ele.id, level, deep: 0, childHeadings: [], parent: null};
      actualToc[ele.id] = node;
      for (let flag = false, e = ele, root = e.parentElement; !flag; ) {
        let sibling = e.previousElementSibling;
        while (!flag && sibling) {
          // root !== ele.parentElement 说明当前的 heading 必定是子 heading，就不需要判断 level 的大小了
          if (sibling.id in actualToc && (
            root !== ele.parentElement || actualToc[sibling.id].level < node.level
          )) {
            node.parent = actualToc[sibling.id];
            actualToc[sibling.id].childHeadings.push(node);
            flag = true;
          }
          sibling = sibling.previousElementSibling;
        }
        if (root === article) break;
        root = (e = root).parentElement;
      }
      let deep = 0;
      for (let parent = node.parent; parent; parent = parent.parent, ++deep);
      node.deep = deep;
    });
  */

  // 返回标题节点的上一个兄弟节点在父节点中的的下标
  function getPrevSiblingHeading($heading, $parent) {
    let $p = 0;
    while ($p < $parent.children.length) {
      let $node = $parent.children[$p];
      if ($node.id === $heading.id) break;
      ++$p;
    }
    let $sibling = $p - 1;
    while ($sibling >= 0) {
      let $node = $parent.children[$sibling];
      if ($node.headingLevel) break;
      --$sibling;
    }
    return $sibling;
  }
  // 遍历精简文档树，构建目录树。注意是两颗不同的树。
  // 返回目录树的根节点
  function doc2tocTree($docTree) {
    // id : node
    let $docNodes = {};
    // id : parent id
    let $docParentTree = {};
    // 将精简文档树展平成节点字典和类似并查集的树
    function flatTree($root, $parentId = "") {
      let $id = $root.id;
      $docNodes[$id] = $root;
      $docParentTree[$id] = $parentId;
      // root / tag
      $root.children?.forEach($c => flatTree($c, $id));
    }
    flatTree($docTree);
    console.log({$docTree, $docNodes, $docParentTree})

    let $tocParentTree = {};
    for (let $docNodeId in $docNodes) {
      let $docNode = $docNodes[$docNodeId];
      if (!$docNode.headingLevel) continue;
      let $docNodeParentId = $docParentTree[$docNodeId];
      let $p = $docNode;
      while (true) {
        let $parent = $docNodes[$docParentTree[$p.id]];
        let $siblingIdx = getPrevSiblingHeading($p, $parent);
        if ($siblingIdx === -1) {
          if ($parent.type === "root") {
            $tocParentTree[$docNodeId] = $parent.id;
            break;
          }
          $p = $parent;
          continue;
        }
        let $sibling = $parent.children[$siblingIdx];
        if ($parent.id !== $docNodeParentId || $sibling.headingLevel < $docNode.headingLevel) {
          $tocParentTree[$docNodeId] = $sibling.id;
          break;
        }
        $p = $sibling;
      }
    }

    console.log($tocParentTree)
    console.log(Object.entries($tocParentTree).map(([a, b]) => `${$docNodes[a].innerHTML} => ${$docNodes[b].innerHTML || $docNodes[b].type }`))
    
    // id : toc node
    let $tocNodes = {
      [$docTree.id]: {
        "start": $docTree.start,
        "end": $docTree.end,
        "headingLevel": false,
        "children": [],
      },
    };
    for (let $id in $tocParentTree) {
      let $docNode = $docNodes[$id];
      $tocNodes[$id] = {
        "start": $docNode.start,
        "end": $docNode.end,
        "tagInfo": $docNode.tagInfo,
        "headingLevel": $docNode.headingLevel,
        "innerHTML": $docNode.innerHTML,
        "children": [],
      };
    }
    for (let $id in $tocParentTree) {
      let $pid = $tocParentTree[$id];
      $tocNodes[$pid].children.push($tocNodes[$id]);
    }
    
    return $tocNodes[$docTree.id];
  }

  $tree = doc2tocTree($tree);

  console.log($tree);

  // document.body.innerHTML = `<pre><code>${JSON.stringify($tree, null, 2).replace(/</g, "&lt;")}</code></pre>`;
  
  function tocTree2ul($tree) {
    return `<ul>${
      $tree.children.map($c => `<li>${
        $c.innerHTML
      }${
        tocTree2ul($c)
      }</li>`).join("")
    }</ul>`;
  }
  
  function tocTree2details($tree) {
    return $tree.headingLevel?
    `<details open>
      <summary>${$tree.innerHTML}</summary>
    ${
      $tree.children.map($c =>
        tocTree2details($c)
      ).join("")
    }</details>`
    : $tree.children.map($c => tocTree2details($c)).join("");
  }
  
  let t = tocTree2details($tree);
  console.log(t);
  // document.body.innerHTML = t;
}

window.onload = () =>
main(`<h2 id="h2---1">h2 - 1</h2>
<h4 id="h4">h4</h4>
<h2 id="h2---2">h2 - 2</h2>
<blockquote>
<h1 id="h1---1">h1 - 1</h1>
<h2 id="h2---3">h2 - 3</h2>
</blockquote>
<ul>
<li>
<h1 id="h1---2">h1 - 2</h1>
<ul>
<li>
<h2 id="h2---4">h2 - 4</h2>
</li>
<li>
<h3 id="h3">h3</h3>
</li>
</ul>
</li>
<li>
<h2 id="h2---5">h2 - 5</h2>
</li>
</ul>
<h3 id="h3---2">h3 - 2</h3>
`);

/*
<p>asdf</p>
  <p open data-a = "asdf" data-b = qwer data-c = 'zxcv' asdf-a = >qwer</p>
<img>
M</img
>
<!-- aaaasdf
asdfsd -->
<h1 id="test">Test <a href="#">#</a></h1>
<br/>
<h4 id="not-h1h2-first">not h1/h2 first</h4>
<h2 id="headings">Headings</h2>
<p>↓ The heading in the blockquote element.
Hopefully it will be possible to jump by ID, the same behavior as other heading elements.</p>
<blockquote>
<h1 id="h1">H1</h1>
<h2 id="h2">H2</h2>
</blockquote>
<ul>
<li>asdf
<ul>
<li>
<h1 id="h1-in-ul">H1 in ul</h1>
</li>
<li>
<h2 id="h2-in-ul">H2 in ul</h2>
</li>
</ul>
</li>
</ul>
<ol>
<li>
<h1 id="h1-in-ol">H1 in ol</h1>
</li>
<li>
<h2 id="h2-in-ol">H2 in ol</h2>
</li>
</ol>
<h2 id="table">Table</h2>
<h5 id="heading">heading</h5>
<p>↑ Some non-incrementing headings.</p>
*/
