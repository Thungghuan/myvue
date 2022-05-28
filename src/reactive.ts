type Keyof<T extends object> = keyof T
interface EffectFn {
  (): void
  deps?: Set<Function>[]
}

const bucket = new WeakMap<object, Map<string | symbol, Set<Function>>>()

let activeEffect: EffectFn

export function effect(fn: EffectFn) {
  const effectFn: EffectFn = () => {
    activeEffect = effectFn

    cleanup(effectFn)
    fn()
  }

  effectFn.deps = []
  effectFn()
}

function cleanup(effectFn: EffectFn) {
  for (let i = 0; i < effectFn.deps!.length; i++) {
    const deps = effectFn.deps![i]
    deps.delete(effectFn)
  }

  effectFn.deps!.length = 0
}

const data = { ok: true, text: 'hello world' }

const obj = new Proxy(data, {
  get(target, key) {
    track(target, key)

    return target[key as Keyof<typeof target>]
  },
  set(target, key, newVal) {
    ;(target[key as Keyof<typeof target>] as any) = newVal
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

  activeEffect.deps?.push(deps)
}

function trigger<T extends object>(target: T, key: string | symbol) {
  const depsMap = bucket.get(target)
  if (!depsMap) return

  const effects = depsMap.get(key)

  const effectsToRun = new Set(effects)
  effectsToRun.forEach((fn) => fn())
}

effect(() => {
  document.body.innerText = obj.ok ? obj.text : 'not'
  console.log('run effect function')
})

setTimeout(() => {
  obj.ok = false
}, 1000)


setTimeout(() => {
  console.log('updating text if ok is false')
  obj.text = 'hello vue3'
}, 3000)