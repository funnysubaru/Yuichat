// 1.1.17: 自定义 JavaScript 用于传递 URL 参数给 Chainlit 后端
// 监听 Chainlit 的函数调用事件

window.addEventListener("chainlit-call-fn", (e) => {
  const { name, args, callback } = e.detail;

  // 处理获取 URL 参数的请求
  if (name === "get_url_param") {
    const paramName = args.param_name;
    const urlParams = new URLSearchParams(window.location.search);
    const value = urlParams.get(paramName);
    console.log(`[Chainlit] get_url_param: ${paramName} = ${value}`);
    callback(value);
  }
});

// 1.1.18: 保留 kb_id 参数在新建对话时
// 保存初始的 kb_id 参数
const initialKbId = new URLSearchParams(window.location.search).get("kb_id");

// 拦截导航，确保 kb_id 参数不丢失
if (initialKbId) {
  // 监听 popstate 事件（浏览器前进/后退）
  window.addEventListener("popstate", function () {
    const currentUrl = new URL(window.location.href);
    if (!currentUrl.searchParams.has("kb_id") && initialKbId) {
      currentUrl.searchParams.set("kb_id", initialKbId);
      window.history.replaceState(null, "", currentUrl.toString());
    }
  });

  // 使用 MutationObserver 监听 DOM 变化，拦截新建对话按钮点击
  const observer = new MutationObserver(function () {
    // 查找新建对话按钮（左上角的按钮）
    const newChatButtons = document.querySelectorAll(
      'button[id="new-chat-button"], a[href="/"], button[aria-label*="新建"], button[aria-label*="New"]'
    );

    newChatButtons.forEach((btn) => {
      if (!btn.dataset.kbIdPatched) {
        btn.dataset.kbIdPatched = "true";
        btn.addEventListener(
          "click",
          function (e) {
            // 1.1.18: 阻止默认行为，强制刷新页面（带上 kb_id 参数）
            // 这样可以确保 http_referer 中包含正确的 kb_id
            e.preventDefault();
            e.stopPropagation();

            const newUrl = new URL(window.location.origin);
            newUrl.searchParams.set("kb_id", initialKbId);

            console.log(
              "[Chainlit Custom JS] Redirecting to new chat with kb_id:",
              newUrl.toString()
            );

            // 强制页面刷新，确保 http_referer 正确
            window.location.href = newUrl.toString();
          },
          true
        ); // 使用 capture 模式确保我们的处理程序先执行
      }
    });
  });

  // 开始监听 DOM 变化
  observer.observe(document.body, { childList: true, subtree: true });

  // 1.1.18: 移除定时检查，因为现在使用页面刷新方式
  // 如果检测到 URL 中没有 kb_id，立即刷新页面
  if (
    !new URL(window.location.href).searchParams.has("kb_id") &&
    initialKbId
  ) {
    const newUrl = new URL(window.location.origin);
    newUrl.searchParams.set("kb_id", initialKbId);
    console.log(
      "[Chainlit Custom JS] kb_id missing, redirecting:",
      newUrl.toString()
    );
    window.location.href = newUrl.toString();
  }

  console.log("[Chainlit Custom JS] kb_id preservation enabled:", initialKbId);
}

// 在页面加载时输出调试信息
console.log("[Chainlit Custom JS] Loaded");
console.log("[Chainlit Custom JS] URL:", window.location.href);
console.log("[Chainlit Custom JS] Search params:", window.location.search);
