import {Component, css} from '../component.js'
import type {ComponentDependency, ComponentProps, CapillaryUiChild} from '../component.js'
import {CapillaryUiRuntime} from '../../runtime.js'
import {islandLayoutClassName, layoutDirectionClassName} from '../layout/layoutTraits.js'
import type {CapillaryUiIslandLayoutProps, CapillaryUiLayoutDirection} from '../layout/layoutTraits.js'

/** Viewport sizing policy for a Capillary UI application root. */
export type CapillaryUiAppSizing =
    | 'embedded'
    | 'viewport-width'
    | 'viewport-height'
    | 'viewport'

/** Landmark policy for a Capillary UI application root. */
export type CapillaryUiAppLandmark = 'main' | 'none'

export interface CapillaryUiAppProps extends ComponentProps, CapillaryUiIslandLayoutProps {
    /**
     * Select the viewport axes claimed by the application shell. Embedded is
     * sizing-neutral; the other values use Capillary UI's public fill traits.
     */
    sizing?: CapillaryUiAppSizing
    /** Arrange root children on the bounded host. Defaults to vertical with islands enabled. */
    layout?: CapillaryUiLayoutDirection
    /**
     * `main` exposes the app as the document's primary-content landmark.
     * Embedded applications should select `none`.
     */
    landmark?: CapillaryUiAppLandmark
}

/**
 * A fixed application shell with a `cap-app` host and theme typography.
 *
 * Instantiate it with children for a small application, or derive from it and
 * override `renderContent()` for an application composition root.
 */
export class CapillaryUiApp extends Component<CapillaryUiAppProps> {
    override mount(parent: ParentNode | null = null, before: Node | null = null): this {
        if (parent != null) {
            const targetDocument = parentDocument(parent, 'CapillaryUiApp.mount')
            const dependency = this.constructor as unknown as ComponentDependency
            this._runtime.registerStyles(dependency).injectStyles(targetDocument)
        }
        return super.mount(parent, before)
    }

    protected renderContent(): CapillaryUiChild {
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
            islands,
            landmark = 'main',
            ...hostProps
        } = this.props
        const Host = this.Host
        const direction = layout ?? (islands === true ? 'vertical' : undefined)
        const rootClassName = mergeClassNames(
            classAlias,
            className,
            sizingClassName(sizing),
            direction == null ? undefined : layoutDirectionClassName(direction),
            islandLayoutClassName(islands),
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
export function mountCapillaryUiApp<TArgs extends unknown[], TApp extends CapillaryUiApp>(
    runtime: CapillaryUiRuntime,
    appType: (new(...args: TArgs) => TApp) & ComponentDependency,
    parent: ParentNode,
    ...args: TArgs
): TApp {
    if (!(runtime instanceof CapillaryUiRuntime)) {
        throw new TypeError('mountCapillaryUiApp requires a CapillaryUiRuntime')
    }
    const targetDocument = parentDocument(parent, 'mountCapillaryUiApp')

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

function sizingClassName(sizing: CapillaryUiAppSizing): string | undefined {
    switch (sizing) {
        case 'embedded': return undefined
        case 'viewport-width': return 'cap-fill-horizontal'
        case 'viewport-height': return 'cap-fill-vertical'
        case 'viewport': return 'cap-fill-horizontal cap-fill-vertical'
        default: throw new TypeError(
            'CapillaryUiApp sizing must be embedded, viewport-width, viewport-height, or viewport',
        )
    }
}

function landmarkRole(landmark: CapillaryUiAppLandmark): 'main' | null {
    if (landmark === 'main') return 'main'
    if (landmark === 'none') return null
    throw new TypeError('CapillaryUiApp landmark must be main or none')
}

function mergeClassNames(...values: readonly (string | null | undefined)[]): string | undefined {
    const merged = values.flatMap(value => value?.trim().split(/\s+/) ?? []).filter(Boolean).join(' ')
    return merged.length === 0 ? undefined : merged
}
