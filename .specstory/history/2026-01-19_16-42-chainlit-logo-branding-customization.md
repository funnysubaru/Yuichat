# Chainlit Logo 品牌自定义 (2026-01-19 16:42)

## 问题描述

用户希望将 Chainlit 外部分享页面的 logo 和图标替换为项目名称 YUIChat，之前尝试多次未成功。

## 解决过程

### 1. 初始分析

查看了之前的尝试记录，发现使用 JavaScript 运行时替换的方式不稳定，每次刷新都会先显示 Chainlit logo。

### 2. 发现 Chainlit 的正确自定义方式

通过查阅 [Chainlit 官方文档](https://docs.chainlit.io/customisation/custom-logo-and-favicon)，找到了正确的品牌自定义方法：

#### 官方推荐方式：
- **Logo**: 将 `logo_dark.png` 和 `logo_light.png` 放在 `public/` 文件夹中
- **Favicon**: 将文件命名为 `favicon`（无扩展名）放在 `public/` 文件夹中
- Chainlit 会自动检测并使用这些文件

### 3. 实施步骤

1. 将 `logo.svg` 转换为 PNG 格式：
```bash
rsvg-convert -w 400 logo.svg -o logo_dark.png
rsvg-convert -w 400 logo.svg -o logo_light.png
rsvg-convert -w 64 -h 64 logo.svg -o favicon
```

2. 简化 `custom.js`，移除复杂的 logo 替换逻辑，只保留：
   - URL 参数处理
   - kb_id 参数保留
   - "Chainlit" 文字替换为 "YUIChat"

3. 简化 `custom.css`，只保留隐藏水印和不需要的按钮的样式

### 4. 最终文件结构

```
backend_py/public/
├── custom.css      # 隐藏水印等
├── custom.js       # URL 参数处理、文字替换
├── favicon         # 网站图标 (64x64)
├── logo.svg        # 原始 logo
├── logo_dark.png   # 深色主题 logo (Chainlit 自动使用)
└── logo_light.png  # 浅色主题 logo (Chainlit 自动使用)
```

## 关键代码

### custom.js (1.2.19)
```javascript
// Chainlit 会自动使用 public/logo_dark.png 和 logo_light.png
// 本文件只处理：1. URL 参数传递 2. kb_id 保留 3. 替换 "Chainlit" 文字

// URL 参数处理
window.addEventListener("chainlit-call-fn", (e) => {
  const { name, args, callback } = e.detail;
  if (name === "get_url_param") {
    const value = new URLSearchParams(window.location.search).get(args.param_name);
    callback(value);
  }
});

// 替换 "Chainlit" 文字
function replaceChainlitText() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  let node;
  while (node = walker.nextNode()) {
    if (node.textContent.includes("Chainlit")) {
      node.textContent = node.textContent.replace(/Chainlit/g, "YUIChat");
    }
  }
}
```

### custom.css (1.2.19)
```css
/* 隐藏 Chainlit 水印和链接 */
a[href="https://github.com/Chainlit/chainlit"],
a[href*="chainlit.io"],
footer,
div[class*="watermark"] {
  display: none !important;
}

/* 隐藏右上角的"说明"按钮 */
button[id="readme-button"],
button[aria-label*="readme"] {
  display: none !important;
}
```

## 结果

- 深色主题：logo 替换成功
- 浅色主题：需要清除浏览器缓存后才能看到更新（Chainlit 会缓存 logo）

## 注意事项

1. **浏览器缓存**：Chainlit 文档明确指出 "Assets such as favicons and logos are cached by default by your browser. You might have to clear your browser cache to see the changes."

2. **测试方法**：使用隐私模式窗口或在开发者工具中勾选 "Disable cache" 后刷新

## 参考资料

- [Chainlit Logo and Favicon 官方文档](https://docs.chainlit.io/customisation/custom-logo-and-favicon)
- [Chainlit Cookbook - Custom Logo 示例](https://github.com/Chainlit/cookbook/tree/main/custom-logo)
