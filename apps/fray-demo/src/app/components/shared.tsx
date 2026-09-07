import type {ComponentProps} from '@sylwellsoftware/fray'

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
