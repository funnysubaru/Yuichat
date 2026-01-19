"""
1.1.12: URL爬虫模块 - 重构版本
完全按照参考代码实现，使用 Selenium + unstructured 库
"""

import os
import time
import re
import urllib.parse
import asyncio
from typing import List, Dict, Any, Optional, Literal, Union
import logging

import requests
from langchain_core.documents import Document
from langchain_community.document_loaders import PlaywrightURLLoader, UnstructuredURLLoader
from langchain_community.document_loaders.base import BaseLoader

# 1.1.12: 配置日志（仅在开发环境输出）
logger = logging.getLogger(__name__)
if os.getenv("ENV") == "development":
    logging.basicConfig(level=logging.INFO)
else:
    logging.basicConfig(level=logging.WARNING)


# 1.1.12: 辅助函数
def is_valid_url(s: str) -> bool:
    """检查URL是否有效（非空且非空白）"""
    if s == "" or s.isspace():
        return False
    return True


def is_url_accessible(url: str) -> bool:
    """检查URL是否可访问"""
    if not is_valid_url(url):
        return False
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            return True
        else:
            if os.getenv("ENV") == "development":
                logger.info(f"First response [{response.status_code}] for {url}")
            return True
    except:
        return False


def replace_special_char(text: str) -> str:
    """清理特殊字符和重复标点"""
    return re.sub(r"([ ■◼•＊…— ●⚫]+|[·\.~•、—'}]{3,})", ' ', text)


# 1.1.12: SeleniumChromeURLLoader 类
class SeleniumChromeURLLoader(BaseLoader):
    """
    Loader that uses Selenium and Chrome to load a page and unstructured to load the html.
    This is useful for loading pages that require javascript to render.

    Attributes:
        urls (List[str]): List of URLs to load.
        continue_on_failure (bool): If True, continue loading other URLs on failure.
        browser (str): Use chrome as default browser.
        executable_path (Optional[str]): The path to the browser executable.
        headless (bool): If True, the browser will run in headless mode.
    """

    def __init__(
        self,
        urls: List[str],
        continue_on_failure: bool = True,
        browser: Literal["chrome", "firefox"] = "chrome",
        executable_path: Optional[str] = None,
        headless: bool = True,
        imageless: bool = True,
        infobarless: bool = True,
    ):
        """Load a list of URLs using Selenium and unstructured."""
        try:
            import selenium  # noqa:F401
        except ImportError:
            raise ValueError(
                "selenium package not found, please install it with "
                "`pip install selenium`"
            )

        try:
            import unstructured  # noqa:F401
        except ImportError:
            raise ValueError(
                "unstructured package not found, please install it with "
                "`pip install unstructured`"
            )

        self.urls = urls
        self.continue_on_failure = continue_on_failure
        self.browser = browser
        self.executable_path = executable_path
        self.headless = headless
        self.imageless = imageless
        self.infobarless = infobarless

    def _get_driver(self) -> Union["Chrome", "Firefox"]:
        """Create and return a WebDriver instance based on the specified browser.

        Raises:
            ValueError: If an invalid browser is specified.

        Returns:
            Union[Chrome, Firefox]: A WebDriver instance for the specified browser.
        """
        from selenium.webdriver import Chrome
        from selenium.webdriver.chrome.options import Options as ChromeOptions
        from selenium.webdriver.chrome.service import Service as ChromeService
        from webdriver_manager.chrome import ChromeDriverManager

        chrome_options = ChromeOptions()
        if self.headless:
            chrome_options.add_argument("--headless")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
        if self.imageless:
            chrome_options.add_argument("--blink-settings=imagesEnabled=false")
        if self.infobarless:
            chrome_options.add_argument("--disable-infobars")
        
        # 1.1.12: 使用 webdriver-manager 自动管理 ChromeDriver
        if self.executable_path is None:
            try:
                # 使用 webdriver-manager 自动下载和管理 ChromeDriver
                service = ChromeService(ChromeDriverManager().install())
                return Chrome(service=service, options=chrome_options)
            except Exception as e:
                if os.getenv("ENV") == "development":
                    logger.warning(f"webdriver-manager failed, trying direct Chrome: {e}")
                # 回退到直接使用 Chrome（依赖系统 ChromeDriver）
                return Chrome(options=chrome_options)
        return Chrome(executable_path=self.executable_path, options=chrome_options)

    def load(self) -> List[Document]:
        """Load the specified URLs using Selenium and create Document instances.

        Returns:
            List[Document]: A list of Document instances with loaded content.
        """
        from unstructured.partition.html import partition_html

        docs: List[Document] = list()
        driver = self._get_driver()
        if os.getenv("ENV") == "development":
            logger.info(f"Selenium driver= {driver}")
            logger.info(f"load urls= {self.urls}")
        
        for url in self.urls:
            try:
                if os.getenv("ENV") == "development":
                    logger.info(f"[CORE_CALL] load url= {url}")
                driver.get(url)
                # 1.1.12: 增加等待时间，确保 JavaScript 动态内容完全加载
                # 对于 Vue.js 等 SPA 应用，需要更长的等待时间
                time.sleep(8)  # 从3秒增加到8秒，确保动态内容加载完成
                
                # 1.1.12: 尝试等待页面完全加载（等待 body 中有实际内容）
                try:
                    from selenium.webdriver.support.ui import WebDriverWait
                    from selenium.webdriver.support import expected_conditions as EC
                    from selenium.webdriver.common.by import By
                    # 等待 body 中有文本内容（至少100个字符）
                    WebDriverWait(driver, 10).until(
                        lambda d: len(d.find_element(By.TAG_NAME, "body").text) > 100
                    )
                except:
                    # 如果等待超时，继续使用固定等待时间后的内容
                    pass
                
                title = driver.title
                page_content = driver.page_source
                
                # 1.1.12: 尝试获取编辑器内容（如果是 Markdown 编辑器）
                try:
                    # 使用 JavaScript 获取所有编辑器内容（包括 Vue 渲染的内容）
                    editor_content_js = """
                    var editors = [];
                    // 获取所有可能的编辑器元素
                    var selectors = ['textarea', '[contenteditable="true"]', '.vditor-sv', '.vditor-textarea', '.editor', '#editor'];
                    selectors.forEach(function(selector) {
                        document.querySelectorAll(selector).forEach(function(el) {
                            var text = el.value || el.textContent || el.innerText || '';
                            if (text && text.trim().length > 50) {
                                editors.push({
                                    tag: el.tagName,
                                    text: text,
                                    id: el.id || '',
                                    className: el.className || ''
                                });
                            }
                        });
                    });
                    return editors;
                    """
                    editor_contents = driver.execute_script(editor_content_js)
                    
                    if editor_contents:
                        # 合并所有编辑器内容
                        all_editor_text = "\n\n".join([ed['text'] for ed in editor_contents if ed['text']])
                        if all_editor_text and len(all_editor_text) > 100:
                            if os.getenv("ENV") == "development":
                                logger.info(f"找到编辑器内容，长度: {len(all_editor_text)} 字符")
                            # 将编辑器内容添加到页面源码中，优先使用编辑器内容
                            page_content = f"{page_content}\n<!-- Editor Content -->\n{all_editor_text}"
                except Exception as editor_error:
                    if os.getenv("ENV") == "development":
                        logger.warning(f"获取编辑器内容失败: {editor_error}")
                if os.getenv("ENV") == "development":
                    logger.info(f"load url end")
                
                # 1.1.12: 修复 partition_html 处理某些网页时的错误
                # 如果直接传 text 失败，按照 chatmax 逻辑应该标记为解析失败
                try:
                    elements = partition_html(text=page_content)
                except Exception as parse_error:
                    if os.getenv("ENV") == "development":
                        logger.warning(f"partition_html failed: {parse_error}")
                    # 1.1.12: 按照 chatmax 逻辑，partition_html 失败应该标记为解析失败
                    # 不再使用 BeautifulSoup 回退，直接创建错误文档
                    error_reason = f"partition_html 处理失败 - {str(parse_error)}"
                    docs.append(Document(
                        page_content=f"解析失败: {error_reason}\n原始URL: {url}",
                        metadata={
                            "source": url,
                            "title": url,
                            "url": url,
                            "error": error_reason
                        }
                    ))
                    continue
                
                text = "\n\n".join(
                    [replace_special_char(str(el).strip()) for el in elements if el is not None])
                metadata = {"source": url,
                            "title": title}
                if os.getenv("ENV") == "development":
                    logger.info(f"[CORE_CALL] url data, content={text}, meta={metadata}")
                docs.append(Document(page_content=text, metadata=metadata))
            except Exception as e:
                if self.continue_on_failure:
                    if os.getenv("ENV") == "development":
                        logger.error(f"[CORE_CALL] Error fetching or processing {url}, exception: {e}")
                else:
                    raise e
        driver.quit()
        return docs


# 1.1.12: loader_factory 函数
def loader_factory(urls: List[str], loader_type: str):
    """根据类型创建不同的URL加载器"""
    if loader_type == "selenium":
        return SeleniumChromeURLLoader(urls=urls,)
    elif loader_type == "unstructured":
        return UnstructuredURLLoader(urls=urls,)
    elif loader_type == "playwright":
        return PlaywrightURLLoader(
            urls=urls,
            remove_selectors=["header", "footer"],
            continue_on_failure=False,
            headless=True,
        )
    else:
        return ValueError(("Invalid URL loader type"))


# 1.1.12: process_web_content 函数（按照 chatmax 逻辑）
def process_web_content(decoded_url: str, omit_content: bool = False):
    """处理网页内容，使用Selenium加载器
    
    按照 chatmax 逻辑：
    - 如果 docs 为空，返回错误标记
    - 如果内容为空或过短，返回错误标记
    """
    urls = [decoded_url]
    loader = loader_factory(urls, "selenium")
    docs = loader.load()

    # 1.1.12: 按照 chatmax 逻辑，如果 docs 为空，返回错误标记
    if not docs:
        return None, None, -1  # 返回 None 表示解析失败

    doc = docs[0]
    content = doc.page_content
    
    # 1.1.12: 检查内容是否为空或过短（少于50字符视为无效）
    if not content or not content.strip() or len(content.strip()) < 50:
        return None, None, -1  # 返回 None 表示解析失败
    
    word_count = len(content)

    if content:
        if omit_content:
            content = ""
        content = replace_special_char(content)

    return content, doc.metadata.get('title', ''), word_count


# 1.1.12: 异步接口 - 保持与 workflow.py 的兼容性
async def crawl_urls(urls: List[str], options: Optional[Dict[str, Any]] = None) -> List[Document]:
    """
    1.1.12: 批量爬取多个URL（异步接口，内部使用同步的Selenium）
    
    Args:
        urls: URL列表
        options: 爬取选项（保留兼容性，但Selenium加载器不使用）
    
    Returns:
        Document列表
    """
    if not urls:
        return []
    
    if os.getenv("ENV") == "development":
        logger.info(f"🕷️ 开始批量爬取 {len(urls)} 个URL")
    
    # 1.1.12: 使用 asyncio.to_thread 在异步环境中执行同步的Selenium代码
    def sync_crawl():
        """同步爬取函数"""
        loader = loader_factory(urls, "selenium")
        return loader.load()
    
    try:
        # 在线程池中执行同步代码
        docs = await asyncio.to_thread(sync_crawl)
        
        # 1.1.12: 按照 chatmax 逻辑检查文档
        valid_docs = []
        error_docs = []
        
        for url in urls:
            # 查找对应 URL 的文档
            url_doc = None
            for doc in docs:
                if doc.metadata.get('source') == url:
                    url_doc = doc
                    break
            
            # 1.1.12: 按照 chatmax 逻辑判断解析失败
            # 条件1: docs 为空（没有找到对应 URL 的文档）
            # 条件2: 文档内容为空或过短（少于50字符）
            # 条件3: 文档内容包含错误标记
            is_error = False
            error_reason = None
            
            if not url_doc:
                is_error = True
                error_reason = "解析失败: 未获取到文档内容"
            elif not url_doc.page_content or not url_doc.page_content.strip():
                is_error = True
                error_reason = "解析失败: 文档内容为空"
            elif len(url_doc.page_content.strip()) < 50:
                is_error = True
                error_reason = "解析失败: 文档内容过短"
            elif 'error' in url_doc.metadata or '爬取失败' in url_doc.page_content or '解析失败' in url_doc.page_content:
                # 如果文档已经是错误文档，直接使用，不再创建新的
                is_error = True
                error_reason = url_doc.metadata.get('error', '解析失败: 文档包含错误标记')
            
            if is_error:
                # 如果文档已经是错误文档，直接使用；否则创建新的错误文档
                if url_doc and 'error' in url_doc.metadata:
                    error_docs.append(url_doc)
                else:
                    # 创建错误文档
                    error_docs.append(Document(
                        page_content=f"解析失败: {error_reason}\n原始URL: {url}",
                        metadata={
                            "source": url,
                            "title": url,
                            "url": url,
                            "error": error_reason or "解析失败"
                        }
                    ))
            else:
                valid_docs.append(url_doc)
        
        # 1.1.12: 如果所有 URL 都失败，返回错误文档；否则返回混合结果
        result_docs = valid_docs + error_docs
        
        if os.getenv("ENV") == "development":
            logger.info(f"✅ 批量爬取完成: 成功 {len(valid_docs)}/{len(urls)} 个URL, 失败 {len(error_docs)} 个")
        
        return result_docs
    except Exception as e:
        if os.getenv("ENV") == "development":
            logger.error(f"❌ 爬取失败: {str(e)}")
        # 返回错误文档列表
        return [
            Document(
                page_content=f"解析失败: {str(e)}\n原始URL: {url}",
                metadata={
                    "source": url,
                    "title": url,
                    "url": url,
                    "error": str(e)
                }
            )
            for url in urls
        ]
