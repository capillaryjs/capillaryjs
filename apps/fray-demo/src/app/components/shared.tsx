import type {ComponentProps} from '@sylwellsoftware/fray'

interface ScreenHeadingProps extends ComponentProps {
    readonly eyebrow: string
    readonly title: string
    readonly summary?: string
}

export function ScreenHeading({eyebrow, title, summary}: ScreenHeadingProps) {
    return <header class="work-area-heading">
        <p class="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {summary == null ? null : <p>{summary}</p>}
    </header>
}

interface FeaturePlaceholderProps extends ComponentProps {
    readonly feature: string
    readonly purpose: string
    readonly compact?: boolean
}

export function FeaturePlaceholder({
    feature,
    purpose,
    compact = false,
}: FeaturePlaceholderProps) {
    return <section
        className={compact ? 'feature-placeholder compact' : 'feature-placeholder'}
        aria-label={`${feature} placeholder`}
    >
        <span>Pending component approval</span>
        <strong>{feature}</strong>
        <p>{purpose}</p>
    </section>
}
