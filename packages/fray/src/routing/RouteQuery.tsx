import {Component, Fragment, h} from '../Components/component.js'
import type {ComponentProps, FrayChild, WritableEmitter} from '../Components/component.js'
import type {RouteQueryCodec} from './route.js'

export interface RouteQueryProps<TValue> extends ComponentProps {
    name: string
    valueEmitter: WritableEmitter<TValue>
    codec: RouteQueryCodec<TValue>
    defaultValue: TValue
    equals?: (left: TValue, right: TValue) => boolean
}

/** Synchronize one explicitly declared application value with a URL query key. */
export class RouteQuery<TValue> extends Component<RouteQueryProps<TValue>> {
    private unregister: (() => void) | null = null

    initialize(): void {
        const router = this._runtime.router
        if (router == null || this._routeContext == null) {
            throw new Error('RouteQuery requires a router and contextual route scope')
        }
        this.unregister = router.registerQuery(this._routeContext, this, {
            name: this.props.name,
            valueEmitter: this.props.valueEmitter,
            codec: this.props.codec,
            defaultValue: this.props.defaultValue,
            ...(this.props.equals == null ? {} : {equals: this.props.equals}),
        })
    }

    render(): FrayChild {
        return h(Fragment, null, this.props.children ?? [])
    }

    override onDestroy(): void {
        this.unregister?.()
        this.unregister = null
    }
}
