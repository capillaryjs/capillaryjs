import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild, Key} from '../component.js'
import {componentClass} from '../controlUtils.js'
import {RouteLink} from '../../routing/RouteLink.js'
import type {RouteDescriptor, RouteTarget} from '../../routing/route.js'
import type {ResolvedRoute} from '../../routing/router.js'

export interface BreadcrumbItem {
    id: Key
    label: FrayChild
    to?: RouteDescriptor | RouteTarget | ResolvedRoute
    onClick?: (event: MouseEvent) => void
    title?: string
}

export interface BreadcrumbProps extends ComponentProps {
    items: readonly BreadcrumbItem[]
    label?: string
}

/**
 * Ordered path of ancestor links ending in the current location. The final item
 * is rendered as `aria-current="page"` text; earlier items are router-aware
 * links when `to` is set, action anchors when only `onClick` is set, or plain
 * text otherwise.
 */
export class Breadcrumb extends Component<BreadcrumbProps> {
    static override liveProps: readonly string[] = []

    constructor(props: BreadcrumbProps) {
        super(props)
        validateBreadcrumb(props)
    }

    render(): FrayChild {
        validateBreadcrumb(this.props)
        const Host = this.Host
        const items = this.props.items
        const last = items.length - 1
        return <Host className={componentClass(this.props) || null}>
            <nav aria-label={this.props.label ?? 'Breadcrumb'}>
                <ol>{items.map((item, index) => <li key={String(item.id)}>
                    {index === last
                        ? <span aria-current="page" {...(item.title == null ? {} : {title: item.title})}>{item.label}</span>
                        : item.to != null
                            ? <RouteLink
                                to={item.to}
                                {...(item.title == null ? {} : {title: item.title})}
                                {...(item.onClick == null ? {} : {onClick: item.onClick})}
                            >{item.label}</RouteLink>
                            : item.onClick != null
                                ? <a
                                    href="#"
                                    {...(item.title == null ? {} : {title: item.title})}
                                    onClick={(event: MouseEvent) => {
                                        event.preventDefault()
                                        item.onClick!(event)
                                    }}
                                >{item.label}</a>
                                : <span {...(item.title == null ? {} : {title: item.title})}>{item.label}</span>}
                </li>)}</ol>
            </nav>
        </Host>
    }

    static dependencies = [RouteLink]
    static override hostName = 'breadcrumb'

    static override css = css`
        & {
            display: block;
            min-width: 0;
        }

        & > nav > ol {
            display: flex;
            flex-flow: row wrap;
            align-items: center;
            gap: var(--breadcrumb-gap, 0.375rem);
            margin: 0;
            padding: 0;
            list-style: none;
            min-width: 0;
        }

        & > nav > ol > li {
            display: inline-flex;
            align-items: center;
            min-width: 0;
        }

        & > nav > ol > li + li::before {
            content: "/";
            margin-inline-end: var(--breadcrumb-gap, 0.375rem);
            color: var(--breadcrumb-separator-color, var(--muted-color, currentColor));
            opacity: 0.6;
        }

        & > nav > ol > li > a {
            color: var(--breadcrumb-link-color, inherit);
            text-decoration: none;
            white-space: nowrap;
        }

        & > nav > ol > li > a:hover {
            text-decoration: underline;
        }

        & > nav > ol > li > [aria-current="page"] {
            font-weight: var(--breadcrumb-current-font-weight, 600);
        }
    `
}

function validateBreadcrumb(props: BreadcrumbProps): void {
    if (!Array.isArray(props.items)) throw new TypeError('Breadcrumb items must be an array')
    const ids = new Set<Key>()
    for (const item of props.items) {
        if (item == null || item.id == null) throw new TypeError('Each breadcrumb item requires an id')
        if (item.label == null) throw new TypeError('Each breadcrumb item requires a label')
        if (item.onClick != null && typeof item.onClick !== 'function') {
            throw new TypeError('Breadcrumb item onClick must be a function')
        }
        if (ids.has(item.id)) throw new Error(`Duplicate breadcrumb item id: ${String(item.id)}`)
        ids.add(item.id)
    }
}
