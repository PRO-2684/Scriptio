<img src="./icons/icon.svg" align="right" style="width: 6em; height: 6em;"></img>

# Scriptio

[LiteLoaderQQNT](https://github.com/mo-jinran/LiteLoaderQQNT) 插件，用于为 QQNT 加载任意**渲染层**的 JavaScript 片段。

你可能也感兴趣：[Transitio](https://github.com/PRO-2684/transitio)，自定义 CSS 片段加载器。

## 🪄 具体功能

- 导入 js 代码片段
- 启用/禁用 js 代码片段
    - 约定：说明若以 `* ` 开头，则启用/禁用此脚本需要重启/重载 *被注入此脚本的窗口* 生效，否则立即生效
    - 由于 js 代码的复杂性，立即生效由脚本自行实现，Scriptio 仅提供 `scriptio-toggle-<脚本名>` 事件以供脚本监听 (参考 [Wiki](https://github.com/PRO-2684/Scriptio/wiki) 中的 [响应性脚本](https://github.com/PRO-2684/Scriptio/wiki/%E7%94%A8%E6%88%B7%E8%84%9A%E6%9C%AC%E5%BC%80%E5%8F%91#%E5%93%8D%E5%BA%94%E6%80%A7%E8%84%9A%E6%9C%AC) 章节)

## 🖼️ 截图

> 演示中使用了 [MSpring-Theme](https://github.com/MUKAPP/LiteLoaderQQNT-MSpring-Theme)，主题色为 `#74A9F6`。

![Scriptio](./attachments/settings.jpg)

## 📥 安装

### 插件商店

在插件商店中找到 Scriptio 并安装。

### 手动安装

- 稳定版: 下载 Release 中的 `scriptio-release.zip`，解压后放入[数据目录](https://github.com/mo-jinran/LiteLoaderQQNT-Plugin-Template/wiki/1.%E4%BA%86%E8%A7%A3%E6%95%B0%E6%8D%AE%E7%9B%AE%E5%BD%95%E7%BB%93%E6%9E%84#liteloader%E7%9A%84%E6%95%B0%E6%8D%AE%E7%9B%AE%E5%BD%95)下的 `plugins/Scriptio` 文件夹中即可。(若没有该文件夹请自行创建)
- CI 版: 若想体验最新的 CI 功能，可以下载源码后同上安装。(仅需下载下面列出的文件)

完成后的目录结构应该如下:

```
plugins (所有的插件目录)
└── Scriptio (此插件目录)
    ├── manifest.json (插件元数据)
    ├── main.js (插件脚本)
    ├── preload.js (插件脚本)
    ├── renderer.js (插件脚本)
    ├── settings.html (插件设置界面)
    └── icons/ (插件用到的图标)
```

## 🤔 使用方法

> [!WARNING]
> 由于 js 代码的复杂性，禁用/修改部分脚本可能需要**重启/重载生效**

- 启用/禁用脚本：打开插件设置界面，将对应的脚本开关打开/关闭。
    - 注意：禁用脚本，实际上是在文件内第一行注释末尾添加了 `[Disabled]` 标记。
- 导入脚本：在配置界面导入 JS 文件，或将之放入 `plugins_data/Scriptio/scripts/` 文件夹。
    - JS 文件首行的注释（若有）会被当作脚本说明，显示在设置界面中。
- 删除脚本：~~点击删除按钮，或~~进入 `plugins_data/Scriptio/scripts/` 文件夹删除对应文件。
- 修改脚本：修改对应文件即可。
- 更新脚本：重新导入即可。
- 重载脚本：双击“用户脚本”这个标题。

## 💻 调试

- 开发者模式：若您想要调试**您的用户脚本**，可以在插件设置界面打开*开发者模式*，此时插件会监控 `plugins_data/scriptio/scripts/` 文件夹，当发生更改时，会自动重载。
- Debug 模式：若您想要调试**此插件本身**，可以使用 `--scriptio-debug` 参数启动 QQNT，此时插件会在控制台输出调试信息。

## 📜 用户脚本

> [!NOTE]
> 以下脚本均为由我/其它用户编写的用户脚本，不内置在插件中。你可以下载后**修改其内容**来满足你的需求，随后将其**导入到插件中**来体验。
>
> 若你有愿意分享的脚本，欢迎[提交 PR 或 Issue](https://github.com/PRO-2684/Scriptio/issues/1) 来将它们添加到这里。编写脚本前推荐先阅读 [Wiki](https://github.com/PRO-2684/Scriptio/wiki)。

> [!WARNING]
> 请不要在文件名中使用诸如句点 `.`, 空格 ` `, 加 `+` 等特殊字符，否则可能会导致插件无法正常工作。推荐仅使用字母、数字、下划线 `_` 与连字符 `-`。

| 名称 | 作者 | 说明 | 实时响应 | 链接 |
| --- | --- | --- | --- | --- |
| hitokoto | [PRO-2684](https://github.com/PRO-2684) | 输入框展示一言 | ✔️ | [GitHub](https://github.com/PRO-2684/Scriptio-user-scripts/#hitokoto) |
| img-quick-close | [PRO-2684](https://github.com/PRO-2684) | 快速关闭图片 | ✖️ | [GitHub](https://github.com/PRO-2684/Scriptio-user-scripts/#img-quick-close) |
| shortcutio | [PRO-2684](https://github.com/PRO-2684) | 添加一些常用的快捷键 | ✖️ | [GitHub](https://github.com/PRO-2684/Scriptio-user-scripts/#shortcutio) |
