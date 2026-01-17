/* eslint-disable @typescript-eslint/no-explicit-any */
/// <reference types="vite/client" />

// 1.0.0: YUIChat 项目 - 环境变量类型定义
interface ImportMetaEnv {
  readonly VITE_SUPABASE_PROJECT_REF?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_DEBUG_SCROLL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};

