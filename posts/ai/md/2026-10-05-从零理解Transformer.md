---
title: 从零理解 Transformer：TinyTransformer 学习笔记
date: 2026-10-05
category: Transformer 与模型架构
categories: [深度学习, Transformer]
tags: [Transformer, Attention, 大语言模型, TinyTransformer]
languages: [Python]
excerpt: 从 Token、Embedding 和注意力机制出发，串联 Transformer 的结构、训练与生成流程。
---

# TinyTransformer 学习笔记：从零理解 Transformer

> 本文用最简单直白的方式，把 Datawhale `TinyTransformer` 中涉及的核心概念一路串起来。
>
> 学习主线：**Token → Embedding → 位置 → Q/K/V → Attention → Causal Mask → Multi-Head → Residual → LayerNorm → MLP → Transformer Layer → Encoder / Decoder → 输出 → Loss → 训练 → 生成**。
>
> 文章地址：https://github.com/datawhalechina/tiny-universe/tree/main/content/TinyTransformer

---

# 一、先用一句话理解 Transformer

Transformer 可以简单理解成：

> **先把词变成数字向量，再让每个词看看其他词、决定应该关注谁，然后把得到的信息重新加工，重复很多层，最后预测结果。**

对于 GPT 这种语言模型，可以再简单一点理解成：

> **每个词不断参考前面的词，最终预测下一个词。**

---

# 二、为什么需要 Transformer？

传统 RNN / LSTM 更偏向这样处理：

```text
我
 ↓
喜欢
 ↓
吃
 ↓
苹果
```

一个接一个。

Transformer 的思路是：

```text
我  喜欢  吃  苹果
 \   |    |   /
   同时建立关系
```

也就是说：

> **让一个词直接关注其他词。**

这个机制就是 Attention。

---

# 三、Attention 到底是什么？

一句话：

> **Attention = 决定应该关注谁，然后从这些人那里拿信息。**

例如：

```text
我 喜欢 吃 苹果
```

当模型处理“吃”时，它可能会认为：

```text
我      10%
喜欢    20%
吃      10%
苹果    60%
```

于是模型会重点拿“苹果”的信息。

所以 Attention 本质上就是：

```text
先决定看谁
↓
再决定看多少
↓
按这个比例拿信息
```

---

# 四、Q、K、V 到底是什么？

最简单的记法：

```text
Q = 我想找什么？
K = 你是什么？你和我匹不匹配？
V = 你能给我什么信息？
```

可以类比成“搜索”：

```text
Q：我要找什么
 ↓
和每个 K 比较
 ↓
判断谁最相关
 ↓
从对应的 V 里拿信息
```

所以：

> **Q 和 K 决定“关注谁”，V 决定“拿什么”。**

---

# 五、Attention 最核心的三步

整个 Attention 最核心的流程只有三步：

```text
Q × K
↓
算关系

Softmax
↓
算关注比例

Attention × V
↓
按比例拿信息
```

数学形式：

```text
Attention(Q,K,V)
= Softmax(QKᵀ / √d) V
```

初学阶段只需要理解成：

> **QKᵀ：找谁重要。**
>
> **Softmax：决定各自有多重要。**
>
> **×V：真正拿信息。**

---

# 六、`@` 是什么意思？

Python / PyTorch 中：

```python
A @ B
```

表示：

> **矩阵乘法。**

例如：

```python
A = [[1, 2],
     [3, 4]]

B = [[5, 6],
     [7, 8]]
```

```python
A @ B
```

得到：

```text
[ [19, 22],
  [43, 50] ]
```

所以代码：

```python
att = q @ k.transpose(-2, -1)
```

就是：

> **Q 和转置后的 K 做矩阵乘法，用来计算词与词之间的关系。**

---

# 七、`transpose(-2, -1)` 是什么意思？

假设：

```text
k.shape = (B, H, T, D)
```

从后往前数：

```text
-1 = 最后一个维度 D
-2 = 倒数第二个维度 T
```

所以：

```python
k.transpose(-2, -1)
```

就是：

> **把最后两个维度交换。**

也就是：

```text
(B, H, T, D)
↓
(B, H, D, T)
```

这样才能让：

```text
Q:      (B,H,T,D)
Kᵀ:     (B,H,D,T)
              ↓
结果:   (B,H,T,T)
```

这里的目的不是“为了形式好看”，而是为了让矩阵乘法能够成立。

---

# 八、为什么 `Q × Kᵀ` 是 `(B,H,T,T)`？

这是整个 Attention 里非常重要的一个理解点。

假设一句话有 `T` 个词。

每一个词都要问：

> **“我应该关注这句话里的哪个词？”**

于是：

```text
词1 → 看词1、词2、词3……
词2 → 看词1、词2、词3……
词3 → 看词1、词2、词3……
```

所以就会产生一个：

```text
T × T
```

的“关系表”。

可以想象成：

```text
          词1   词2   词3   词4
词1        ?     ?     ?     ?
词2        ?     ?     ?     ?
词3        ?     ?     ?     ?
词4        ?     ?     ?     ?
```

它表示：

> **每一个词，分别和所有词比较。**

所以：

```text
Q × Kᵀ → (B,H,T,T)
```

其中最后两个 `T` 就是：

> **Query 有多少个词 × Key 有多少个词。**

---

# 九、为什么 `Attention × V` 又变回 `(B,H,T,D)`？

因为：

```text
Attention：告诉每个词“应该从谁那里拿多少信息”
V：        保存每个词真正要提供的信息
```

假设一句话有两个词：

```text
V：
词1 → [1,2,3,4]
词2 → [5,6,7,8]
```

如果词1的注意力是：

```text
词1：20%
词2：80%
```

那么词1的新表示就是：

```text
20% × 词1的信息
+
80% × 词2的信息
```

最后还是一个 4 维向量。

而一句话有几个词，就会得到几个这样的新向量。

所以：

```text
Attention × V
→ (T,D)
```

加上 Batch 和 Head：

```text
(B,H,T,T)
×
(B,H,T,D)
↓
(B,H,T,D)
```

最简单的理解：

> **QKᵀ 负责“找谁”，Attention×V 负责“从这些人那里拿信息”。**

---

# 十、B、T、C、H、D 到底是什么？

这些字母是看 Transformer 源码时最重要的几个符号。

```text
B = Batch Size
T = Token 数量 / 序列长度
C = 每个词的总维度
H = Head 数量
D = 每个 Head 的维度
```

其中：

```text
C = H × D
```

例如：

```text
C = 8
H = 2
D = 4
```

意味着：

```text
一个词总共有 8 个数字
↓
分给 2 个 Head
↓
每个 Head 4 个数字
```

也就是：

```text
8 = 2 × 4
```

---

# 十一、C = 8 到底意味着什么？

例如一个词“我”的向量是：

```text
[0.2, 0.8, 0.1, 0.5, 0.3, 0.9, 0.4, 0.7]
```

一共 8 个数字。

所以：

```text
C = 8
```

这里的 C 表示：

> **一个词最终用多少个数字来表示。**

如果：

```text
H = 2
```

那么：

```text
8维
↓
Head 1：4维
Head 2：4维
```

---

# 十二、`view()` 为什么要把 C 拆开？

原来：

```text
(B,T,C)
```

例如：

```text
(2,4,8)
```

含义：

```text
2句话
每句话4个词
每个词8维
```

假设：

```text
H = 2
D = 4
```

那么：

```python
q.view(B, T, H, D)
```

得到：

```text
(B,T,H,D)
```

例如：

```text
(2,4,8)
↓
(2,4,2,4)
```

本质上就是：

> **把每个词的 8 维拆成 2 个 Head，每个 Head 4 维。**

---

# 十三、为什么还要 `transpose(1,2)`？

`view()` 后是：

```text
(B,T,H,D)
```

但是 Attention 更喜欢：

```text
(B,H,T,D)
```

也就是：

```text
Batch
 ↓
Head
 ↓
Token
 ↓
Head 内部维度
```

所以：

```python
q.transpose(1,2)
```

就是把 `T` 和 `H` 的位置交换。

例如：

```text
(B,T,H,D)
↓
(B,H,T,D)
```

---

# 十四、Multi-Head 到底是什么？

假设：

```text
C = 768
H = 12
```

那么：

```text
768 = 12 × 64
```

于是：

```text
一个 768 维的词
↓
拆成 12 个 Head
↓
每个 Head 64 维
```

不同 Head 可以学习不同类型的关系，例如：

```text
Head 1 → 语法
Head 2 → 语义
Head 3 → 位置
Head 4 → 长距离关系
...
```

最简单的理解：

> **Multi-Head = 同时从多个角度看一句话。**

---

# 十五、Causal Mask / 下三角到底是什么？

GPT 不能让当前词偷看未来。

比如：

```text
我 爱 吃 苹果
```

如果处理“吃”：

```text
可以看：我、爱、吃
不能看：苹果
```

所以允许关系是：

```text
        我   爱   吃   苹果
我       ✓   ✗   ✗   ✗
爱       ✓   ✓   ✗   ✗
吃       ✓   ✓   ✓   ✗
苹果     ✓   ✓   ✓   ✓
```

这就是下三角结构。

---

# 十六、为什么用 `-∞` 做 Mask？

例如：

```text
[10, -∞, -∞, -∞]
```

经过 Softmax 后：

```text
[100%, 0, 0, 0]
```

所以未来词的注意力权重最终会变成 0。

代码里：

```python
att = att.masked_fill(mask == 0, float('-inf'))
```

就是：

> **把不允许看的位置变成负无穷。**

---

# 十七、为什么训练时可以“一次算完”，却又不会偷看未来？

这是 GPT 很重要的一个特点。

训练时输入可以是：

```text
我 爱 吃 苹果
```

一次性送进去。

Mask 限制每一个位置能看到什么：

```text
我      → 只能看 我
爱      → 只能看 我、爱
吃      → 只能看 我、爱、吃
苹果    → 只能看 我、爱、吃、苹果
```

所以四个位置可以同时计算，但每个位置的信息访问权限不同。

重点：

> **Mask 限制的是“信息能不能看到”，不是“计算能不能一起做”。**

---

# 十八、训练和生成要区分

## 训练

可以一次送入：

```text
我 爱 吃 苹果
```

Mask 后并行计算。

## 生成

真正写文章时并不知道未来，因此：

```text
我
↓
预测 爱

我 爱
↓
预测 吃

我 爱 吃
↓
预测 苹果
```

这是自回归生成。

所以：

> **训练时并行，生成时一步一步。**

---

# 十九、Flash Attention 是什么？

代码：

```python
torch.nn.functional.scaled_dot_product_attention(...)
```

可以先简单理解成：

> **PyTorch 提供的高效 Attention 实现。**

相比手写 Attention，它会更高效地组织计算和显存访问。

所以代码中可以先判断：

```python
self.flash = hasattr(
    torch.nn.functional,
    'scaled_dot_product_attention'
)
```

有的话就优先使用。

---

# 二十、`register_buffer()` 是什么？

Causal Mask 不需要训练，但它属于模型的一部分。

所以可以：

```python
self.register_buffer("bias", mask)
```

它和普通参数的区别是：

> **不参与训练，但会跟着模型一起移动到 GPU。**

---

# 二十一、Attention 只是 Transformer 的一部分

这是非常重要的认识：

> **Transformer ≠ 只有 Attention。**

一个 Transformer Layer 还需要：

```text
LayerNorm
Attention
Residual
MLP
```

---

# 二十二、Residual（残差）是什么？

最简单的形式：

```python
x = x + attention(x)
```

意思是：

> **新信息加回来，但原来的信息不要丢。**

可以理解成一条“高速公路”：

```text
        ┌────────────────────┐
        │                    ↓
输入 ──→ Attention ───────→ 加法
  │                         ↑
  └─────────────────────────┘
```

所以 Residual 的核心思想就是：

> **保留旧信息，再叠加新信息。**

---

# 二十三、LayerNorm 是什么？

初学阶段只需要知道：

> **LayerNorm 是把数据整理得更稳定，让训练更容易。**

它不是用来“提取信息”的，主要是为了稳定网络内部的数据分布。

TinyTransformer 的实现使用了 Pre-Norm 风格，也就是先做 LayerNorm，再进入 Attention / MLP。

---

# 二十四、MLP 是什么？

最简单：

```text
输入
↓
Linear
↓
激活函数
↓
Linear
↓
输出
```

在 Transformer 里常见：

```text
768
↓
3072
↓
激活函数
↓
768
```

可以非常直白地理解成：

> **Attention 负责“和别人交流”，MLP 负责“自己加工”。**

---

# 二十五、一个 Transformer Layer 到底做了什么？

最简单的流程：

```text
输入
↓
LayerNorm
↓
Attention
↓
+ 原来的输入
↓
LayerNorm
↓
MLP
↓
+ 原来的输入
↓
输出
```

代码常见形式：

```python
x = x + self.attn(self.ln_1(x))
x = x + self.mlp(self.ln_2(x))
```

翻译成人话：

```text
先整理一下
↓
和别人交流
↓
保留原来的信息
↓
再整理一下
↓
自己加工
↓
再保留原来的信息
```

---

# 二十六、Encoder 是什么？

一个 Transformer Layer 不够，就堆很多个：

```text
Layer
↓
Layer
↓
Layer
↓
Layer
```

很多 Encoder Layer 叠起来：

> **Encoder**

可以理解成：

> **把输入一步一步加工得越来越“懂”。**

---

# 二十七、Decoder 是什么？

经典 Encoder-Decoder Transformer 的 Decoder Layer 多一类重要操作：

```text
1. Masked Self-Attention
2. Cross-Attention
3. MLP
```

---

# 二十八、Cross-Attention 是什么？

Self-Attention：

```text
Q、K、V 都来自自己
```

Cross-Attention：

```text
Q 来自 Decoder
K、V 来自 Encoder
```

可以理解成：

> **Decoder 在问 Encoder：“你那里有什么信息可以帮助我？”**

---

# 二十九、Encoder 和 Decoder 最简单的区别

```text
Encoder：自己看自己

Decoder：
先自己看自己
再去看 Encoder
```

---

# 三十、Embedding 是什么？

模型不直接理解：

```text
我
喜欢
吃
苹果
```

先把 Token 变成 ID：

```text
我 → 0
喜欢 → 1
吃 → 2
苹果 → 3
```

然后：

```text
0 → 一个向量
1 → 一个向量
2 → 一个向量
3 → 一个向量
```

这个过程就是 Embedding。

最简单一句：

> **Embedding = Token ID → 可学习向量。**

---

# 三十一、为什么需要位置编码？

Attention 本身很擅长处理“谁和谁相关”，但它天然不会直接知道顺序。

例如：

```text
我 喜欢 你
```

和：

```text
你 喜欢 我
```

顺序不同，意义也不同。

因此需要给模型位置信息。

可以记成：

> **Embedding 告诉模型“我是谁”，位置编码告诉模型“我在哪”。**

TinyTransformer 的教学实现使用了经典的正余弦位置编码。

---

# 三十二、完整 Transformer 的整体流程

```text
Token ID
↓
Embedding
↓
Position Encoding
↓
Encoder / Decoder
↓
Attention
↓
MLP
↓
重复很多层
↓
Linear
↓
Logits
↓
Softmax
↓
预测结果
```

对于经典 Encoder-Decoder Transformer：

```text
输入
↓
Encoder
↓
Encoder 输出
↓
Decoder
↓
Linear
↓
词概率
```

---

# 三十三、最后的 Linear 是做什么？

假设：

```text
Transformer 输出 = 768维
```

词表有：

```text
50000 个词
```

最后就需要：

```text
768
↓
Linear
↓
50000
```

得到 50000 个分数。

这就是：

> **每个候选词的预测分数。**

这些分数通常叫 logits。

再经过 Softmax，就可以得到概率。

---

# 三十四、Loss 是什么？

假设正确答案是：

```text
苹果
```

模型预测：

```text
苹果 20%
香蕉 30%
汽车 10%
...
```

这时候模型答得不够好。

Loss 可以简单理解成：

> **模型这次答得有多差。**

训练就是让 Loss 越来越小。

基本流程：

```text
预测
↓
算 Loss
↓
反向传播
↓
修改参数
↓
再次预测
↓
Loss 变小
```

TinyTransformer 的训练部分使用交叉熵来计算预测损失。

---

# 三十五、AdamW 是什么？

模型里有很多参数。

Loss 算出来以后，要解决一个问题：

> **这些参数到底应该怎么改？**

优化器负责这件事。

TinyTransformer 使用 `AdamW`。

最简单理解：

> **AdamW = 帮模型更新参数，让 Loss 越来越小的工具。**

---

# 三十六、生成文字是怎么做的？

生成是一步一步来的：

```text
我 喜欢
↓
预测：吃

我 喜欢 吃
↓
预测：苹果

我 喜欢 吃 苹果
↓
预测：。
```

所以生成本质是：

```text
预测一个 Token
↓
把它加回输入
↓
再预测一个 Token
↓
循环
```

这就是自回归生成。

---

# 三十七、Temperature 是什么？

Temperature 可以简单理解成：

> **控制模型输出的随机程度。**

温度低：

```text
更保守
```

温度高：

```text
更大胆、更随机
```

代码常见形式：

```python
logits = logits / temperature
```

---

# 三十八、Top-K 是什么？

假设词表里有 50000 个候选词。

Top-K 会只保留最可能的前 K 个词，例如：

```text
只保留前 50 个
```

然后只在这 50 个里面选择。

它的作用可以简单理解成：

> **别让模型在所有词里胡乱选择，只在最有可能的一小部分里选。**

---

# 三十九、TinyTransformer 整体流程

```text
                 Token
                   ↓
               Embedding
                   ↓
            Position Encoding
                   ↓
        ┌─────────────────────┐
        │     Transformer     │
        │                     │
        │  LayerNorm          │
        │      ↓              │
        │  Multi-Head Attn    │
        │      ↓              │
        │  Residual           │
        │      ↓              │
        │  LayerNorm          │
        │      ↓              │
        │  MLP                │
        │      ↓              │
        │  Residual           │
        └─────────────────────┘
                   ↓
                 Linear
                   ↓
                 Logits
                   ↓
                Softmax
                   ↓
               下一个词
```

这张图基本可以概括整个 TinyTransformer 的学习主线。

---

# 四十、经典 Transformer 和 GPT 的关系

TinyTransformer 教的是比较经典的 Transformer 思路，也就是 Encoder + Decoder。

而现代 GPT、Llama、Qwen、很多 Decoder-only LLM 更常见的是：

```text
只有 Decoder
```

也就是说：

```text
经典 Transformer = Encoder + Decoder

GPT 类模型 = Decoder-only
```

但是很多核心零件依然一致：

```text
Attention
Multi-Head
Causal Mask
Residual
LayerNorm / RMSNorm
MLP
Embedding
位置机制
Linear 输出
```

所以学习 TinyTransformer 之后，再进入 GPT 类模型是很自然的。

---

# 四十一、核心代码分析

核心代码：

```python
q, k, v = ...
```

意思：

> 把输入变成 Q、K、V。

```python
q = q.view(B, T, n_head, C // n_head)
```

意思：

> 把一个大向量拆成多个 Head。

```python
q = q.transpose(1, 2)
```

意思：

> 把维度顺序调整成适合 Attention 的样子。

```python
att = q @ k.transpose(-2, -1)
```

意思：

> 计算“每个词应该关注谁”。

```python
att = att / sqrt(d)
```

意思：

> 控制数值规模，让 Softmax 更稳定。

```python
att = att.masked_fill(..., -inf)
```

意思：

> 不允许看到未来。

```python
att = softmax(att)
```

意思：

> 把关注分数变成关注比例。

```python
y = att @ v
```

意思：

> 按照关注比例，把别人提供的信息拿过来。

```python
y = y.transpose(...).contiguous().view(B, T, C)
```

意思：

> 把所有 Head 的结果重新拼回一个完整向量。

```python
y = self.c_proj(y)
```

意思：

> 再把所有 Head 的信息重新混合一下。

---

# 四十二、特别重要的“人话翻译”

| 技术名词 | 最简单理解 |
|---|---|
| Embedding | Token ID 变成向量 |
| Position Encoding | 告诉模型“我在哪” |
| Q | 我想找什么 |
| K | 你和我匹不匹配 |
| V | 你能给我什么 |
| QKᵀ | 谁和谁更相关 |
| Mask | 不允许看未来 |
| Softmax | 各自有多重要 |
| Attention × V | 按比例拿信息 |
| Multi-Head | 从多个角度看 |
| Residual | 原来的信息不要丢 |
| LayerNorm | 把数据整理稳定 |
| MLP | 自己进一步加工 |
| Encoder | 不断加工输入 |
| Decoder | 一边生成一边参考上下文 |
| Cross-Attention | Decoder 去读取 Encoder |
| Linear | 把隐藏向量变成词表分数 |
| Loss | 这次答得有多差 |
| AdamW | 帮模型修改参数 |
| Temperature | 控制随机程度 |
| Top-K | 只在最可能的前 K 个里选 |

---

# 四十三、重点理解

## 1. C、H、D

```text
C = H × D
```

其中：

```text
C = 总维度
H = Head 数量
D = 每个 Head 的维度
```

---

## 2. Attention 的两个关键操作

```text
Q × Kᵀ
↓
找谁重要
```

```text
Attention × V
↓
拿信息
```

---

## 3. Causal Attention

```text
词1 → 看词1
词2 → 看词1、词2
词3 → 看词1、词2、词3
词4 → 看词1、词2、词3、词4
```

---

## 4. Transformer Layer

```text
LayerNorm
↓
Attention
↓
Residual
↓
LayerNorm
↓
MLP
↓
Residual
```

---

# 四十四、把 Transformer 想成一个“开会”系统

这是最适合长期记忆的类比。

一句话中的每个 Token 都可以看成一个人。

### Attention

大家互相交流：

> “你知道的东西和我有没有关系？”

### Q

> “我想找什么？”

### K

> “我有什么特点？”

### V

> “这是我真正能提供的信息。”

### Multi-Head

> “我们从多个角度讨论。”

### Causal Mask

> “不能讨论未来发生的事情。”

### Residual

> “刚才我自己的想法也别丢。”

### LayerNorm

> “先把状态整理稳定一点。”

### MLP

> “交流结束后，我自己再想一想。”

这个类比基本可以覆盖 Transformer 的大部分核心概念。

---

# 四十五、最终总结

1. **Embedding：把 Token 变成向量。**
2. **位置编码：告诉模型 Token 在哪里。**
3. **Q：我想找什么。**
4. **K：谁和我匹配。**
5. **V：谁能给我什么信息。**
6. **QKᵀ：决定关注谁。**
7. **Mask：不允许看到未来。**
8. **Attention×V：按照关注比例拿信息。**
9. **Multi-Head：从多个角度同时看。**
10. **MLP + Residual + LayerNorm：把信息继续加工、稳定和保留。**

最终，Transformer 做的事情可以概括为：

> **让每个词在不偷看未来的前提下，参考上下文中的其他词，然后不断加工这些信息，最终做出预测。**

---

## 附：最值得反复看的核心图

```text
输入 Token
    ↓
Embedding
    ↓
Position
    ↓
Q / K / V
    ↓
拆成多个 Head
    ↓
Q × Kᵀ
    ↓
“我应该看谁？”
    ↓
Causal Mask
    ↓
“不准看未来”
    ↓
Softmax
    ↓
“每个人看多少？”
    ↓
Attention × V
    ↓
“按比例拿信息”
    ↓
多头结果拼起来
    ↓
Residual + LayerNorm + MLP
    ↓
重复很多层
    ↓
Linear
    ↓
Logits
    ↓
Softmax
    ↓
预测下一个 Token
```

> **Transformer 的核心，不是“很多复杂公式”，而是“让每个词有选择地从上下文中获取信息”。**
