# AI 文章分类规范

文章继续放在 `posts/ai/md/`，文件名使用 `YYYY-MM-DD-标题.md`，图片保留现有路径。

每篇文章选择一个 `category` 主分类，并填写 `tags`、`title`、`date` 和 `excerpt`。`categories` 旧字段可以保留；页面优先展示 `category`。

| 主分类 | 内容范围 |
| --- | --- |
| 深度学习基础 | 神经网络、梯度、训练流程、RNN 和序列模型 |
| Transformer 与模型架构 | Attention、位置编码、Transformer 结构与模型架构对比 |
| 提示学习与模型微调 | Prompt-Tuning、PEFT、LoRA、微调训练实践 |
| 推理与部署 | 量化、显存、多卡推理、模型服务与推理优化 |
| RAG 与智能体 | 知识库、检索增强、对话记忆、智能体与工具调用 |

跨主题文章以主要解决的问题为主分类，其余主题填写到标签中。例如以训练实践为主的 Transformer 文章归入“提示学习与模型微调”，包含 QLoRA 的多卡部署文章归入“推理与部署”。

```yaml
---
title: 文章标题
date: 2026-10-18
category: 提示学习与模型微调
tags: [LoRA, QLoRA, 模型微调]
languages: [Python]
excerpt: 一句话说明文章主题与解决的问题。
---
```

继续使用 `./deploy.sh` 发布。构建会校验主分类与标签，自动生成 AI 列表和五个分类页。
