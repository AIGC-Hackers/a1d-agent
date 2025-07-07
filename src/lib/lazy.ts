export function defineLazyProperty<T>(
  target: object,
  property: string,
  getter: () => T,
) {
  const value = getter()
  Object.defineProperty(target, property, { value })
  return value
}

export function lazy<T>(getter: () => T): { value: T } {
  return {
    get value() {
      return defineLazyProperty(this, 'value', getter)
    },
  }
}
