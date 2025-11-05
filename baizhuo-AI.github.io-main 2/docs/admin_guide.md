# Maintainer Guide

This document explains how to update the official pricing dataset and operate the accompanying GitHub Actions workflow.

## Directory layout

```
/data
├─ official_pricing.json     # Canonical, auto-generated JSON used by the front-end
├─ incoming/                 # Drop CSV files here to trigger normalization
└─ tools/
   ├─ csv_to_json.mjs        # Converts CSV/TSV with Chinese headers into JSON objects
   └─ merge_json.mjs         # Optional merger for incremental updates (vendor::model key)
```

## Preparing source files

1. Export pricing updates as **UTF-8 encoded CSV/TSV**.
2. Ensure header row matches one of the supported column labels below (case-sensitive). Additional columns are ignored.

| 中文列名 | 说明 | JSON 字段 |
|----------|------|------------|
| 厂商 | 模型供应商 | `vendor` |
| 模型名称 | 模型名 | `model` |
| 官方输入价格/M token | 输入价格（人民币） | `input_per_million` |
| 官方输出价格/M token | 输出价格（人民币） | `output_per_million` |
| 模型说明 | 模型描述 | `desc` |
| 温度范围 | 形如 `[0-2]`、`[0-2）` 等 | `temp_range` |
| 默认温度 | 默认温度数值 | `temp_default` |
| 模型地区 | 国内/国外等 | `region` |
| 是否常用模型 | 是/否 | `is_common` |
| 是否收藏 | 是/否 | `is_favorite` |

> **提示**：英文列名（`vendor`, `model`, …）同样可被解析。

## 清洗规则

- 价格字段会自动去除 `￥`、逗号及空白，并转换为数字，非法值会变为 `null`。
- 温度范围会容错中英文括号、右半边缺失等情况，统一输出为 `[min, max]` 数组。
- `是否常用模型`、`是否收藏` 会识别 `是/yes/true/y/1`（大小写不敏感），其它值视为 `false`。
- 输出 JSON 以 `vendor::model` 作为唯一主键；描述字段保留多行文本。

## 更新流程

1. 将新的 CSV 文件提交到 `data/incoming/` 目录（可通过 `git commit` 或 Pull Request）。
2. GitHub Actions 工作流 [`update-data.yml`](../.github/workflows/update-data.yml) 会在 push/PR 或 `workflow_dispatch` 时运行。
3. 工作流步骤：
   - Checkout 仓库
   - 安装 Node.js 20
   - 运行 `node data/tools/csv_to_json.mjs`，输出 `data/official_pricing.json`
   - （可选）运行 `merge_json.mjs` 合并历史数据
   - 使用 Prettier 美化 JSON
   - 若数据有变更，自动提交回分支（使用工作流令牌）
4. GitHub Pages（若启用）将基于最新 JSON 自动构建。

## 手动运行

在本地可以执行：

```bash
node data/tools/csv_to_json.mjs data/incoming/your_file.csv
```

若需要将多个文件合并，可先运行 `csv_to_json.mjs` 生成临时 JSON，再用 `merge_json.mjs base.json updates.json` 去重合并。

## 常见问题

- **工作流失败**：检查 CSV 编码、列名是否匹配、是否存在空行或单元格内换行。日志会输出具体行号。
- **价格为 null**：字段包含非数字字符或单位，请确认为纯数值（人民币）。
- **温度范围异常**：确保使用 `0-2`、`[0-2]`、`[0-2）` 等格式。
- **GitHub Pages 未更新**：确认工作流成功并推送到默认分支，或手动触发 Pages rebuild。

## 回滚

若导入数据存在问题，可通过 `git revert` 或直接还原 `data/official_pricing.json` 到上一版本并重新推送，工作流会重新发布。
