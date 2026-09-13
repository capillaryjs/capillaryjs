import type {FrayMessageOverrides} from '@sylwellsoftware/fray'

export const demoLocaleIds = ['en-GB', 'da-DK', 'de-DE'] as const

export type DemoLocale = (typeof demoLocaleIds)[number]

export interface DemoCopy {
    readonly documentTitle: string
    readonly eyebrow: string
    readonly title: string
    readonly introduction: string
    readonly languageLabel: string
    readonly runtimeNote: string
    readonly controlsHeading: string
    readonly assigneeLabel: string
    readonly assigneeOptions: readonly [string, string][]
    readonly dateLabel: string
    readonly timeLabel: string
    readonly remindersLabel: string
    readonly statesHeading: string
    readonly listHeading: string
    readonly tableCaption: string
    readonly tableNameColumn: string
    readonly dialogHeading: string
    readonly dialogOpenLabel: string
    readonly dialogTitle: string
    readonly dialogDescription: string
    readonly dialogBody: string
    readonly resolvedHeading: string
    readonly resolvedIntroduction: string
    readonly dropdownMessageLabel: string
    readonly timeMessageLabel: string
    readonly emptyMessageLabel: string
    readonly closeMessageLabel: string
    readonly sortMessageLabel: string
    readonly calendarMessageLabel: string
}

export interface DemoLocaleDefinition {
    readonly locale: DemoLocale
    readonly autonym: string
    readonly copy: DemoCopy
    readonly frayMessages: FrayMessageOverrides
}

const englishCopy: DemoCopy = {
    documentTitle: 'Fray localization demo',
    eyebrow: 'Mini component gallery',
    title: 'Fray localization',
    introduction: 'Switch language to update application text and Fray-owned labels together.',
    languageLabel: 'Language',
    runtimeNote: 'Each choice creates a new runtime with one immutable locale snapshot.',
    controlsHeading: 'Inputs and calendar',
    assigneeLabel: 'Assign to',
    assigneeOptions: [['design', 'Design'], ['engineering', 'Engineering']],
    dateLabel: 'Target date',
    timeLabel: 'Reminder time',
    remindersLabel: 'Enable reminders',
    statesHeading: 'Framework empty states',
    listHeading: 'Empty task list',
    tableCaption: 'Empty task table',
    tableNameColumn: 'Task name',
    dialogHeading: 'Dialog',
    dialogOpenLabel: 'Open dialog',
    dialogTitle: 'Localized dialog',
    dialogDescription: 'The title and body belong to the application catalog.',
    dialogBody: 'The close action below is text authored and localized by Fray.',
    resolvedHeading: 'Resolved Fray messages',
    resolvedIntroduction: 'These values come from the same runtime snapshot used by the controls.',
    dropdownMessageLabel: 'Dropdown placeholder',
    timeMessageLabel: 'Time placeholder',
    emptyMessageLabel: 'Table empty state',
    closeMessageLabel: 'Dialog close action',
    sortMessageLabel: 'Generated sort label',
    calendarMessageLabel: 'Calendar label',
}

const danishMessages: FrayMessageOverrides = {
    breadcrumbLabel: 'Brødkrumme',
    calendarGridLabel: 'Vælg en dato',
    calendarNextMonthLabel: 'Næste måned',
    calendarPreviousMonthLabel: 'Forrige måned',
    checkboxOptionLabel: 'Valgmulighed',
    checkboxStateLabel: (label, state) => `${label}: ${state}`,
    colorOptionGrayLabel: 'Grå',
    colorOptionGreenLabel: 'Grøn',
    colorOptionIceBlueLabel: 'Isblå',
    colorOptionOceanLabel: 'Havblå',
    colorOptionOrangeLabel: 'Orange',
    colorOptionPurpleLabel: 'Lilla',
    colorOptionRedLabel: 'Rød',
    colorOptionYellowLabel: 'Gul',
    dataTableEmpty: 'Ingen rækker',
    dataTableLoadError: 'Rækkerne kunne ikke indlæses',
    dataTableLoading: 'Indlæser rækker…',
    dataTableRetry: 'Prøv igen',
    datePickerDialogLabel: 'Vælg en dato',
    datePickerOpenCalendarLabel: 'Åbn kalender',
    dateTimePickerDateLabel: 'Dato',
    dateTimePickerTimeLabel: 'Tid',
    dialogCloseLabel: 'Luk',
    dropdownPlaceholder: 'Vælg…',
    filterModeDenyLabel: 'afvis',
    filterModeNeutralLabel: 'neutral',
    filterModePreferLabel: 'foretræk',
    filterModeRequireLabel: 'kræv',
    filterPanelEmpty: 'Ingen filtermuligheder',
    filterPanelLabel: 'Filtermuligheder',
    filterPanelLoadError: 'Filtermulighederne kunne ikke indlæses',
    filterPanelLoading: 'Indlæser filtermuligheder…',
    listViewEmpty: 'Ingen elementer',
    listViewLabel: 'Elementer',
    listViewLoadError: 'Elementerne kunne ikke indlæses',
    listViewLoading: 'Indlæser elementer…',
    progressInProgress: 'I gang',
    radioOptionLabel: 'Valgmulighed',
    splitViewSeparatorLabel: 'Tilpas paneler',
    tabLineLabel: 'Sektioner',
    tableFilterColumnLabel: (label) => `Filtrér ${label}`,
    tableSortColumnLabel: (label) => `Sortér ${label}`,
    themeOptionJavaLabel: 'Java',
    themeOptionMinimalLabel: 'Minimal',
    themeOptionShinyLabel: 'Blank',
    timePickerPlaceholder: 'Vælg tidspunkt…',
    toolbarLabel: 'Handlinger',
    treeViewEmpty: 'Ingen træelementer',
    treeViewLoadError: 'Træelementerne kunne ikke indlæses',
}

const germanMessages: FrayMessageOverrides = {
    breadcrumbLabel: 'Navigationspfad',
    calendarGridLabel: 'Datum auswählen',
    calendarNextMonthLabel: 'Nächster Monat',
    calendarPreviousMonthLabel: 'Vorheriger Monat',
    checkboxOptionLabel: 'Option',
    checkboxStateLabel: (label, state) => `${label}: ${state}`,
    colorOptionGrayLabel: 'Grau',
    colorOptionGreenLabel: 'Grün',
    colorOptionIceBlueLabel: 'Eisblau',
    colorOptionOceanLabel: 'Ozeanblau',
    colorOptionOrangeLabel: 'Orange',
    colorOptionPurpleLabel: 'Violett',
    colorOptionRedLabel: 'Rot',
    colorOptionYellowLabel: 'Gelb',
    dataTableEmpty: 'Keine Zeilen',
    dataTableLoadError: 'Zeilen konnten nicht geladen werden',
    dataTableLoading: 'Zeilen werden geladen…',
    dataTableRetry: 'Erneut versuchen',
    datePickerDialogLabel: 'Datum auswählen',
    datePickerOpenCalendarLabel: 'Kalender öffnen',
    dateTimePickerDateLabel: 'Datum',
    dateTimePickerTimeLabel: 'Uhrzeit',
    dialogCloseLabel: 'Schließen',
    dropdownPlaceholder: 'Auswählen…',
    filterModeDenyLabel: 'ablehnen',
    filterModeNeutralLabel: 'neutral',
    filterModePreferLabel: 'bevorzugen',
    filterModeRequireLabel: 'erforderlich',
    filterPanelEmpty: 'Keine Filteroptionen',
    filterPanelLabel: 'Filteroptionen',
    filterPanelLoadError: 'Filteroptionen konnten nicht geladen werden',
    filterPanelLoading: 'Filteroptionen werden geladen…',
    listViewEmpty: 'Keine Einträge',
    listViewLabel: 'Einträge',
    listViewLoadError: 'Einträge konnten nicht geladen werden',
    listViewLoading: 'Einträge werden geladen…',
    progressInProgress: 'In Bearbeitung',
    radioOptionLabel: 'Option',
    splitViewSeparatorLabel: 'Bereiche anpassen',
    tabLineLabel: 'Abschnitte',
    tableFilterColumnLabel: (label) => `${label} filtern`,
    tableSortColumnLabel: (label) => `${label} sortieren`,
    themeOptionJavaLabel: 'Java',
    themeOptionMinimalLabel: 'Minimal',
    themeOptionShinyLabel: 'Glänzend',
    timePickerPlaceholder: 'Uhrzeit auswählen…',
    toolbarLabel: 'Aktionen',
    treeViewEmpty: 'Keine Baumeinträge',
    treeViewLoadError: 'Baumeinträge konnten nicht geladen werden',
}

const definitions: Readonly<Record<DemoLocale, DemoLocaleDefinition>> = {
    'en-GB': {
        locale: 'en-GB',
        autonym: 'English',
        copy: englishCopy,
        frayMessages: {},
    },
    'da-DK': {
        locale: 'da-DK',
        autonym: 'Dansk',
        copy: {
            documentTitle: 'Fray-lokaliseringsdemo',
            eyebrow: 'Mini-komponentgalleri',
            title: 'Fray-lokalisering',
            introduction: 'Skift sprog for at opdatere applikationstekst og Fray-etiketter sammen.',
            languageLabel: 'Sprog',
            runtimeNote: 'Hvert valg opretter en ny runtime med ét uforanderligt sprogøjebliksbillede.',
            controlsHeading: 'Inputfelter og kalender',
            assigneeLabel: 'Tildel til',
            assigneeOptions: [['design', 'Design'], ['engineering', 'Udvikling']],
            dateLabel: 'Måldato',
            timeLabel: 'Påmindelsestidspunkt',
            remindersLabel: 'Aktivér påmindelser',
            statesHeading: 'Frameworkets tomme tilstande',
            listHeading: 'Tom opgaveliste',
            tableCaption: 'Tom opgavetabel',
            tableNameColumn: 'Opgavenavn',
            dialogHeading: 'Dialog',
            dialogOpenLabel: 'Åbn dialog',
            dialogTitle: 'Lokaliseret dialog',
            dialogDescription: 'Titlen og teksten kommer fra applikationens katalog.',
            dialogBody: 'Luk-handlingen nedenfor er tekst, som Fray ejer og lokaliserer.',
            resolvedHeading: 'Frays anvendte tekster',
            resolvedIntroduction: 'Værdierne kommer fra det samme runtime-øjebliksbillede som kontrollerne.',
            dropdownMessageLabel: 'Pladsholder i rulleliste',
            timeMessageLabel: 'Pladsholder for tidspunkt',
            emptyMessageLabel: 'Tom tabeltilstand',
            closeMessageLabel: 'Dialogens luk-handling',
            sortMessageLabel: 'Genereret sorteringsetiket',
            calendarMessageLabel: 'Kalenderetiket',
        },
        frayMessages: danishMessages,
    },
    'de-DE': {
        locale: 'de-DE',
        autonym: 'Deutsch',
        copy: {
            documentTitle: 'Fray-Lokalisierungsdemo',
            eyebrow: 'Mini-Komponentengalerie',
            title: 'Fray-Lokalisierung',
            introduction: 'Wechseln Sie die Sprache, um Anwendungstexte und Fray-Beschriftungen gemeinsam zu aktualisieren.',
            languageLabel: 'Sprache',
            runtimeNote: 'Jede Auswahl erstellt eine neue Runtime mit einem unveränderlichen Sprach-Snapshot.',
            controlsHeading: 'Eingaben und Kalender',
            assigneeLabel: 'Zuweisen an',
            assigneeOptions: [['design', 'Design'], ['engineering', 'Entwicklung']],
            dateLabel: 'Zieldatum',
            timeLabel: 'Erinnerungszeit',
            remindersLabel: 'Erinnerungen aktivieren',
            statesHeading: 'Leere Framework-Zustände',
            listHeading: 'Leere Aufgabenliste',
            tableCaption: 'Leere Aufgabentabelle',
            tableNameColumn: 'Aufgabenname',
            dialogHeading: 'Dialog',
            dialogOpenLabel: 'Dialog öffnen',
            dialogTitle: 'Lokalisierter Dialog',
            dialogDescription: 'Titel und Inhalt stammen aus dem Anwendungskatalog.',
            dialogBody: 'Die Schließen-Aktion unten ist Text, den Fray besitzt und lokalisiert.',
            resolvedHeading: 'Aufgelöste Fray-Texte',
            resolvedIntroduction: 'Diese Werte stammen aus demselben Runtime-Snapshot wie die Steuerelemente.',
            dropdownMessageLabel: 'Dropdown-Platzhalter',
            timeMessageLabel: 'Zeit-Platzhalter',
            emptyMessageLabel: 'Leerer Tabellenzustand',
            closeMessageLabel: 'Dialog-Schließen-Aktion',
            sortMessageLabel: 'Generierte Sortierbeschriftung',
            calendarMessageLabel: 'Kalenderbeschriftung',
        },
        frayMessages: germanMessages,
    },
}

export function getDemoLocale(locale: DemoLocale): DemoLocaleDefinition {
    return definitions[locale]
}

/** Application-owned initial locale policy for the demo. */
export function chooseDemoLocale(language: string | undefined): DemoLocale {
    const normalized = language?.toLowerCase() ?? ''
    if (normalized === 'da' || normalized.startsWith('da-')) return 'da-DK'
    if (normalized === 'de' || normalized.startsWith('de-')) return 'de-DE'
    return 'en-GB'
}

export function languageOptions(): readonly (readonly [DemoLocale, string])[] {
    return demoLocaleIds.map((locale) => [locale, definitions[locale].autonym] as const)
}
