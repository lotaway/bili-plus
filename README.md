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
- 每日自动学习学习计划

## 项目结构

本项目采用typescript+react+vite制作chrome浏览器插件，通过协调页面、插件、后端接口共同完成任务，目录结构如下：

- `public` - 公共文件，包含浏览器插件声明文件
- `components` - 前端组件
- `src/entry` - 入口文件，加载各个模块,vite需按照这些入口编译输出成多个文件
- `src/entry/background` - 后台脚本，处理核心任务
- `src/entry/content` - 内容脚本，连接页面与扩展
- `src/entry/inject` - 页面注入脚本，获取页面信息和执行页面操作
- `src/entry/popup` - 弹出页面，用于全局配置和设置用户喜好
- `src/entry/sidepanel` - 侧边栏界面，主要功能操作区域和统一信息输出
- `src/enums` - 各种状态、类型枚举
- `src/features` - 功能模块，entry里实际功能实现是放在这里
- `src/services` - 服务模块，包含调用接口或者设备功能调用
- `src/store` - 数据与应用状态存储
- `src/styles` - 公共UI样式
- `src/types` - 类型定义文件
- `src/utils` - 通用工具函数
- `tests/specs` - e2e测试

## 代码规范

代码需遵循[CODE_PRICEPLES](./CODE_PINCEPLES/CODE_PRICEPLES)文件记载的规范准则
