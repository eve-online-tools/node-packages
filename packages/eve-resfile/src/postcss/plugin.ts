import valueParser, { type WordNode } from 'postcss-value-parser'

import { resImportPrefix } from '../constants'
import { cssPlaceholderToken, registerCssPlaceholder, type ResfileBuildContext } from '../context'
import { devProxyUrl, normalizeResPath } from '../lookup'

export type ResfilePostcssTarget = 'placeholder' | 'dev-proxy'

export type ResfilePostcssOptions = {
  /** Rollup uses placeholders resolved in writeBundle; Vite dev uses the local proxy URL. */
  target?: ResfilePostcssTarget
}

const isResUrl = (value: string): boolean => value.startsWith(resImportPrefix) || value.startsWith('res:')

export const createResfilePostcssPlugin = (
  ctx: ResfileBuildContext,
  { target = 'placeholder' }: ResfilePostcssOptions = {},
) => {
  const plugin = {
    postcssPlugin: 'eve-resfile-postcss',

    Declaration(decl: { value: string }) {
      if (!decl.value.includes('url(') || !decl.value.includes('res:')) {
        return
      }

      const parsed = valueParser(decl.value)
      let changed = false

      parsed.walk((node) => {
        if (node.type !== 'function' || node.value !== 'url') {
          return
        }

        const urlNode = node.nodes?.[0]
        if (!urlNode || (urlNode.type !== 'string' && urlNode.type !== 'word')) {
          return
        }

        const raw = urlNode.value
        if (!isResUrl(raw)) {
          return
        }

        const resPath = normalizeResPath(raw)
        const replacement =
          target === 'dev-proxy' ? devProxyUrl(resPath) : cssPlaceholderToken(registerCssPlaceholder(ctx, resPath))
        node.nodes = [
          {
            type: 'word',
            value: replacement,
            sourceIndex: 0,
            sourceEndIndex: replacement.length,
          } satisfies WordNode,
        ]
        changed = true
      })

      if (changed) {
        decl.value = parsed.toString()
      }
    },
  }

  return plugin
}

createResfilePostcssPlugin.postcss = true
