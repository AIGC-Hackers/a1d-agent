import { stringifyJSON5 } from 'confbox'

import { defineLazyProperty } from './lazy'

/**
 * Concatenates multiple strings, filtering out null/undefined values
 */
export function concat(...items: (string | undefined | null)[]): string {
  return items.filter(Boolean).join('\n')
}

/**
 * Creates a code block with optional type
 */
export function block({
  content,
  type = '',
}: {
  content: string
  type?: string
}): string {
  return `\`\`\`${type ?? ''}\n${content}\n\`\`\``
}

/**
 * Creates a dash list from items, filtering out null/undefined values
 */
export function dashList(...items: (string | undefined | null)[]): string {
  return items
    .filter(Boolean)
    .map((item) => `- ${item}`)
    .join('\n')
}

/**
 * Creates a numbered list from items, filtering out null/undefined values
 */
export function numberedList(...items: (string | undefined | null)[]): string {
  return items
    .filter(Boolean)
    .map((item, index) => `${index + 1}. ${item}`)
    .join('\n')
}

/**
 * Creates a section with title and content
 */
export function section(title: string, content: string): string {
  return `## ${title}\n\n${content}`
}

/**
 * Creates a subsection with title and content
 */
export function subsection(title: string, content: string): string {
  return `### ${title}\n\n${content}`
}

class Variable {
  constructor(
    public readonly name: string,
    public readonly value: string,
  ) {}

  toString() {
    return `@$${this.name}`
  }
}

type VariableRepresentation = {
  readonly $block: string
}

/**
 * Creates an XML-style tag with content
 */
export function tag(name: string, content: string): string {
  return `<${name}>\n${content}\n</${name}>`
}

// expect:
// input:  'a', 'b', 'c'
// output: { a: (content: string) => string, b: (content: string) => string, c: (content: string) => string }
export function createTags<T extends string>(
  ...tagNames: T[]
): Record<T, (content: string) => string> {
  const result = {} as Record<T, (content: string) => string>

  for (const tagName of tagNames) {
    result[tagName] = (content: string) => tag(tagName, content)
  }

  return result
}

export const defineVars = <T extends Record<string, string>>(
  vars: T,
): { [K in keyof T]: Variable } & VariableRepresentation => {
  const result = {} as { [K in keyof T]: Variable & VariableRepresentation }
  for (const [key, value] of Object.entries(vars)) {
    if (key === '$block') {
      throw new Error('$block is a reserved key')
    }
    // @ts-expect-error
    result[key as keyof T] = new Variable(key, value)
  }

  defineLazyProperty(result, '$block', () =>
    stringifyJSON5(vars, { indent: 2 }),
  )

  return result as any
}
