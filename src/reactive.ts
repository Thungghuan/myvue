type Keyof<T extends object> = keyof T
interface EffectFn {
  (): void
  deps?: EffectFnSet[]
  options?: EffectFnOptions
}
type EffectFnSet = Set<EffectFn>
interface EffectFnOptions {
  scheduler?: (fn?: EffectFn) => any
  lazy?: boolean
}

const bucket = new WeakMap<object, Map<string | symbol, EffectFnSet>>()

let activeEffect: EffectFn
const effectStack: EffectFn[] = []

function effect(fn: EffectFn, options?: EffectFnOptions) {
  const effectFn: EffectFn = () => {
    activeEffect = effectFn
    effectStack.push(effectFn)

    cleanup(effectFn)

    const res = fn()

    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]

    return res
  }

  effectFn.options = options
  effectFn.deps = []
  if (!options?.lazy) {
    effectFn()
  }

  return effectFn
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

export function computed(getter: () => any) {
  let value: any
  let dirty = true

  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      dirty = true

      trigger(obj, 'value')
    }
  })

  const obj = {
    get value() {
      if (dirty) {
        value = effectFn()

        dirty = false
      }

      track(obj, 'value')

      return value
    }
  }

  return obj
}

interface WatchOptions {
  immediate?: boolean
  flush?: 'pre' | 'post' | 'sync'
}

export function watch(
  source: any,
  cb: (newValue?: any, oldValue?: any, onInvalidate?: Function) => any,
  options?: WatchOptions
) {
  let getter: EffectFn

  if (typeof source === 'function') {
    getter = source
  } else {
    getter = () => traverse(source)
  }

  let oldValue: any, newValue

  let cleanup: Function
  function onInvalidate(fn: Function) {
    cleanup = fn
  }

  const job = () => {
    newValue = effectFn()

    if (cleanup) {
      cleanup()
    }

    cb(newValue, oldValue, onInvalidate)
    oldValue = newValue
  }

  const effectFn = effect(() => getter(), {
    lazy: true,
    scheduler: () => {
      if (options?.flush === 'post') {
        Promise.resolve().then(job)
      } else {
        job()
      }
    }
  })

  if (options?.immediate) {
    job()
  } else {
    oldValue = effectFn()
  }
}

function traverse(value: any, seen = new Set()) {
  if (typeof value !== 'object' || value === null || seen.has(value)) return

  seen.add(value)
  for (const k in value) {
    traverse(value[k], seen)
  }

  return value
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

const jobQueue = new Set<EffectFn>()
const p = Promise.resolve()

let isFlushing = false
function flushJob() {
  if (isFlushing) return

  isFlushing = true
  p.then(() => {
    jobQueue.forEach((job) => job())
  }).finally(() => {
    isFlushing = false
  })
}

const data = { foo: 1, bar: 2 }

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

// const effectFn = effect(
//   () => {
//     console.log(obj.foo)
//   },
//   {
//     scheduler(fn?: EffectFn) {
//       // setTimeout(fn)
//       fn && jobQueue.add(fn)
//       flushJob()
//     },
//     lazy: true
//   }
// )

// // const sumRes = computed(() => obj.foo + obj.bar)

// // obj.foo++
// // effectFn()

// // console.log(sumRes.value)
// // obj.foo++
// // console.log(sumRes.value)

// // effect(() => {
// //   console.log(sumRes.value)
// // })

// // obj.bar++

console.log('watch')
console.log(obj)

watch(
  () => obj.foo,
  (val, oldVal) => {
    console.log('obj has updated')
    console.log('Before:', oldVal)
    console.log('After:', val)
  }
)
obj.foo++

// effect(function effectFn1() {
//   console.log('effect1 executed')

//   effect(function effectFn2() {
//     console.log('effect2 executed')

//     obj.bar
//   })

//   obj.foo
// })

// obj.foo = false
