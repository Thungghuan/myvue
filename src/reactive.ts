type Keyof<T extends object> = keyof T
interface EffectFn {
  (): void
  deps?: EffectFnSet[]
  options?: EffectFnOptions
}
type EffectFnSet = Set<EffectFn>
interface EffectFnOptions {
  scheduler?: (fn: EffectFn) => any
}

const bucket = new WeakMap<object, Map<string | symbol, EffectFnSet>>()

let activeEffect: EffectFn
const effectStack: EffectFn[] = []

export function effect(fn: EffectFn, options?: EffectFnOptions) {
  const effectFn: EffectFn = () => {
    activeEffect = effectFn
    effectStack.push(effectFn)

    cleanup(effectFn)
    fn()

    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]
  }

  effectFn.options = options
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

function track<T extends object>(target: T, key: string | symbol) {
  if (!activeEffect) return

  let depsMap = bucket.get(target)
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()))
  }

  let deps = depsMap.get(key)
  if (!deps) {
    depsMap.set(key, (deps = new Set()))
  }

  deps.add(activeEffect)

  activeEffect.deps?.push(deps)
}

function trigger<T extends object>(target: T, key: string | symbol) {
  const depsMap = bucket.get(target)
  if (!depsMap) return

  const effects = depsMap.get(key)

  const effectsToRun: EffectFnSet = new Set()
  effects &&
    effects.forEach((effectFn) => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  effectsToRun.forEach((effectFn) => {
    if (effectFn.options?.scheduler) {
      effectFn.options.scheduler(effectFn)
    } else {
      effectFn()
    }
  })
}

// const data = { ok: true, text: 'hello world' }

// const obj = new Proxy(data, {
//   get(target, key) {
//     track(target, key)

//     return target[key as Keyof<typeof target>]
//   },
//   set(target, key, newVal) {
//     ;(target[key as Keyof<typeof target>] as any) = newVal
//     trigger(target, key)

//     return true
//   }
// })

// effect(() => {
//   document.body.innerText = obj.ok ? obj.text : 'not'
//   console.log('run effect function')
// })

// setTimeout(() => {
//   obj.ok = false
// }, 1000)

// setTimeout(() => {
//   console.log('updating text if ok is false')
//   obj.text = 'hello vue3'
// }, 3000)

const data = { foo: 1 }

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

effect(
  () => {
    console.log(obj.foo)
  },
  {
    scheduler(fn: Function) {
      setTimeout(fn)
    }
  }
)

obj.foo++
console.log('end')

// effect(function effectFn1() {
//   console.log('effect1 executed')

//   effect(function effectFn2() {
//     console.log('effect2 executed')

//     obj.bar
//   })

//   obj.foo
// })

// obj.foo = false
