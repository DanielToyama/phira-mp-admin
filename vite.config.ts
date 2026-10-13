import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'
import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'

// Git 提交类型映射
const typeMap: Record<string, string> = {
  feat: '新功能',
  fix: '修复',
  docs: '文档',
  style: '样式',
  refactor: '重构',
  perf: '性能优化',
  test: '测试',
  chore: '杂项',
  ci: 'CI/CD',
  build: '构建',
  revert: '回滚',
}

// 解析提交信息
interface GitCommit {
  hash: string
  date: string
  message: string
  type: string
  typeLabel: string
  content: string
  author: string
}

// 获取 git commit hash
function getGitCommitHash() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
}

// 从 Git 获取提交历史
function getGitCommitsFromGit(): GitCommit[] {
  try {
    // 获取格式化的提交日志: hash|date|message|author
    const output = execSync(
      'git log --pretty=format:"%h|%ai|%s|%an" --no-merges',
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    )

    const commits: GitCommit[] = []
    const lines = output.trim().split('\n')

    for (const line of lines) {
      const parts = line.split('|')
      if (parts.length >= 4) {
        const [hash, date, message, author] = parts
        const cleanMessage = message.trim()

        // 解析提交类型
        const typeMatch = cleanMessage.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/)
        let type = 'other'
        let typeLabel = '其他'
        let content = cleanMessage

        if (typeMatch) {
          type = typeMatch[1].toLowerCase()
          // scope = typeMatch[2] || ''
          content = typeMatch[3]
          typeLabel = typeMap[type] || '其他'
        }

        commits.push({
          hash,
          date,
          message: cleanMessage,
          type,
          typeLabel,
          content,
          author,
        })
      }
    }

    return commits
  } catch {
    return []
  }
}

// 从 JSON 文件获取提交历史（用于 Cloudflare Pages 等浅克隆环境）
function getGitCommitsFromFile(): GitCommit[] {
  try {
    const changelogPath = path.resolve(__dirname, './public/changelog.json')
    if (existsSync(changelogPath)) {
      const content = readFileSync(changelogPath, 'utf-8')
      const data = JSON.parse(content)
      if (data.commits && Array.isArray(data.commits)) {
        console.log(`[vite] 从 changelog.json 加载了 ${data.commits.length} 条提交记录`)
        return data.commits
      }
    }
  } catch (error) {
    console.warn('[vite] 读取 changelog.json 失败:', error)
  }
  return []
}

// 获取 Git 提交历史（优先从 Git 获取，失败则从文件获取）
function getGitCommits(): GitCommit[] {
  // 首先尝试从 Git 获取
  const gitCommits = getGitCommitsFromGit()

  // 如果获取到多条记录，说明不是浅克隆，直接使用
  if (gitCommits.length > 1) {
    return gitCommits
  }

  // 如果只有一条或没有，可能是浅克隆，尝试从文件获取
  if (gitCommits.length <= 1) {
    console.log('[vite] Git 历史记录较少，尝试从 changelog.json 加载...')
    const fileCommits = getGitCommitsFromFile()
    if (fileCommits.length > 0) {
      return fileCommits
    }
  }

  // 返回 Git 获取的结果（即使只有一条）
  return gitCommits
}

// https://vite.dev/config/
export default defineConfig({
  // 使用相对路径，dist 可放在任意目录/子路径下静态托管
  base: './',
  plugins: [inspectAttr(), react()],
  define: {
    __GIT_COMMIT_HASH__: JSON.stringify(getGitCommitHash()),
    __GIT_COMMITS__: JSON.stringify(getGitCommits()),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // 启用代码分割
    rollupOptions: {
      output: {
        // 手动分包策略 - 简单策略：只分割项目代码，第三方依赖打包在一起
        manualChunks(id: string) {
          // 所有 node_modules 打包到一个 vendor chunk
          if (id.includes('node_modules') || id.includes('.pnpm')) {
            return 'vendor';
          }
          // 项目代码按功能模块分割
          if (id.includes('/src/pages/')) {
            return 'pages';
          }
          if (id.includes('/src/sections/')) {
            return 'sections';
          }
          if (id.includes('/src/components/ui/')) {
            return 'ui-components';
          }
          if (id.includes('/src/components/')) {
            return 'components';
          }
        },
        // 控制 chunk 文件大小和命名
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name || ''
          if (info.endsWith('.css')) {
            return 'assets/css/[name]-[hash][extname]'
          }
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(info)) {
            return 'assets/images/[name]-[hash][extname]'
          }
          if (/\.(woff2?|eot|ttf|otf)$/.test(info)) {
            return 'assets/fonts/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
    // 控制 chunk 大小警告阈值 (单位: KB)
    chunkSizeWarningLimit: 1000,
    // 启用压缩（使用 esbuild，Vite 默认）
    minify: 'esbuild',
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 生成 source map（生产环境可关闭）
    sourcemap: false,
  },
});
