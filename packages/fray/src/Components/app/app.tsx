import {Component, css} from '../component.js'
import type {ComponentDependency, ComponentProps, FrayChild} from '../component.js'
import {FrayRuntime} from '../../runtime.js'
import {layoutDirectionClassName} from '../layout/layoutTraits.js'
import type {FrayLayoutDirection} from '../layout/layoutTraits.js'

/** Viewport sizing policy for a Fray application root. */
export type FrayAppSizing =
    | 'embedded'
    | 'viewport-width'
    | 'viewport-height'
    | 'viewport'

/** Landmark policy for a Fray application root. */
export type FrayAppLandmark = 'main' | 'none'

export interface FrayAppProps extends ComponentProps {
    /**
     * Select the viewport axes claimed by the application shell. Embedded is
     * sizing-neutral; the other values use Fray's public fill traits.
     */
    sizing?: FrayAppSizing
    /** Arrange application-owned root children on the bounded host. */
    layout?: FrayLayoutDirection
    /**
     * `main` exposes the app as the document's primary-content landmark.
     * Embedded applications should select `none`.
     */
    landmark?: FrayAppLandmark
}

/**
 * A fixed application shell with a `fray-app` host and theme typography.
 *
 * Instantiate it with children for a small application, or derive from it and
 * override `renderContent()` for an application composition root.
 */
export class FrayApp extends Component<FrayAppProps> {
    override mount(parent: ParentNode | null = null, before: Node | null = null): this {
        if (parent != null) {
            const targetDocument = parentDocument(parent, 'FrayApp.mount')
            const dependency = this.constructor as unknown as ComponentDependency
            this._runtime.registerStyles(dependency).injectStyles(targetDocument)
        }
        return super.mount(parent, before)
    }

    protected renderContent(): FrayChild {
        return this.props.children ?? null
    }

    render() {
        const {
            children: _children,
            key: _key,
            class: classAlias,
            className,
            island: _island,
            sizing = 'embedded',
            layout,
            landmark = 'main',
            ...hostProps
        } = this.props
        const Host = this.Host
        const rootClassName = mergeClassNames(
            classAlias,
            className,
            sizingClassName(sizing),
            layout == null ? undefined : layoutDirectionClassName(layout),
        )
        return <Host
            {...hostProps}
            role={landmarkRole(landmark)}
            {...(rootClassName == null ? {} : {className: rootClassName})}
        >
            {this.renderContent()}
        </Host>
    }

    static override hostName = 'app'

    static override css = css`
        & {
            box-sizing: border-box;
            display: block;
            background: var(--application-background);
            color: var(--ui-color);
            font-family: var(--font-family);
            font-size: var(--font-size);
            line-height: var(--line-height);
        }
    `
}

/**
 * Register an application root's reachable structural CSS before mounting it.
 * Presentation assets remain explicit application policy.
 */
export function mountFrayApp<TArgs extends unknown[], TApp extends FrayApp>(
    runtime: FrayRuntime,
    appType: (new(...args: TArgs) => TApp) & ComponentDependency,
    parent: ParentNode,
    ...args: TArgs
): TApp {
    if (!(runtime instanceof FrayRuntime)) {
        throw new TypeError('mountFrayApp requires a FrayRuntime')
    }
    const targetDocument = parentDocument(parent, 'mountFrayApp')

    runtime.registerStyles(appType).injectStyles(targetDocument)
    return runtime.mount(runtime.create(appType, ...args), parent)
}

function parentDocument(parent: ParentNode, caller: string): Document {
    if (parent == null || typeof parent !== 'object' || !('ownerDocument' in parent)) {
        throw new TypeError(`${caller} requires a DOM parent node`)
    }
    const targetDocument = parent.ownerDocument ?? (parent.nodeType === 9 ? parent as Document : null)
    if (targetDocument?.head == null) {
        throw new TypeError(`${caller} requires a parent associated with a document head`)
    }
    return targetDocument
}

function sizingClassName(sizing: FrayAppSizing): string | undefined {
    switch (sizing) {
        case 'embedded': return undefined
        case 'viewport-width': return 'fray-fill-horizontal'
        case 'viewport-height': return 'fray-fill-vertical'
        case 'viewport': return 'fray-fill-horizontal fray-fill-vertical'
        default: throw new TypeError(
            'FrayApp sizing must be embedded, viewport-width, viewport-height, or viewport',
        )
    }
}

function landmarkRole(landmark: FrayAppLandmark): 'main' | null {
    if (landmark === 'main') return 'main'
    if (landmark === 'none') return null
    throw new TypeError('FrayApp landmark must be main or none')
}

function mergeClassNames(...values: readonly (string | null | undefined)[]): string | undefined {
    const merged = values.flatMap(value => value?.trim().split(/\s+/) ?? []).filter(Boolean).join(' ')
    return merged.length === 0 ? undefined : merged
}
