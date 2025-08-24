<div align="center">
  <img src="assets/icons/icon.png" alt="OI-Wiki Copilot Logo" width="128" height="128">
  <h1>OI-Wiki Copilot</h1>
  <p><strong>专为 OI-Wiki 打造的浏览器增强插件，你的私人算法学习助理。</strong></p>
  <p>
    <a href="https://github.com/your-username/oi-wiki-copilot/releases/latest"><img src="https://img.shields.io/github/v/release/your-username/oi-wiki-copilot?style=flat-square" alt="Current Version"></a>
    <a href="https://github.com/your-username/oi-wiki-copilot/blob/main/LICENSE"><img src="https://img.shields.io/github/license/your-username/oi-wiki-copilot?style=flat-square" alt="License"></a>
    <a href="#"><img src="https://img.shields.io/chrome-web-store/d/your-extension-id?style=flat-square&label=Chrome%20Web%20Store" alt="Chrome Web Store Users"></a>
  </p>
</div>

---

**OI-Wiki Copilot** 是一款功能强大的浏览器扩展，旨在提升您在 [OI-Wiki](https://oi-wiki.org/) 上的阅读和学习体验。它通过注入一系列智能工具，将您的浏览器变为一个强大的算法学习环境。

## ✨ 核心功能

| 功能 | 简介 | 截图预览 |
| :--- | :--- | :--- |
| **自定义注释** | 选中任何术语（如“松弛”、“border”），添加您自己的理解。从此告别反复翻阅定义，鼠标悬停即可查看注释。 | *[此处放置自定义注释功能的截图]* |
| **智能 AI 问答** | 遇到难题？随时选中段落，右键“对 AI 提问”。Copilot 会结合上下文，为您提供精准、深入的解答。 | *[此处放置 AI 问答功能的截图]* |
| **AI 文本润色** | 觉得某段原文晦涩难懂？选中它，让 AI 为您“优化此段落”，一键生成更清晰、更易于理解的表达方式。 | *[此处放置 AI 润色功能的截图]* |
| **右键快捷查询** | 在任何网页上选中文字，右键即可直接在 OI-Wiki 中进行搜索，无缝衔接您的学习流程。| *[此处放置快捷查询功能的截图]* |

## 🚀 安装与配置

### 1. 安装

您可以通过以下两种方式安装此插件：

*   **（推荐）从 Chrome 应用商店安装**：
    > *链接将在插件上架后提供。*

*   **手动加载**：
    1.  前往本项目的 GitHub 主页，点击右上角的 **Code** 按钮，然后选择 **Download ZIP** 下载最新的源码压缩包并解压。
  
    2.  打开 Chrome/Edge 浏览器，进入 `chrome://extensions/` 页面。
    3.  开启右上角的“开发者模式”。
    4.  点击“加载已解压的扩展程序”，选择刚才解压出的文件夹。

### 2. 配置 AI 功能

为了使用 AI 问答和文本润色功能，您需要一个 [Siliconflow](https://siliconflow.cn/) 的 API Key。该平台为开发者提供了大量免费的高质量大语言模型调用额度。

1.  在浏览器工具栏找到 **OI-Wiki Copilot** 图标，点击它，然后点击右上角的设置图标（⚙️）进入设置页面。
2.  在“AI 设置”中，填入您的 Siliconflow API Key。
3.  （可选）您可以指定您想使用的模型 ID，默认为 `Qwen/Qwen2.5-7B-Instruct`。
4.  点击“保存设置”。

## 🎬 使用演示

*[此处放置一个 GIF 动图，演示插件的核心功能]*

## 🛠️ 自定义与管理

*   **管理注释**：点击浏览器工具栏的插件图标，即可进入注释管理页面，您可以随时添加、修改或删除您的自定义注释。
*   **开关右键菜单**：在设置页面，您可以根据自己的使用习惯，自由开启或关闭特定的右键菜单功能。

## 🤝 贡献与反馈

我们欢迎任何形式的贡献和反馈！

*   如果您有任何建议或发现了 Bug，请在本项目的 [Issues](https://github.com/your-username/oi-wiki-copilot/issues) 页面提出。
*   如果您想为项目贡献代码，请 Fork 本仓库并提交 Pull Request。

## 📄 开源许可证

本项目基于 [AGPL License](LICENSE) 开源。
