#!/usr/bin/env node

/**
 * 生成提交历史 JSON 文件
 * 用于 Cloudflare Pages 等使用浅克隆的平台
 * 在本地开发时运行此脚本，将生成的文件提交到仓库
 */

import { execSync } from 'child_process'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Git 提交类型映射
const typeMap = {
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

// 拉取完整提交历史（避免浅克隆导致记录不全）
function fetchFullHistory() {
  try {
    console.log('正在拉取完整提交历史...')
    execSync('git fetch --unshallow --filter=blob:none origin', {
      encoding: 'utf-8',
      stdio: 'pipe',
    })
    console.log('✓ 已拉取完整提交历史')
  } catch (error) {
    // 可能已经是完整仓库，或远端不支持，忽略错误
    console.log('拉取完整历史跳过（可能已是完整仓库或不支持）')
  }
}

// 获取 Git 提交历史
function getGitCommits() {
  try {
    // 获取格式化的提交日志: hash|date|message|author
    const output = execSync(
      'git log --pretty=format:"%h|%ai|%s|%an" --no-merges',
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    )

    const commits = []
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
  } catch (error) {
    console.error('获取 Git 提交历史失败:', error.message)
    return []
  }
}

// 主函数
function main() {
  console.log('正在生成提交历史...')

  fetchFullHistory()

  const commits = getGitCommits()
  console.log(`获取到 ${commits.length} 条提交记录`)

  // 确保 public 目录存在
  const publicDir = join(__dirname, '..', 'public')
  try {
    mkdirSync(publicDir, { recursive: true })
  } catch {
    // 目录已存在
  }

  const outputPath = join(publicDir, 'changelog.json')

  // 浅克隆且拉取完整历史失败时，git 只能拿到 1 条记录。
  // 此时保留仓库里已提交的 changelog.json，不要把完整历史覆盖成 1 条。
  if (commits.length <= 1 && existsSync(outputPath)) {
    try {
      const existing = JSON.parse(readFileSync(outputPath, 'utf-8'))
      const existingCount = existing?.commits?.length ?? 0
      if (existingCount > commits.length) {
        console.log(
          `仅获取到 ${commits.length} 条记录，保留已有的 ${existingCount} 条，跳过写入`
        )
        return
      }
    } catch {
      // 已有文件不可读，继续写入
    }
  }

  // 写入 JSON 文件
  const data = {
    generatedAt: new Date().toISOString(),
    totalCommits: commits.length,
    commits,
  }

  writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`提交历史已保存到: ${outputPath}`)
}

main()
