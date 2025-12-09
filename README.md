# BILI PLUS

## 功能介绍

BILI PLUS 是一个增强 B 站体验的浏览器扩展，提供多种实用功能来提升视频观看体验。

主要功能包括：
- **字幕提取**：自动提取当前视频字幕，支持下载为 SRT 格式或带时间戳的 Markdown 格式
- **AI 字幕总结**：使用 AI 模型对字幕内容进行智能分析和总结
- **截图分析**：截取当前页面并使用 AI 分析界面内容
- **AI 智能助手**：与 AI 进行对话，获取视频相关的帮助和解答

## AI 功能支持

支持多种 AI 模型服务，包括 OpenAI、Ollama 等主流提供商。推荐搭配 [local-llm-provider](https://github.com/lotaway/local-llm-provider) 使用。

## 使用方法

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择本项目目录
5. 打开任意 B 站视频页面
6. 点击扩展图标，在侧边栏中使用各项功能

## 核心特性

- 自动读取登录信息，无需手动输入
- 智能识别可用字幕语言
- 一键导出字幕文件（SRT/Markdown 格式）
- AI 智能分析和总结功能
- 实时截图和界面分析

## 项目结构

- `src/entry/background` - 后台脚本，处理核心任务
- `src/entry/content` - 内容脚本，连接页面与扩展
- `src/entry/biliVideo` - 页面注入脚本，获取视频信息
- `src/entry/popup` - 弹出页面，用于配置和设置
- `src/entry/sidepanel` - 侧边栏界面，主要功能操作区域

## 待实现功能

- 在视频页面直接显示下载按钮
- 支持视频和音频下载功能
- 更多 AI 增强功能
