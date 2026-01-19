# AI食品顾问 - 项目开发规范

## 语言规则
- 始终使用中文回复所有问题和交流

## 代码修改规则
- **不要直接删除代码**，将旧代码注释掉，并添加注释时的版本信息
- 例如：当前版本1.2.4
  - 被注释的代码标记为：`// 1.2.4`
  - 新增代码标记为：`// 1.2.5`

## JSON文件处理规则
- JSON文件等无法注释的文件，复制创建backup文件
- 备份文件命名格式：`当前版本.【原文件名】.json`
- 例如：当前版本1.2.4，则创建的backup文件名为 `1.2.4.xxx.json`

## 控制台日志规则
- 控制台输出的日志内容，**仅在开发环境中输出**
- 确保生产环境不输出调试日志
- 使用环境变量判断：`process.env.NODE_ENV === 'development'`

## 版本管理规则
- **每一次修改都要在versions中添加版本记录**
- 记录修改内容、时间和版本号

## Supabase更新
- 如果需要更新Supabase配置或函数，直接更新
- 无需额外确认

## 新功能开发规则
- 增加或规划新的功能时，**首先搜索GitHub是否有开源的框架可用**
- 不要自己造轮子，优先使用成熟的开源解决方案
- 评估开源框架的活跃度、星标数、维护状态

## Plan文件管理
- 创建的plan.md前缀改为创建的计划的标题
- 创建Plan后，将创建的plan保存到 Plan 目录中
- 当plan有更新时，同步更新对应的文件

## 开发标准参考
- 所有开发都要严格参考项目开发规范文档
- 参考文档位置：`@docs/SAFE_EDIT_GUIDE.md`
- 在修改代码前，务必查阅相关规范

## 技术参考资源

### JSONL (JSON Lines) 格式
在处理 JSON 流式数据和解决 JSON 边界字符解析错误时，参考以下资源：

**官方规范**：
- [jsonlines.org](https://jsonlines.org/) - JSON Lines 官方规范（最权威）
- [JSONL Format Specification](https://jsonltools.com/jsonl-format-specification) - 完整技术指南
- [NDJSON.com](https://ndjson.com/definition/) - NDJSON 格式定义

**最佳实践**：
- [Speakeasy - JSONL in OpenAPI](https://www.speakeasy.com/openapi/content/jsonl) - API 设计最佳实践
- [NCBI - Why JSON Lines](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/reference-docs/file-formats/metadata-files/why-jsonl/) - 应用场景分析

**项目内参考**：
- `@docs/JSONL_REFERENCES.md` - 详细的 JSONL 资源汇总
- `@Plan/JSON边界字符解析-根本解决方案.md` - JSON 解析问题的根本解决方案

**核心原则**：
- 每行一个完整的 JSON 对象（不是数组）
- 使用 `\n` 换行符分隔
- 避免数组边界字符 `[`, `]`, `,` 导致的解析错误
- 适合流式处理和逐行解析
