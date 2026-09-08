import {Component, css} from '../component.js'
import type {ComponentProps, FrayChild, Key} from '../component.js'
import {componentClass} from '../controlUtils.js'
import {RouteLink} from '../../routing/RouteLink.js'
import type {RouteDescriptor, RouteTarget} from '../../routing/route.js'
import type {ResolvedRoute} from '../../routing/router.js'

export interface NavigationBarItem {
    id: Key
    label: FrayChild
    to: RouteDescriptor | RouteTarget | ResolvedRoute
    exact?: boolean
    disabled?: boolean
    target?: string
    download?: string | boolean
    title?: string
    onClick?: (event: MouseEvent) => void
}

export interface NavigationBarProps extends ComponentProps {
    items: readonly NavigationBarItem[]
    label: string
}

/** Native application/document navigation over router-aware links. */
export class NavigationBar extends Component<NavigationBarProps> {
    static override liveProps: readonly string[] = []

    constructor(props: NavigationBarProps) {
        super(props)
        validateNavigation(props)
    }

    render(): FrayChild {
        validateNavigation(this.props)
        const Host = this.Host
        return <Host className={componentClass(this.props) || null}>
            <nav aria-label={this.props.label}>
                <ul>{this.props.items.map((item) => <li key={String(item.id)}>
                    {item.disabled
                        ? <span aria-disabled="true" title={item.title}>{item.label}</span>
                        : <RouteLink
                            to={item.to}
                            {...(item.exact == null ? {} : {exact: item.exact})}
                            {...(item.target == null ? {} : {target: item.target})}
                            {...(item.download == null ? {} : {download: item.download})}
                            {...(item.title == null ? {} : {title: item.title})}
                            {...(item.onClick == null ? {} : {onClick: item.onClick})}
                        >{item.label}</RouteLink>}
                </li>)}</ul>
            </nav>
        </Host>
    }

    static dependencies = [RouteLink]
    static override hostName = 'navigation-bar'

    static override css = css`
        & {
            display: block;
            flex: 0 0 auto;
            min-width: 0;
            color: var(--navigation-bar-color);
            background: var(--navigation-bar-background);
            border: var(--navigation-bar-border);
            box-shadow: var(--navigation-bar-shadow);
        }

        & > nav,
        & > nav > ul {
            min-width: 0;
        }

        & > nav > ul {
            display: flex;
            flex-flow: row wrap;
            gap: var(--navigation-bar-gap);

            align-items: center;
            justify-content: center;
            margin: 0;
            padding: var(--navigation-bar-padding);
            list-style: none;
        }

        & > nav > ul > li {
            display: flex;
        }

        & > nav > ul > li > a,
        & > nav > ul > li > span[aria-disabled="true"] {
            display: inline-flex;
            align-items: center;
            min-height: var(--control-min-height, 2rem);
            padding: var(--navigation-link-padding);
            box-sizing: border-box;
            color: var(--navigation-link-color);
            background: var(--navigation-link-background);
            border: var(--navigation-link-border);
            border-radius: var(--navigation-link-radius);
            box-shadow: var(--navigation-link-shadow);
            font-family: inherit;
            font-size: 1.1rem;
            line-height: calc(var(--ui-font-size) + var(--ui-padding) + var(--ui-padding));
            text-decoration: none;
            white-space: nowrap;
        }

        & > nav > ul > li > a:hover {
            color: var(--navigation-link-color-hover);
            background: var(--navigation-link-background-hover);
        }

        & > nav > ul > li > a:active {
            color: var(--navigation-link-color-active);
            background: var(--navigation-link-background-active);
        }

        & > nav > ul > li > a[aria-current="page"] {
            color: var(--navigation-link-color-current);
            background: var(--navigation-link-background-current);
            box-shadow: var(--navigation-link-shadow-current);
            font-weight: var(--navigation-link-font-weight-current);
        }

        & > nav > ul > li > a:focus-visible {
            outline: 2px solid transparent;
            outline-offset: 1px;
            box-shadow: var(--focus-ring);
        }

        & > nav > ul > li > span[aria-disabled="true"] {
            color: var(--navigation-link-color-disabled);
            background: var(--navigation-link-background-disabled);
            border: var(--navigation-link-border);
            cursor: not-allowed;
        }
    `
}

function validateNavigation(props: NavigationBarProps): void {
    if (typeof props.label !== 'string' || props.label.trim() === '') {
        throw new TypeError('NavigationBar label must be a non-empty string')
    }
    if (!Array.isArray(props.items)) throw new TypeError('NavigationBar items must be an array')
    const ids = new Set<Key>()
    for (const item of props.items) {
        if (item == null || item.id == null) throw new TypeError('Each navigation item requires an id')
        if (item.label == null) throw new TypeError('Each navigation item requires a label')
        if (item.to == null) throw new TypeError('Each navigation item requires a route target')
        if (ids.has(item.id)) throw new Error(`Duplicate navigation item id: ${String(item.id)}`)
        if (item.onClick != null && typeof item.onClick !== 'function') {
            throw new TypeError('Navigation item onClick must be a function')
        }
        ids.add(item.id)
    }
}
