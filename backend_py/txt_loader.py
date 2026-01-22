# 1.2.42: TXT 文本文件加载器 - 基于 Chatmax TxtLoader 实现
# 支持自动编码检测和多种编码格式

import os
from typing import List, Optional
from langchain_core.documents import Document

# 可选依赖：编码检测
try:
    import chardet
    HAS_CHARDET = True
except ImportError:
    HAS_CHARDET = False

# 1.2.42: 环境检测
ENV = os.getenv("ENV", "production")

def log_debug(message: str):
    """仅在开发环境输出日志"""
    if ENV == "development":
        print(message)


class TxtLoader:
    """
    1.2.42: TXT 文本文件加载器

    基于 Chatmax 的 TxtLoader 实现，支持：
    - 自动编码检测（需要安装 chardet）
    - 多种编码格式：UTF-8, GBK, GB2312, GB18030, BIG5 等
    - 错误处理和回退机制

    使用方法：
        loader = TxtLoader("path/to/file.txt")
        documents = loader.load()
    """

    # 常用编码列表（按优先级排序）
    ENCODINGS = [
        'utf-8',
        'utf-8-sig',  # 带 BOM 的 UTF-8
        'gbk',
        'gb2312',
        'gb18030',
        'big5',
        'latin-1',
        'iso-8859-1',
        'ascii'
    ]

    def __init__(
        self,
        file_path: str,
        encoding: Optional[str] = None,
        errors: Optional[str] = 'ignore'
    ):
        """
        初始化 TXT 加载器

        Args:
            file_path: 文本文件路径
            encoding: 指定编码（None 则自动检测）
            errors: 编码错误处理方式（'strict', 'ignore', 'replace'）
        """
        self.file_path = file_path
        self.encoding = encoding
        self.errors = errors

        # 验证文件存在
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

    def load(self) -> List[Document]:
        """
        加载 TXT 文件并返回 Document 列表

        Returns:
            List[Document]: 包含单个文档的列表
        """
        log_debug(f"📄 开始加载 TXT 文件: {self.file_path}")

        # 获取编码
        encoding = self.encoding or self._detect_encoding()
        log_debug(f"  使用编码: {encoding}")

        # 尝试读取文件
        text = self._read_file(encoding)

        if text is None:
            # 所有编码都失败，返回错误文档
            log_debug(f"❌ 无法读取文件: {self.file_path}")
            return [Document(
                page_content=f"无法读取文件: {self.file_path}，编码检测失败",
                metadata={
                    "source": self.file_path,
                    "file_path": self.file_path,
                    "file_type": "txt",
                    "error": "encoding_error"
                }
            )]

        # 创建文档
        doc = Document(
            page_content=text,
            metadata={
                "source": self.file_path,
                "file_path": self.file_path,
                "file_type": "txt",
                "encoding": encoding,
                "char_count": len(text),
                "line_count": text.count('\n') + 1
            }
        )

        log_debug(f"✅ TXT 加载完成: {len(text)} 字符, {text.count(chr(10)) + 1} 行")
        return [doc]

    def _detect_encoding(self) -> str:
        """
        自动检测文件编码

        Returns:
            str: 检测到的编码名称
        """
        # 方法1：使用 chardet 库
        if HAS_CHARDET:
            try:
                with open(self.file_path, 'rb') as f:
                    raw_data = f.read()
                result = chardet.detect(raw_data)
                if result and result.get('encoding'):
                    confidence = result.get('confidence', 0)
                    encoding = result['encoding']
                    log_debug(f"  chardet 检测编码: {encoding} (置信度: {confidence:.2%})")
                    if confidence > 0.7:
                        return encoding
            except Exception as e:
                log_debug(f"  chardet 检测失败: {e}")

        # 方法2：尝试常用编码
        for encoding in self.ENCODINGS:
            try:
                with open(self.file_path, 'r', encoding=encoding) as f:
                    f.read(1024)  # 读取前 1KB 测试
                log_debug(f"  编码测试通过: {encoding}")
                return encoding
            except (UnicodeDecodeError, UnicodeError):
                continue

        # 默认返回 UTF-8
        log_debug("  使用默认编码: utf-8")
        return 'utf-8'

    def _read_file(self, encoding: str) -> Optional[str]:
        """
        使用指定编码读取文件

        Args:
            encoding: 编码名称

        Returns:
            str: 文件内容，失败返回 None
        """
        # 首先尝试指定编码
        try:
            with open(self.file_path, 'r', encoding=encoding, errors=self.errors) as f:
                return f.read()
        except (UnicodeDecodeError, UnicodeError) as e:
            log_debug(f"  编码 {encoding} 读取失败: {e}")

        # 尝试其他编码
        for fallback_encoding in self.ENCODINGS:
            if fallback_encoding == encoding:
                continue
            try:
                with open(self.file_path, 'r', encoding=fallback_encoding, errors=self.errors) as f:
                    content = f.read()
                log_debug(f"  回退到编码 {fallback_encoding} 成功")
                return content
            except (UnicodeDecodeError, UnicodeError):
                continue

        # 最后尝试二进制读取并解码
        try:
            with open(self.file_path, 'rb') as f:
                raw_data = f.read()
            return raw_data.decode('utf-8', errors='ignore')
        except Exception:
            return None


# 1.2.42: 工厂函数 - 兼容 langchain 加载器接口
def create_txt_loader(
    file_path: str,
    encoding: Optional[str] = None
) -> TxtLoader:
    """
    创建 TXT 加载器实例

    Args:
        file_path: 文本文件路径
        encoding: 指定编码（可选）

    Returns:
        TxtLoader: 加载器实例
    """
    return TxtLoader(file_path, encoding=encoding)
