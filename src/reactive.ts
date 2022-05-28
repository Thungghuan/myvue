type Keyof<T extends object> = keyof T

const bucket = new WeakMap<object, Map<string | symbol, Set<Function>>>()

let activeEffect: Function

function effect(fn: Function) {
  activeEffect = fn

  fn()
}

const data = { text: 'hello world' }

const obj = new Proxy(data, {
  get(target, key) {
    track(target, key)

    return target[key as Keyof<typeof target>]
  },
  set(target, key, newVal) {
    target[key as Keyof<typeof target>] = newVal

    trigger(target, key)

    return true
  }
})

function track<T extends object>(target: T, key: string | symbol) {
  if (!activeEffect) return

  let depsMap = bucket.get(target)
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()))
  }

  let deps = depsMap.get(key)
  if (!deps) {
    depsMap.set(key, (deps = new Set<Function>()))
  }

  deps.add(activeEffect)
}

function trigger<T extends object>(target: T, key: string | symbol) {
  const depsMap = bucket.get(target)
  if (!depsMap) return

  const effects = depsMap.get(key)

  effects && effects.forEach((fn) => fn())
}

effect(() => {
  document.body.innerText = obj.text
})

setTimeout(() => {
  obj.text = 'hello vue3'
}, 1000)
