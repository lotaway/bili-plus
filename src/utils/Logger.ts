function checkIsDev() {
    return process.env.NEXT_PUBLIC_ENV === "DEV"
}

export default class Logger {

    static L(...params: Parameters<typeof console.log>) {
        return console.log(...params)
    }

    static D(...params: Parameters<typeof console.debug>) {
        if (checkIsDev())
            return console.debug(...params)
    }

    static I(...params: Parameters<typeof console.info>) {
        if (checkIsDev())
            return console.info(...params)
    }

    static E(...params: Parameters<typeof console.error>) {
        if (checkIsDev())
            return console.error(...params)
    }

    static Mark(name?: string) {
        return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
            const originalMethod = descriptor.value
            descriptor.value = function (...args: any[]) {
                const result = originalMethod.apply(this, args)
                const log = (res: any, fn: Function = Logger.I) => {
                    fn([name, target.name || target?.constructor?.name, propertyKey].filter(Boolean).join("::"), "args:", args, "res:", res)
                }
                if (result instanceof Promise) {
                    result.then(res => {
                        log(res)
                        return res
                    }).catch(err => {
                        log(err, Logger.E)
                    })
                }
                else {
                    log(result)
                }
                return result
            }
        }
    }

}