// 1.2.23: 自定义 JavaScript 用于 YUIChat
// Chainlit 会自动使用 public/logo_dark.png 和 logo_light.png
// 本文件处理：1. URL 参数传递 2. kb_id 保留 3. 替换 "Chainlit" 文字

console.log("[YUIChat] Custom JS loaded");

// ============================================
// 1. URL 参数处理
// ============================================
window.addEventListener("chainlit-call-fn", (e) => {
  const { name, args, callback } = e.detail;
  if (name === "get_url_param") {
    const paramName = args.param_name;
    const urlParams = new URLSearchParams(window.location.search);
    const value = urlParams.get(paramName);
    console.log(`[YUIChat] get_url_param: ${paramName} = ${value}`);
    callback(value);
  }
});

// ============================================
// 2. kb_id 参数保留
// ============================================
const initialKbId = new URLSearchParams(window.location.search).get("kb_id");

if (initialKbId) {
  window.addEventListener("popstate", function () {
    const currentUrl = new URL(window.location.href);
    if (!currentUrl.searchParams.has("kb_id")) {
      currentUrl.searchParams.set("kb_id", initialKbId);
      window.history.replaceState(null, "", currentUrl.toString());
    }
  });

  const observer = new MutationObserver(function () {
    const newChatButtons = document.querySelectorAll(
      'button[id="new-chat-button"], a[href="/"], button[aria-label*="新建"], button[aria-label*="New"]'
    );
    newChatButtons.forEach((btn) => {
      if (!btn.dataset.kbIdPatched) {
        btn.dataset.kbIdPatched = "true";
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          const newUrl = new URL(window.location.origin);
          newUrl.searchParams.set("kb_id", initialKbId);
          window.location.href = newUrl.toString();
        }, true);
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  console.log("[YUIChat] kb_id preservation enabled:", initialKbId);
}

// ============================================
// 3. 替换 "Chainlit" 文字为 "YUIChat"
// ============================================
function replaceChainlitText() {
  const projectName = "YUIChat";

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node;
  while (node = walker.nextNode()) {
    if (node.textContent && node.textContent.includes("Chainlit")) {
      const parent = node.parentElement;
      if (parent && parent.tagName !== "SCRIPT" && parent.tagName !== "STYLE") {
        node.textContent = node.textContent.replace(/Chainlit/g, projectName);
      }
    }
  }
}

// 页面加载完成后替换文字
window.addEventListener("load", function() {
  replaceChainlitText();
  setTimeout(replaceChainlitText, 500);
  setTimeout(replaceChainlitText, 1000);
});

// 监听 DOM 变化
const textObserver = new MutationObserver(replaceChainlitText);
if (document.body) {
  textObserver.observe(document.body, { childList: true, subtree: true });
}

// 5秒后停止监听
setTimeout(() => {
  textObserver.disconnect();
}, 5000);

// ============================================
// 4. 头像配置 (1.2.25)
// ============================================
// 使用 Chainlit 官方头像方式 + JavaScript 调整尺寸
// 头像文件放置在 public/avatars/{author}.png
// 参考: https://docs.chainlit.io/customisation/avatars

const AVATAR_SIZE = 36; // 头像尺寸（像素）

function resizeAvatars() {
  const selectors = [
    'img[src*="/avatars/"]',
    'img[alt*="Avatar for"]',
    'img[alt="Avatar for Assistant"]'
  ];

  const avatarImages = document.querySelectorAll(selectors.join(', '));

  if (avatarImages.length > 0) {
    console.log('[YUIChat] Found avatar images:', avatarImages.length);
  }

  avatarImages.forEach((img, index) => {
    // 跳过已处理的
    if (img.dataset.yuichatResized === 'done') return;

    const computedStyle = window.getComputedStyle(img);
    console.log(`[YUIChat] Avatar ${index} before:`, {
      src: img.src,
      alt: img.alt,
      computedWidth: computedStyle.width,
      computedHeight: computedStyle.height,
      classList: img.className
    });

    // 移除 Tailwind 类的影响
    img.classList.remove('h-full', 'w-full');

    // 设置内联样式
    img.style.cssText = `
      width: ${AVATAR_SIZE}px !important;
      height: ${AVATAR_SIZE}px !important;
      min-width: ${AVATAR_SIZE}px !important;
      min-height: ${AVATAR_SIZE}px !important;
      max-width: ${AVATAR_SIZE}px !important;
      max-height: ${AVATAR_SIZE}px !important;
      border-radius: 50% !important;
      object-fit: cover !important;
      aspect-ratio: 1 / 1 !important;
    `;
    img.dataset.yuichatResized = 'done';

    // 向上遍历 DOM 树，调整所有父容器
    let parent = img.parentElement;
    let level = 0;
    while (parent && level < 5) {
      const tagName = parent.tagName.toLowerCase();

      // 记录父元素信息用于调试
      if (level === 0) {
        console.log(`[YUIChat] Avatar ${index} parent hierarchy:`, {
          level,
          tagName,
          className: parent.className,
          computedWidth: window.getComputedStyle(parent).width,
          computedHeight: window.getComputedStyle(parent).height
        });
      }

      // 移除可能限制大小的类
      parent.classList.remove('h-full', 'w-full');

      // 对 span 和小尺寸容器应用固定尺寸
      if (tagName === 'span' ||
          parent.className?.includes('avatar') ||
          parseInt(window.getComputedStyle(parent).width) < AVATAR_SIZE) {
        parent.style.cssText = `
          width: ${AVATAR_SIZE}px !important;
          height: ${AVATAR_SIZE}px !important;
          min-width: ${AVATAR_SIZE}px !important;
          min-height: ${AVATAR_SIZE}px !important;
          max-width: ${AVATAR_SIZE}px !important;
          max-height: ${AVATAR_SIZE}px !important;
          border-radius: 50% !important;
          overflow: hidden !important;
          flex-shrink: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
        `;
      }

      parent = parent.parentElement;
      level++;
    }

    // 验证修改后的尺寸
    setTimeout(() => {
      const newStyle = window.getComputedStyle(img);
      console.log(`[YUIChat] Avatar ${index} after:`, {
        computedWidth: newStyle.width,
        computedHeight: newStyle.height
      });
    }, 50);
  });
}

// 页面加载后执行
window.addEventListener("load", function() {
  resizeAvatars();
  setTimeout(resizeAvatars, 100);
  setTimeout(resizeAvatars, 300);
  setTimeout(resizeAvatars, 500);
  setTimeout(resizeAvatars, 1000);
});

// 监听 DOM 变化，处理新消息中的头像
const avatarObserver = new MutationObserver(function(mutations) {
  let hasNewContent = false;
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length > 0) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          if (node.tagName === 'IMG' ||
              node.querySelector?.('img[src*="avatars"]') ||
              node.querySelector?.('img[alt*="Avatar"]')) {
            hasNewContent = true;
          }
        }
      });
    }
  });
  if (hasNewContent) {
    setTimeout(resizeAvatars, 10);
    setTimeout(resizeAvatars, 100);
  }
});

if (document.body) {
  avatarObserver.observe(document.body, { childList: true, subtree: true });
}

console.log("[YUIChat] Avatar resize enabled, target size:", AVATAR_SIZE, "px");
