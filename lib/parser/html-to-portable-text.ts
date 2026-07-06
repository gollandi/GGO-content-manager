/**
 * Safe HTML → Portable Text converter
 * - Sanitizes links/whitelisted tags
 * - Maps <details>/<summary> to accordionBlock items
 * - Supports inline expansion blocks via <section class="inline-expand"> or <details class="inline-expand">
 * - Preserves inline marks (strong/em/code/links) and lists
 * - Returns warnings when structure is dropped or unsafe
 */
import { load } from 'cheerio'
import type { AnyNode, Element, Text } from 'domhandler'
type Node = AnyNode
import { v4 as uuidv4 } from 'uuid'
import { slugify } from './utils'
import { BRAND_COLOR_SWATCHES } from './brandColors'

type Decorator = 'strong' | 'em' | 'code'

interface PortableTextSpan {
  _type: 'span'
  _key: string
  text: string
  marks?: string[]
}

interface LinkMarkDef {
  _type: 'link'
  _key: string
  href: string
  newTab?: boolean
}

interface AnchorMarkDef {
  _type: 'anchor'
  _key: string
  anchorId: string
}

interface PortableTextBlock {
  _type: 'block'
  _key: string
  style: 'normal' | 'h1' | 'h2' | 'h3' | 'h4' | 'blockquote'
  children: PortableTextSpan[]
  markDefs: Array<LinkMarkDef | AnchorMarkDef>
  listItem?: 'bullet' | 'number'
  level?: number
}

interface AccordionBlock {
  _type: 'accordionBlock'
  _key: string
  accordionType: 'single' | 'multiple'
  collapsible: boolean
  tone?: 'clinical' | 'supportive' | 'accent' | 'alert'
  className?: string
  items: Array<{
    _key: string
    itemId?: string
    title: string
    content: Array<
      PortableTextBlock
      | AccordionBlock
      | DividerBlock
      | ButtonBlock
      | ButtonGroupBlock
      | QuestionnaireButtonBlock
      | DecisionAidBlock
      | CodeBlock
      | ImageUploadPlaceholder
      | InlineExpandBlock
      | CardBlock
      | LinkCardBlock
      | FeatureCardsBlock
      | FaqInlineBlock
      | QuizBlock
      | InfoBoxBlock
      | HighlightBlock
      | MythBustersBlock
      | CtaBannerBlock
      | VideoBlock
      | VideoResourceBlock
    >
  }>
}

interface InlineExpandBlock {
  _type: 'inlineExpandBlock'
  _key: string
  title: string
  summary?: string
  toggleLabel: string
  toggleLabelOpen?: string
  content: Array<
    PortableTextBlock
    | AccordionBlock
    | DividerBlock
    | ButtonBlock
    | ButtonGroupBlock
    | QuestionnaireButtonBlock
    | DecisionAidBlock
    | CodeBlock
    | ImageUploadPlaceholder
    | InlineExpandBlock
    | CardBlock
    | LinkCardBlock
    | FeatureCardsBlock
    | FaqInlineBlock
    | QuizBlock
    | InfoBoxBlock
    | HighlightBlock
    | MythBustersBlock
    | CtaBannerBlock
    | VideoBlock
    | VideoResourceBlock
  >
}

interface FaqInlineBlock {
  _type: 'faqInlineBlock'
  _key: string
  title?: string
  faqs: Array<{
    _key: string
    _type: 'reference'
    _ref: string
    _weak?: boolean
  }>
}

interface CardBlock {
  _type: 'cardBlock'
  _key: string
  tone?: 'clinical' | 'supportive' | 'accent' | 'alert'
  iconName?: string
  className?: string
  content: Array<
    PortableTextBlock
    | AccordionBlock
    | DividerBlock
    | ButtonBlock
    | ButtonGroupBlock
    | QuestionnaireButtonBlock
    | DecisionAidBlock
    | CodeBlock
    | ImageUploadPlaceholder
    | InlineExpandBlock
    | CardBlock
    | LinkCardBlock
    | FeatureCardsBlock
    | FaqInlineBlock
    | QuizBlock
    | InfoBoxBlock
    | HighlightBlock
    | MythBustersBlock
    | CtaBannerBlock
    | VideoBlock
    | VideoResourceBlock
  >
}

interface LinkCardBlock {
  _type: 'linkCardBlock'
  _key: string
  title: string
  description?: string
  href: string
  openInNewTab?: boolean
  intent?: 'clinical' | 'supportive' | 'accent' | 'alert'
  iconName?: string
  showArrow?: boolean
}

interface FeatureCardsBlock {
  _type: 'featureCardsBlock'
  _key: string
  eyebrow?: string
  title: string
  backgroundColorPreset?: string
  cards: Array<{
    _key: string
    title: string
    description?: PortableTextBlock[] | string
    iconName?: string
    iconImage?: ImageUploadPlaceholder
    href?: string
    openInNewTab?: boolean
    intent?: 'clinical' | 'supportive' | 'accent' | 'alert'
    showArrow?: boolean
  }>
}

interface DividerBlock {
  _type: 'dividerBlock'
  _key: string
}

interface ButtonBlock {
  _type: 'buttonBlock'
  _key: string
  content: string
  href: string
  variant?: string
  opensConsultationDialog?: boolean
  consultationUrl?: string
  consultationTitle?: string
  consultationDescription?: string
  iconColor?: string
  iconBgColor?: string
  iconName?: string
  className?: string
  newTab?: boolean
}

interface ButtonGroupBlock {
  _type: 'buttonGroupBlock'
  _key: string
  items: Array<{
    _key: string
    content: string
    href?: string
    opensConsultationDialog?: boolean
    consultationDialogType?: string
    consultationUrl?: string
    consultationTitle?: string
    consultationDescription?: string
    variant?: string
    iconColor?: string
    iconBgColor?: string
    iconName?: string
    newTab?: boolean
  }>
}

interface QuestionnaireButtonBlock {
  _type: 'questionnaireButtonBlock'
  _key: string
  questionnaire: {
    _type: 'reference'
    _ref: string
  }
  buttonText?: string
  variant?: string
  iconColor?: string
  iconBgColor?: string
}

interface DecisionAidBlock {
  _type: 'decisionAidBlock'
  _key: string
  internalTitle?: string
  aidKey: string
}

interface QuizBlock {
  _type: 'quizBlock'
  _key: string
  question: string
  description?: string
  options: Array<{
    _key: string
    label: string
    value: string
    isCorrect: boolean
  }>
  correctFeedback: string
  incorrectFeedback: string
  takeaway?: string
  learnMore?: {
    label: string
    href: string
    newTab: boolean
  }
}

interface CodeBlock {
  _type: 'codeBlock'
  _key: string
  content: string
  language?: string
}

interface InfoBoxBlock {
  _type: 'infoBoxBlock'
  _key: string
  backgroundColor?: 'gray' | 'blue' | 'white'
  content: PortableTextBlock[]
}

interface HighlightBlock {
  _type: 'highlightBlock'
  _key: string
  title?: string
  borderColor?: 'brand' | 'gray'
  content: PortableTextBlock[]
}

interface MythBustersBlock {
  _type: 'mythBustersBlock'
  _key: string
  internalTitle?: string
  pillLabel?: string
  title?: string
  description?: string
  layout?: 'grid' | 'accordion'
  theme?: 'mint' | 'indigo' | 'lavender'
  items: Array<{
    _key: string
    itemId?: string
    icon?: 'sparkles' | 'shield' | 'lightbulb' | 'target' | 'heartbeat'
    myth: string
    fact: string
    detail?: string
  }>
}

interface CtaBannerBlock {
  _type: 'ctaBannerBlock'
  _key: string
  title: string
  description?: string
  actionLabel: string
  actionType: 'link' | 'consultationDialog'
  actionVariant?: string
  actionHref?: string
  actionNewTab?: boolean
  actionAriaLabel?: string
  consultationDialogType?: string
  consultationUrl?: string
  consultationTitle?: string
  consultationDescription?: string
  backgroundColorPreset?: string
  textColor?: 'primary' | 'clinical' | 'forest' | 'charcoal' | 'warm-charcoal' | 'white'
}

interface VideoBlock {
  _type: 'videoBlock'
  _key: string
  url: string
  title?: string
  aspectRatio?: string
}

interface VideoResourceBlock {
  _type: 'videoResourceBlock'
  _key: string
  video: {
    _type: 'reference'
    _ref: string
  }
  title?: string
  aspectRatio?: string
}

interface ImageUploadPlaceholder {
  _type: '__imageUploadPlaceholder'
  _key: string
  url: string
  alt?: string
  target?: 'imageBlock' | 'imageField'
}

interface FaqDraft {
  id?: string
  question: string
  answer: string
  topics?: string[]
}

interface ConversionDrafts {
  faqEntries?: FaqDraft[]
}

export interface ParserWarning {
  code:
    | 'NESTING_EXCEEDED'
    | 'INVALID_COLOR'
    | 'MIN_ITEMS_NOT_MET'
    | 'UNSUPPORTED_TAG'
    | 'NODE_LIMIT_EXCEEDED'
  message: string
  severity: 'warning' | 'error'
  path?: string
}

type PortableTextNode =
  | PortableTextBlock
  | AccordionBlock
  | InlineExpandBlock
  | CardBlock
  | LinkCardBlock
  | FeatureCardsBlock
  | FaqInlineBlock
  | DividerBlock
  | ButtonBlock
  | ButtonGroupBlock
  | QuestionnaireButtonBlock
  | DecisionAidBlock
  | QuizBlock
  | CodeBlock
  | InfoBoxBlock
  | HighlightBlock
  | MythBustersBlock
  | CtaBannerBlock
  | VideoBlock
  | VideoResourceBlock
  | ImageUploadPlaceholder

interface ConvertOptions {
  /**
   * Default accordion behaviour when converting <details>
   */
  defaultAccordionType?: 'single' | 'multiple'
  collapsible?: boolean
}

interface ConversionResult {
  blocks: PortableTextNode[]
  warnings: string[]
  warningsV2?: ParserWarning[]
  drafts?: ConversionDrafts
}

interface ParserState {
  nodeCount: number
  warningsV2: ParserWarning[]
  currentPath: string
  warnedUnsupportedTags: Set<string>
}

interface InlineConversionState {
  markDefs: Array<LinkMarkDef | AnchorMarkDef>
  linkKeyCache: Map<string, string>
}

const DEFAULT_OPTIONS: Required<Pick<ConvertOptions, 'defaultAccordionType' | 'collapsible'>> = {
  defaultAccordionType: 'multiple',
  collapsible: true,
}

const BLOCK_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'ul',
  'ol',
  'li',
  'details',
  'summary',
  'section',
  'div',
  'main',
  'article',
  'hr',
  'button',
  'figure',
  'table',
  'pre',
  'iframe',
])

const MAX_TRAVERSAL_DEPTH = 3
const MAX_TRAVERSAL_NODES = 5000
const VALID_TONES = new Set(['clinical', 'supportive', 'accent', 'alert'])
const BRAND_PRESET_MAP = new Map(
  BRAND_COLOR_SWATCHES.map((swatch) => [swatch.value.toLowerCase(), swatch.value])
)

// Strict allowlist for blocks nested inside Accordion/Card content.
const ALLOWED_NESTED_BLOCKS = new Set([
  'block',
  'imageBlock',
  '__imageUploadPlaceholder',
  'buttonBlock',
  'buttonGroupBlock',
  'dividerBlock',
  'codeBlock',
  'videoBlock',
  'videoResourceBlock',
  'infoBoxBlock',
  'highlightBlock',
])

const INLINE_TAGS = new Set(['strong', 'b', 'em', 'i', 'code', 'a', 'span', 'br'])
const getClassList = (el: Element): string[] =>
  (el.attribs?.class || '')
    .split(/\s+/)
    .map((c: string) => c.trim().toLowerCase())
    .filter(Boolean)
const hasClass = (el: Element, className: string) => getClassList(el).includes(className.toLowerCase())
const isInlineExpandElement = (el: Element) =>
  hasClass(el, 'inline-expand') ||
  el.attribs?.['data-inline-expand'] === 'true' ||
  el.attribs?.['data-inline'] === 'true'
const getAttr = (el: Element, attr: string): string => (el.attribs?.[attr] || '').trim()
const getAttrLower = (el: Element, attr: string): string => getAttr(el, attr).toLowerCase()
const isLinkCardElement = (el: Element) => {
  const dataCard = getAttrLower(el, 'data-card') || getAttrLower(el, 'data-card-type')
  return (
    hasClass(el, 'link-card') ||
    hasClass(el, 'linked-card') ||
    hasClass(el, 'card-link') ||
    el.attribs?.['data-link-card'] === 'true' ||
    dataCard === 'link'
  )
}
const isSimpleCardElement = (el: Element) => {
  const dataCard = getAttrLower(el, 'data-card') || getAttrLower(el, 'data-card-type')
  return (
    hasClass(el, 'simple-card') ||
    hasClass(el, 'text-card') ||
    hasClass(el, 'card-simple') ||
    el.attribs?.['data-simple-card'] === 'true' ||
    dataCard === 'simple'
  )
}
const isSimpleCardsBlockElement = (el: Element) => {
  const dataBlock = getAttrLower(el, 'data-block')
  const dataGroup = getAttrLower(el, 'data-card-group')
  return (
    hasClass(el, 'simple-cards') ||
    hasClass(el, 'cards-block') ||
    hasClass(el, 'card-grid') ||
    hasClass(el, 'feature-cards') ||
    hasClass(el, 'featured-cards') ||
    dataBlock === 'feature-cards' ||
    dataBlock === 'featured-cards' ||
    dataGroup === 'simple'
  )
}

const isButtonGroupElement = (el: Element) => {
  const dataBlock = getAttrLower(el, 'data-block')
  return (
    hasClass(el, 'button-group') ||
    hasClass(el, 'button-row') ||
    hasClass(el, 'button-stack') ||
    hasClass(el, 'button-cluster') ||
    el.attribs?.['data-button-group'] === 'true' ||
    dataBlock === 'button-group'
  )
}

const isQuestionnaireButtonElement = (el: Element) =>
  hasClass(el, 'questionnaire-button') ||
  hasClass(el, 'quiz-button') ||
  Boolean(getAttr(el, 'data-questionnaire-id')) ||
  Boolean(getAttr(el, 'data-questionnaire-ref')) ||
  Boolean(getAttr(el, 'data-questionnaire')) ||
  Boolean(getAttr(el, 'data-questionnaire-slug')) ||
  Boolean(getAttr(el, 'data-questionnaire-slug-current'))

const isDecisionAidElement = (el: Element) =>
  hasClass(el, 'decision-aid') || el.attribs?.['data-block'] === 'decision-aid'

const isMythBustersElement = (el: Element) => {
  const dataBlock = getAttrLower(el, 'data-block')
  return (
    hasClass(el, 'myth-busters') ||
    hasClass(el, 'myth-buster') ||
    hasClass(el, 'myth-vs-fact') ||
    hasClass(el, 'myths') ||
    el.attribs?.['data-myth-busters'] === 'true' ||
    dataBlock === 'myth-busters'
  )
}

const isInfoBoxElement = (el: Element) => {
  const dataBlock = getAttrLower(el, 'data-block')
  return (
    hasClass(el, 'info-box') ||
    hasClass(el, 'info-box-block') ||
    hasClass(el, 'info-panel') ||
    el.attribs?.['data-info-box'] === 'true' ||
    dataBlock === 'info-box'
  )
}

const isHighlightElement = (el: Element) => {
  const dataBlock = getAttrLower(el, 'data-block')
  return (
    hasClass(el, 'highlight') ||
    hasClass(el, 'highlight-block') ||
    hasClass(el, 'callout') ||
    el.attribs?.['data-highlight'] === 'true' ||
    dataBlock === 'highlight'
  )
}

const isCtaBannerElement = (el: Element) => {
  const dataBlock = getAttrLower(el, 'data-block')
  return (
    hasClass(el, 'cta-banner') ||
    hasClass(el, 'cta-block') ||
    hasClass(el, 'call-to-action') ||
    el.attribs?.['data-cta-banner'] === 'true' ||
    dataBlock === 'cta-banner'
  )
}

const isVideoEmbedElement = (el: Element) => {
  const dataBlock = getAttrLower(el, 'data-block')
  return (
    hasClass(el, 'video-embed') ||
    hasClass(el, 'video-block') ||
    hasClass(el, 'video') ||
    el.attribs?.['data-video'] === 'true' ||
    Boolean(getAttr(el, 'data-video-url')) ||
    dataBlock === 'video'
  )
}

const isVideoResourceElement = (el: Element) => {
  const dataBlock = getAttrLower(el, 'data-block')
  return (
    hasClass(el, 'video-resource') ||
    hasClass(el, 'video-resource-block') ||
    el.attribs?.['data-video-resource'] === 'true' ||
    Boolean(getAttr(el, 'data-video-id')) ||
    Boolean(getAttr(el, 'data-video-ref')) ||
    Boolean(getAttr(el, 'data-video-slug')) ||
    Boolean(getAttr(el, 'data-video-resource-slug')) ||
    dataBlock === 'video-resource'
  )
}

const extractLanguageFromClass = (value?: string): string | undefined => {
  if (!value) return undefined
  const parts = value.split(/\s+/)
  for (const part of parts) {
    const normalized = part.trim().toLowerCase()
    if (normalized.startsWith('language-')) {
      return normalized.replace('language-', '')
    }
    if (normalized.startsWith('lang-')) {
      return normalized.replace('lang-', '')
    }
  }
  return undefined
}

const isButtonLikeElement = (el: Element) => {
  const tag = el.tagName.toLowerCase()
  if (tag === 'button') return true
  if (tag !== 'a') return false
  return (
    el.attribs?.role === 'button' ||
    /\bbtn\b/i.test(el.attribs?.class || '') ||
    /\bbutton\b/i.test(el.attribs?.class || '')
  )
}

const VIDEO_ASPECT_RATIOS = new Set(['16/9', '4/3', '1/1', '21/9'])
const MYTH_LAYOUTS = new Set(['grid', 'accordion'])
const MYTH_THEMES = new Set(['mint', 'indigo', 'lavender'])
const INFO_BOX_COLORS = new Set(['gray', 'blue', 'white'])
const HIGHLIGHT_COLORS = new Set(['brand', 'gray'])
const CTA_TEXT_COLORS = new Set(['primary', 'clinical', 'forest', 'charcoal', 'warm-charcoal', 'white'])

const parseBooleanAttr = (value: string): boolean | undefined => {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  if (['true', '1', 'yes'].includes(normalized)) return true
  if (['false', '0', 'no'].includes(normalized)) return false
  return undefined
}

const normalizeAspectRatio = (value?: string | null): string | undefined => {
  if (!value) return undefined
  const trimmed = value.trim()
  return VIDEO_ASPECT_RATIOS.has(trimmed) ? trimmed : undefined
}

const parseTopics = (value?: string | null): string[] | undefined => {
  if (!value) return undefined
  const topics = value
    .split(/[,\|;]/)
    .map((topic) => topic.trim())
    .filter(Boolean)
  if (!topics.length) return undefined
  return Array.from(new Set(topics))
}

const mergeTopics = (base?: string[], extra?: string[]): string[] | undefined => {
  const merged = [...(base || []), ...(extra || [])].filter(Boolean)
  if (!merged.length) return undefined
  return Array.from(new Set(merged))
}

const extractTopics = (el: Element): string[] | undefined =>
  parseTopics(
    getAttr(el, 'data-topics') ||
      getAttr(el, 'data-tags') ||
      getAttr(el, 'data-topic') ||
      getAttr(el, 'data-category')
  )

const BUTTON_VARIANTS = new Set([
  'default',
  'secondary',
  'destructive',
  'outline',
  'ghost',
  'link',
])

const resolveButtonVariant = (el: Element): string | undefined => {
  const variant =
    getAttrLower(el, 'data-variant') || getAttrLower(el, 'data-style')
  return BUTTON_VARIANTS.has(variant) ? variant : undefined
}

const resolveButtonType = (el: Element): 'link' | 'dialog' => {
  const explicitType =
    getAttrLower(el, 'data-button-type') || getAttrLower(el, 'data-action')
  if (explicitType === 'link') return 'link'
  if (
    explicitType === 'dialog' ||
    explicitType === 'consultation' ||
    explicitType === 'iframe'
  ) {
    return 'dialog'
  }

  const dialogFlag =
    parseBooleanAttr(getAttr(el, 'data-dialog')) === true ||
    parseBooleanAttr(getAttr(el, 'data-consultation')) === true ||
    Boolean(getAttr(el, 'data-consultation-url')) ||
    Boolean(getAttr(el, 'data-dialog-url')) ||
    Boolean(getAttr(el, 'data-iframe'))

  return dialogFlag ? 'dialog' : 'link'
}

const buildButtonBlock = (
  el: Element,
  label: string,
  warnings: string[]
): ButtonBlock => {
  const buttonType = resolveButtonType(el)
  const hrefAttr =
    el.attribs?.href ||
    el.attribs?.['data-href'] ||
    el.attribs?.['data-url'] ||
    el.attribs?.['data-link']
  const href = safeUrl(hrefAttr) || ''
  const newTab =
    el.attribs?.target === '_blank' ||
    parseBooleanAttr(getAttr(el, 'data-new-tab')) === true
  const variant = resolveButtonVariant(el) || 'outline'
  const iconColor = getAttr(el, 'data-icon-color') || undefined
  const iconBgColor =
    getAttr(el, 'data-icon-bg') ||
    getAttr(el, 'data-icon-bg-color') ||
    undefined
  const iconName = getAttr(el, 'data-icon-name') || undefined
  const className =
    getAttr(el, 'data-class') ||
    getAttr(el, 'data-class-name') ||
    undefined
  const consultationUrl =
    safeUrl(
      getAttr(el, 'data-consultation-url') ||
        getAttr(el, 'data-dialog-url') ||
        getAttr(el, 'data-iframe')
    ) || undefined
  const consultationTitle =
    getAttr(el, 'data-dialog-title') ||
    getAttr(el, 'data-consultation-title') ||
    undefined
  const consultationDescription =
    getAttr(el, 'data-dialog-description') ||
    getAttr(el, 'data-consultation-description') ||
    undefined

  if (buttonType === 'link' && !href) {
    warnings.push(`Button "${label}" without href; set href in Studio`)
  }

  return {
    _type: 'buttonBlock',
    _key: uuidv4(),
    content: label,
    href: buttonType === 'dialog' ? '' : href,
    variant,
    iconColor,
    iconBgColor,
    iconName,
    className,
    newTab: newTab || undefined,
    opensConsultationDialog: buttonType === 'dialog',
    consultationUrl,
    consultationTitle,
    consultationDescription,
  }
}

const buildButtonGroupItem = (
  el: Element,
  label: string,
  warnings: string[]
): ButtonGroupBlock['items'][number] => {
  const buttonType = resolveButtonType(el)
  const hrefAttr =
    el.attribs?.href ||
    el.attribs?.['data-href'] ||
    el.attribs?.['data-url'] ||
    el.attribs?.['data-link']
  const href = safeUrl(hrefAttr) || undefined
  const newTab =
    el.attribs?.target === '_blank' ||
    parseBooleanAttr(getAttr(el, 'data-new-tab')) === true
  const variant = resolveButtonVariant(el) || 'outline'
  const iconColor = getAttr(el, 'data-icon-color') || undefined
  const iconBgColor =
    getAttr(el, 'data-icon-bg') ||
    getAttr(el, 'data-icon-bg-color') ||
    undefined
  const iconName = getAttr(el, 'data-icon-name') || undefined
  const consultationUrl =
    safeUrl(
      getAttr(el, 'data-consultation-url') ||
        getAttr(el, 'data-dialog-url') ||
        getAttr(el, 'data-iframe')
    ) || undefined
  const consultationTitle =
    getAttr(el, 'data-dialog-title') ||
    getAttr(el, 'data-consultation-title') ||
    undefined
  const consultationDescription =
    getAttr(el, 'data-dialog-description') ||
    getAttr(el, 'data-consultation-description') ||
    undefined
  const consultationDialogType =
    getAttrLower(el, 'data-consultation-type') ||
    getAttrLower(el, 'data-dialog-type') ||
    getAttrLower(el, 'data-consultation-dialog-type') ||
    undefined

  if (buttonType === 'link' && !href) {
    warnings.push(`Button group item "${label}" without href`)
  }

  return {
    _key: uuidv4(),
    content: label,
    href: buttonType === 'dialog' ? undefined : href,
    variant,
    iconColor,
    iconBgColor,
    iconName,
    newTab: newTab || undefined,
    opensConsultationDialog: buttonType === 'dialog',
    consultationDialogType,
    consultationUrl,
    consultationTitle,
    consultationDescription,
  }
}

const buildQuestionnaireButtonBlock = (
  el: Element,
  warnings: string[]
): QuestionnaireButtonBlock | null => {
  const questionnaireId =
    getAttr(el, 'data-questionnaire-id') ||
    getAttr(el, 'data-questionnaire-ref') ||
    getAttr(el, 'data-questionnaire')
  const questionnaireSlug =
    getAttr(el, 'data-questionnaire-slug') || getAttr(el, 'data-questionnaire-slug-current')

  const questionnaireRef =
    questionnaireId ||
    (questionnaireSlug ? `slug:questionnaire:${questionnaireSlug}` : '')

  if (!questionnaireRef) {
    warnings.push('Questionnaire button missing data-questionnaire-id')
    return null
  }

  const labelAttr = getAttr(el, 'data-button-text') || getAttr(el, 'data-label')
  const label =
    labelAttr || normalizeText(extractText(getChildren(el))).trim() || 'Start Questionnaire'
  const variant = resolveButtonVariant(el) || 'outline'
  const iconColor = getAttr(el, 'data-icon-color') || undefined
  const iconBgColor =
    getAttr(el, 'data-icon-bg') ||
    getAttr(el, 'data-icon-bg-color') ||
    undefined

  return {
    _type: 'questionnaireButtonBlock',
    _key: uuidv4(),
    questionnaire: {
      _type: 'reference',
      _ref: questionnaireRef,
    },
    buttonText: label,
    variant,
    iconColor,
    iconBgColor,
  }
}

const safeUrl = (href?: string | null): string | null => {
  if (!href) return null
  const trimmed = href.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('#')) return trimmed
  if (trimmed.startsWith('/')) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^mailto:/i.test(trimmed)) return trimmed
  if (/^tel:/i.test(trimmed)) return trimmed

  return null
}

const normalizeText = (text: string): string => text.replace(/\s+/g, ' ')

const isTextNode = (node: Node): node is Text => node.type === 'text'
const isElementNode = (node: Node): node is Element => node.type === 'tag'
const getChildren = (node: Node): Node[] => {
  const children = (node as any).children
  return Array.isArray(children) ? children : []
}
const extractText = (nodes: Node[]): string =>
  nodes
    .map((node) => {
      if (isTextNode(node)) return node.data || ''
      if (isElementNode(node)) return extractText(getChildren(node))
      return ''
    })
    .join('')

const hasMeaningfulText = (spans: PortableTextSpan[]): boolean =>
  spans.some((span) => span.text.trim().length > 0)

const extractNodeText = (node?: Element): string =>
  node ? normalizeText(extractText(getChildren(node))).trim() : ''

const isHeadingTag = (node: Element) =>
  ['h1', 'h2', 'h3', 'h4'].includes(node.tagName.toLowerCase())

const findFirstDescendant = (
  node: Element,
  predicate: (el: Element) => boolean
): Element | undefined => {
  const children = getChildren(node)
  for (const child of children) {
    if (!isElementNode(child)) continue
    if (predicate(child)) return child
    const nested = findFirstDescendant(child, predicate)
    if (nested) return nested
  }
  return undefined
}

const findDescendants = (
  node: Element,
  predicate: (el: Element) => boolean,
  results: Element[] = []
): Element[] => {
  const children = getChildren(node)
  for (const child of children) {
    if (!isElementNode(child)) continue
    if (predicate(child)) results.push(child)
    findDescendants(child, predicate, results)
  }
  return results
}

const findFirstDescendantExcluding = (
  node: Element,
  predicate: (el: Element) => boolean,
  shouldSkip: (el: Element) => boolean
): Element | undefined => {
  const children = getChildren(node)
  for (const child of children) {
    if (!isElementNode(child)) continue
    if (shouldSkip(child)) continue
    if (predicate(child)) return child
    const nested = findFirstDescendantExcluding(child, predicate, shouldSkip)
    if (nested) return nested
  }
  return undefined
}

const collectCardElements = (container: Element): Element[] => {
  const children = getChildren(container)
  const directCards = children.filter(
    (node): node is Element =>
      isElementNode(node) &&
      (isSimpleCardElement(node) ||
        isLinkCardElement(node) ||
        hasClass(node, 'feature-card') ||
        hasClass(node, 'featured-card') ||
        hasClass(node, 'card-item'))
  )
  if (directCards.length) return directCards

  const nestedCards: Element[] = []
  children.forEach((node) => {
    if (!isElementNode(node)) return
    const stack = [node]
    while (stack.length) {
      const current = stack.shift()
      if (!current) continue
      if (
        isSimpleCardElement(current) ||
        isLinkCardElement(current) ||
        hasClass(current, 'feature-card') ||
        hasClass(current, 'featured-card') ||
        hasClass(current, 'card-item')
      ) {
        nestedCards.push(current)
        continue
      }
      const grandChildren = getChildren(current)
      grandChildren.forEach((child) => {
        if (isElementNode(child)) stack.push(child)
      })
    }
  })

  return nestedCards
}

const filterContentBlocks = (
  blocks: PortableTextNode[]
): Array<
  | PortableTextBlock
  | AccordionBlock
  | DividerBlock
  | ButtonBlock
  | ButtonGroupBlock
  | QuestionnaireButtonBlock
  | DecisionAidBlock
  | CodeBlock
  | ImageUploadPlaceholder
  | InlineExpandBlock
  | CardBlock
  | LinkCardBlock
  | FeatureCardsBlock
  | FaqInlineBlock
  | QuizBlock
  | InfoBoxBlock
  | HighlightBlock
  | MythBustersBlock
  | CtaBannerBlock
  | VideoBlock
  | VideoResourceBlock
> =>
  blocks.filter(
    (
      block
    ): block is
      | PortableTextBlock
      | AccordionBlock
      | DividerBlock
      | ButtonBlock
      | ButtonGroupBlock
      | QuestionnaireButtonBlock
      | DecisionAidBlock
      | CodeBlock
      | ImageUploadPlaceholder
      | InlineExpandBlock
      | CardBlock
      | LinkCardBlock
      | FeatureCardsBlock
      | FaqInlineBlock
      | QuizBlock
      | InfoBoxBlock
      | HighlightBlock
      | MythBustersBlock
      | CtaBannerBlock
      | VideoBlock
      | VideoResourceBlock =>
      (block as PortableTextBlock)._type === 'block' ||
      (block as AccordionBlock)._type === 'accordionBlock' ||
      (block as InlineExpandBlock)._type === 'inlineExpandBlock' ||
      (block as CardBlock)._type === 'cardBlock' ||
      (block as LinkCardBlock)._type === 'linkCardBlock' ||
      (block as FeatureCardsBlock)._type === 'featureCardsBlock' ||
      (block as FaqInlineBlock)._type === 'faqInlineBlock' ||
      (block as QuizBlock)._type === 'quizBlock' ||
      (block as DividerBlock)._type === 'dividerBlock' ||
      (block as ButtonBlock)._type === 'buttonBlock' ||
      (block as ButtonGroupBlock)._type === 'buttonGroupBlock' ||
      (block as QuestionnaireButtonBlock)._type === 'questionnaireButtonBlock' ||
      (block as DecisionAidBlock)._type === 'decisionAidBlock' ||
      (block as CodeBlock)._type === 'codeBlock' ||
      (block as InfoBoxBlock)._type === 'infoBoxBlock' ||
      (block as HighlightBlock)._type === 'highlightBlock' ||
      (block as MythBustersBlock)._type === 'mythBustersBlock' ||
      (block as CtaBannerBlock)._type === 'ctaBannerBlock' ||
      (block as VideoBlock)._type === 'videoBlock' ||
      (block as VideoResourceBlock)._type === 'videoResourceBlock' ||
      (block as ImageUploadPlaceholder)._type === '__imageUploadPlaceholder'
  )

function filterNestedContent(
  blocks: PortableTextNode[],
  warnings: string[],
  warningsV2: ParserWarning[],
  path: string
): PortableTextNode[] {
  return blocks.filter((block) => {
    const type = (block as { _type?: string })._type
    if (!type || !ALLOWED_NESTED_BLOCKS.has(type)) {
      const msg = `Dropped invalid nested block: ${type || 'unknown'}`
      warnings.push(msg)
      warningsV2.push({
        code: 'NESTING_EXCEEDED',
        message: msg,
        severity: 'error',
        path,
      })
      return false
    }
    return true
  })
}

const withParserPath = <T>(state: ParserState, path: string, fn: () => T): T => {
  const previousPath = state.currentPath
  state.currentPath = path
  try {
    return fn()
  } finally {
    state.currentPath = previousPath
  }
}

const pushParserWarning = (
  warnings: string[],
  state: ParserState,
  warning: ParserWarning
) => {
  warnings.push(warning.message)
  state.warningsV2.push(warning)
}

const resolveBrandPreset = (
  rawPreset: string,
  warnings: string[],
  state: ParserState,
  context: 'CTA banner' | 'feature cards block'
) => {
  const normalized = rawPreset.trim()
  if (!normalized) return undefined

  const preset = BRAND_PRESET_MAP.get(normalized.toLowerCase())
  if (preset) return preset

  pushParserWarning(warnings, state, {
    code: 'INVALID_COLOR',
    message: `${context}: invalid background preset "${normalized}" dropped`,
    severity: 'warning',
    path: state.currentPath,
  })
  return undefined
}

/**
 * Convert inline nodes (text + inline tags) to spans + markDefs
 */
function convertInlineNodes(
  nodes: Node[],
  warnings: string[]
): { spans: PortableTextSpan[]; markDefs: Array<LinkMarkDef | AnchorMarkDef> } {
  const markDefs: Array<LinkMarkDef | AnchorMarkDef> = []
  const linkKeyCache = new Map<string, string>()

  const walk = (
    node: Node,
    activeMarks: Array<Decorator | string>,
    accumulator: PortableTextSpan[]
  ) => {
    if (isTextNode(node)) {
      const text = normalizeText(node.data || '')
      if (text.length === 0) return
      accumulator.push({
        _type: 'span',
        _key: uuidv4(),
        text,
        marks: activeMarks.length ? [...activeMarks] : undefined,
      })
      return
    }

    if (!isElementNode(node)) return

    const tag = node.tagName.toLowerCase()
    const childNodes = getChildren(node)

    const recurseChildren = (marks: Array<Decorator | string>) => {
      childNodes.forEach((child) => walk(child, marks, accumulator))
    }

    if (tag === 'strong' || tag === 'b') {
      recurseChildren([...activeMarks, 'strong'])
      return
    }

    if (tag === 'em' || tag === 'i') {
      recurseChildren([...activeMarks, 'em'])
      return
    }

    if (tag === 'code') {
      recurseChildren([...activeMarks, 'code'])
      return
    }

    if (tag === 'br') {
      accumulator.push({
        _type: 'span',
        _key: uuidv4(),
        text: '\n',
        marks: activeMarks.length ? [...activeMarks] : undefined,
      })
      return
    }

    if (tag === 'a') {
      const href = safeUrl(node.attribs?.href)
      const newTab = node.attribs?.target === '_blank'

      if (!href) {
        warnings.push('Dropped unsafe or empty href on <a> tag')
        recurseChildren(activeMarks)
        return
      }

      const cacheKey = `${href}::${newTab ? '1' : '0'}`
      const linkKey = linkKeyCache.get(cacheKey) || uuidv4()

      if (!linkKeyCache.has(cacheKey)) {
        linkKeyCache.set(cacheKey, linkKey)
        markDefs.push({
          _type: 'link',
          _key: linkKey,
          href,
          newTab,
        })
      }

      recurseChildren([...activeMarks, linkKey])
      return
    }

    // Unknown inline element: traverse children but do not keep the tag
    recurseChildren(activeMarks)
  }

  const spans: PortableTextSpan[] = []
  nodes.forEach((node) => walk(node, [], spans))

  return { spans, markDefs }
}

/**
 * Convert a single element node into portable text nodes
 */
function convertElement(
  el: Element,
  opts: Required<Pick<ConvertOptions, 'defaultAccordionType' | 'collapsible'>>,
  warnings: string[],
  listLevel: number,
  drafts?: ConversionDrafts,
  depth = 0,
  state: ParserState = { nodeCount: 0, warningsV2: [], currentPath: 'root', warnedUnsupportedTags: new Set() }
): PortableTextNode[] {
  const tag = el.tagName.toLowerCase()
  const children = getChildren(el)
  const createBlock = (
    style: PortableTextBlock['style'],
    inlineNodes: Node[],
    extra?: Partial<PortableTextBlock>
  ): PortableTextBlock | null => {
    const inline = convertInlineNodes(inlineNodes, warnings)
    const childrenSpans: PortableTextSpan[] = inline.spans.length
      ? inline.spans
      : [
          {
            _type: 'span',
            _key: uuidv4(),
            text: '',
          },
        ]

    if (!hasMeaningfulText(childrenSpans) && style !== 'blockquote') {
      return null
    }

    return {
      _type: 'block',
      _key: uuidv4(),
      style,
      children: childrenSpans,
      markDefs: inline.markDefs,
      ...extra,
    }
  }

  if (tag === 'p') {
    const block = createBlock('normal', children)
    return block ? [block] : []
  }

  if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
    const block = createBlock(tag as PortableTextBlock['style'], children)
    return block ? [block] : []
  }

  if (tag === 'blockquote') {
    const block = createBlock('blockquote', children)
    return block ? [block] : []
  }

  if (tag === 'hr') {
    return [
      {
        _type: 'dividerBlock',
        _key: uuidv4(),
      },
    ]
  }

  if (tag === 'pre') {
    const codeEl = children.find(
      (node): node is Element =>
        isElementNode(node) && node.tagName.toLowerCase() === 'code'
    )
    const codeTextRaw = extractText(codeEl ? getChildren(codeEl) : children)
    const codeText = codeTextRaw.replace(/^\n+/, '').replace(/\n+$/, '')
    const language =
      getAttr(codeEl || el, 'data-language') ||
      getAttr(codeEl || el, 'data-lang') ||
      extractLanguageFromClass(codeEl?.attribs?.class || el.attribs?.class)

    if (!codeText.trim()) {
      warnings.push('Empty code block')
      return []
    }

    return [
      {
        _type: 'codeBlock',
        _key: uuidv4(),
        content: codeText,
        language: language || undefined,
      },
    ]
  }

  if (tag === 'iframe') {
    const src = safeUrl(el.attribs?.src)
    if (!src) {
      warnings.push('Video iframe missing safe src')
      return []
    }
    if (!/youtube\.com|youtu\.be/.test(src)) {
      warnings.push(`Video embed is not a YouTube URL: ${src}`)
    }
    const title = getAttr(el, 'title') || getAttr(el, 'data-title')
    const aspectRatio =
      normalizeAspectRatio(getAttr(el, 'data-aspect-ratio') || getAttr(el, 'data-ratio'))

    return [
      {
        _type: 'videoBlock',
        _key: uuidv4(),
        url: src,
        title: title || undefined,
        aspectRatio,
      },
    ]
  }

  if ((tag === 'section' || tag === 'div') && isDecisionAidElement(el)) {
    const aidKey = getAttr(el, 'data-aid-key') || getAttr(el, 'data-decision-aid')
    if (!aidKey) {
      const msg = 'Decision Aid missing data-aid-key'
      pushParserWarning(warnings, state, {
        code: 'UNSUPPORTED_TAG',
        message: msg,
        severity: 'error',
        path: state.currentPath,
      })
      return []
    }
    return [
      {
        _type: 'decisionAidBlock',
        _key: uuidv4(),
        internalTitle: getAttr(el, 'data-title') || undefined,
        aidKey,
      },
    ]
  }

  if ((tag === 'section' || tag === 'div') && isCtaBannerElement(el)) {
    const titleAttr = getAttr(el, 'data-title')
    const descriptionAttr = getAttr(el, 'data-description')
    const actionLabelAttr =
      getAttr(el, 'data-action-label') || getAttr(el, 'data-button-label')
    const actionTypeAttr =
      getAttrLower(el, 'data-action-type') || getAttrLower(el, 'data-button-type')
    const actionVariantAttr = getAttrLower(el, 'data-action-variant')
    const actionHrefAttr =
      getAttr(el, 'data-action-href') || getAttr(el, 'data-href')
    const actionNewTabAttr = parseBooleanAttr(getAttr(el, 'data-action-new-tab'))
    const actionAriaLabelAttr = getAttr(el, 'data-action-aria-label')
    const rawBackgroundColorPreset =
      getAttr(el, 'data-background-preset') || getAttr(el, 'data-bg-preset')
    const backgroundColorPreset = rawBackgroundColorPreset
      ? resolveBrandPreset(rawBackgroundColorPreset, warnings, state, 'CTA banner')
      : undefined
    const textColorAttr = getAttrLower(el, 'data-text-color')

    const isActionEl = (node: Element) => isButtonLikeElement(node)
    const titleEl = findFirstDescendantExcluding(el, (node) => isHeadingTag(node), isActionEl)
    const descriptionEl = findFirstDescendantExcluding(
      el,
      (node) => node.tagName.toLowerCase() === 'p',
      isActionEl
    )
    const actionEl = findFirstDescendant(el, isActionEl)

    const title = titleAttr || extractNodeText(titleEl)
    const description = descriptionAttr || extractNodeText(descriptionEl)
    const actionLabel = actionLabelAttr || (actionEl ? extractNodeText(actionEl) : '')

    const actionTypeRaw =
      actionTypeAttr ||
      getAttrLower(actionEl || el, 'data-action') ||
      getAttrLower(actionEl || el, 'data-button-type')
    const actionType =
      actionTypeRaw === 'consultationdialog' ||
      actionTypeRaw === 'dialog' ||
      actionTypeRaw === 'consultation' ||
      actionTypeRaw === 'iframe' ||
      (actionEl ? resolveButtonType(actionEl) === 'dialog' : false)
        ? 'consultationDialog'
        : 'link'

    const actionHrefCandidate =
      actionHrefAttr ||
      (actionEl?.attribs?.href ||
        actionEl?.attribs?.['data-href'] ||
        actionEl?.attribs?.['data-url'] ||
        actionEl?.attribs?.['data-link'])
    const actionHref = safeUrl(actionHrefCandidate) || undefined
    const actionNewTab =
      actionNewTabAttr ??
      (actionEl?.attribs?.target === '_blank' ||
        parseBooleanAttr(getAttr(actionEl || el, 'data-new-tab')) === true)

    const actionVariant =
      (actionVariantAttr && BUTTON_VARIANTS.has(actionVariantAttr) ? actionVariantAttr : undefined) ||
      (actionEl ? resolveButtonVariant(actionEl) : undefined)
    const actionAriaLabel = actionAriaLabelAttr || actionEl?.attribs?.['aria-label']

    const consultationDialogType =
      getAttrLower(el, 'data-consultation-dialog-type') ||
      getAttrLower(el, 'data-dialog-type') ||
      getAttrLower(el, 'data-consultation-type') ||
      getAttrLower(actionEl || el, 'data-consultation-dialog-type') ||
      getAttrLower(actionEl || el, 'data-consultation-type') ||
      undefined
    const consultationUrl =
      safeUrl(
        getAttr(el, 'data-consultation-url') ||
          getAttr(el, 'data-dialog-url') ||
          getAttr(actionEl || el, 'data-consultation-url') ||
          getAttr(actionEl || el, 'data-dialog-url')
      ) || undefined
    const consultationTitle =
      getAttr(el, 'data-consultation-title') ||
      getAttr(el, 'data-dialog-title') ||
      getAttr(actionEl || el, 'data-consultation-title') ||
      getAttr(actionEl || el, 'data-dialog-title') ||
      undefined
    const consultationDescription =
      getAttr(el, 'data-consultation-description') ||
      getAttr(el, 'data-dialog-description') ||
      getAttr(actionEl || el, 'data-consultation-description') ||
      getAttr(actionEl || el, 'data-dialog-description') ||
      undefined

    if (!title || !actionLabel || (actionType === 'link' && !actionHref)) {
      warnings.push('CTA banner missing required fields (title/button/href)')
      return []
    }

    const block: CtaBannerBlock = {
      _type: 'ctaBannerBlock',
      _key: uuidv4(),
      title,
      actionLabel,
      actionType,
    }

    if (description) block.description = description
    if (actionVariant) block.actionVariant = actionVariant
    if (actionType === 'link') {
      block.actionHref = actionHref
      if (actionNewTab) block.actionNewTab = true
    }
    if (actionAriaLabel) block.actionAriaLabel = actionAriaLabel
    if (actionType === 'consultationDialog') {
      if (consultationDialogType) block.consultationDialogType = consultationDialogType
      if (consultationUrl) block.consultationUrl = consultationUrl
      if (consultationTitle) block.consultationTitle = consultationTitle
      if (consultationDescription) block.consultationDescription = consultationDescription
    }
    if (backgroundColorPreset) block.backgroundColorPreset = backgroundColorPreset
    if (textColorAttr && CTA_TEXT_COLORS.has(textColorAttr)) {
      block.textColor = textColorAttr as CtaBannerBlock['textColor']
    }

    return [block]
  }

  if ((tag === 'section' || tag === 'div') && isMythBustersElement(el)) {
    const internalTitle = getAttr(el, 'data-internal-title') || undefined
    const pillLabel =
      getAttr(el, 'data-pill-label') || getAttr(el, 'data-pill') || getAttr(el, 'data-eyebrow') || undefined
    const titleAttr = getAttr(el, 'data-title')
    const descriptionAttr = getAttr(el, 'data-description')
    const layoutAttr = getAttrLower(el, 'data-layout')
    const themeAttr = getAttrLower(el, 'data-theme')

    const isItemEl = (node: Element) =>
      hasClass(node, 'myth-item') ||
      hasClass(node, 'myth-buster-item') ||
      node.tagName.toLowerCase() === 'details'
    const titleEl = findFirstDescendantExcluding(el, (node) => isHeadingTag(node), isItemEl)
    const descriptionEl = findFirstDescendantExcluding(
      el,
      (node) => node.tagName.toLowerCase() === 'p',
      isItemEl
    )

    const title = titleAttr || extractNodeText(titleEl)
    const description = descriptionAttr || extractNodeText(descriptionEl)
    const layout = MYTH_LAYOUTS.has(layoutAttr) ? (layoutAttr as MythBustersBlock['layout']) : undefined
    const theme = MYTH_THEMES.has(themeAttr) ? (themeAttr as MythBustersBlock['theme']) : undefined

    const directItems = getChildren(el).filter(
      (node): node is Element => isElementNode(node) && isItemEl(node)
    )
    const itemElements =
      directItems.length > 0 ? directItems : findDescendants(el, (node) => isItemEl(node))

    const items: MythBustersBlock['items'] = []

    itemElements.forEach((item, idx) => {
      const itemTag = item.tagName.toLowerCase()
      const itemId = getAttr(item, 'data-item-id') || getAttr(item, 'data-id') || undefined
      const iconAttr =
        getAttrLower(item, 'data-icon') || getAttrLower(item, 'data-icon-name') || undefined
      const icon =
        iconAttr && ['sparkles', 'shield', 'lightbulb', 'target', 'heartbeat'].includes(iconAttr)
          ? (iconAttr as MythBustersBlock['items'][number]['icon'])
          : undefined

      let myth = ''
      let fact = ''
      let detail = ''

      if (itemTag === 'details') {
        const summaryNode = getChildren(item).find(
          (n): n is Element =>
            isElementNode(n) && n.tagName.toLowerCase() === 'summary'
        )
        myth = summaryNode ? extractNodeText(summaryNode) : ''

        const contentNodes = summaryNode
          ? getChildren(item).filter((child) => child !== summaryNode)
          : getChildren(item)
        const factEl = findFirstDescendant(item, (node) => hasClass(node, 'fact') || hasClass(node, 'fact-title'))
        if (factEl) {
          fact = extractNodeText(factEl)
          const detailEl = findFirstDescendant(item, (node) => hasClass(node, 'detail') || hasClass(node, 'myth-detail'))
          detail = detailEl ? extractNodeText(detailEl) : ''
        } else {
          const paragraphs = contentNodes.filter(
            (n): n is Element => isElementNode(n) && n.tagName.toLowerCase() === 'p'
          )
          if (paragraphs.length > 0) {
            fact = extractNodeText(paragraphs[0])
            detail = paragraphs.slice(1).map((p) => extractNodeText(p)).join(' ').trim()
          } else {
            fact = normalizeText(extractText(contentNodes)).trim()
          }
        }
      } else {
        const mythAttr = getAttr(item, 'data-myth')
        const factAttr = getAttr(item, 'data-fact')
        const detailAttr = getAttr(item, 'data-detail')
        const mythEl = findFirstDescendant(item, (node) =>
          hasClass(node, 'myth') ||
          hasClass(node, 'myth-title') ||
          hasClass(node, 'myth-statement') ||
          isHeadingTag(node)
        )
        const factEl = findFirstDescendant(item, (node) =>
          hasClass(node, 'fact') || hasClass(node, 'fact-title')
        )
        const detailEl = findFirstDescendant(item, (node) =>
          hasClass(node, 'detail') || hasClass(node, 'myth-detail')
        )
        const firstParagraph = findFirstDescendant(item, (node) => node.tagName.toLowerCase() === 'p')

        myth = mythAttr || extractNodeText(mythEl)
        fact = factAttr || extractNodeText(factEl) || extractNodeText(firstParagraph)
        detail = detailAttr || extractNodeText(detailEl)
      }

      if (!myth || !fact) {
        warnings.push(`Myth busters item ${idx + 1} missing myth or fact`)
        return
      }

      items.push({
        _key: uuidv4(),
        itemId: itemId || undefined,
        icon,
        myth,
        fact,
        detail: detail || undefined,
      })
    })

    if (!items.length) {
      warnings.push('Myth busters block without items')
      return []
    }

    if (items.length < 2) {
      const msg = 'Dropped MythBusters: minimum 2 items required'
      pushParserWarning(warnings, state, {
        code: 'MIN_ITEMS_NOT_MET',
        message: msg,
        severity: 'error',
        path: state.currentPath,
      })
      return []
    }

    const block: MythBustersBlock = {
      _type: 'mythBustersBlock',
      _key: uuidv4(),
      items,
    }
    if (internalTitle) block.internalTitle = internalTitle
    if (pillLabel) block.pillLabel = pillLabel
    if (title) block.title = title
    if (description) block.description = description
    if (layout) block.layout = layout
    if (theme) block.theme = theme

    return [block]
  }

  if ((tag === 'section' || tag === 'div') && isInfoBoxElement(el)) {
    const backgroundAttr =
      getAttrLower(el, 'data-background-color') ||
      getAttrLower(el, 'data-bg') ||
      getAttrLower(el, 'data-color') ||
      getAttrLower(el, 'data-background')
    const backgroundColor = INFO_BOX_COLORS.has(backgroundAttr)
      ? (backgroundAttr as InfoBoxBlock['backgroundColor'])
      : undefined
    if (backgroundAttr && !backgroundColor) {
      warnings.push(`Info box: unsupported background color "${backgroundAttr}"`)
    }

    const contentBlocks = convertNodes(
      children,
      opts,
      warnings,
      listLevel + 1,
      drafts,
      depth + 1,
      state
    )
    const textBlocks = contentBlocks.filter(
      (block): block is PortableTextBlock => (block as PortableTextBlock)._type === 'block'
    )

    if (!textBlocks.length) {
      warnings.push('Info box without content')
      return []
    }

    return [
      {
        _type: 'infoBoxBlock',
        _key: uuidv4(),
        backgroundColor,
        content: textBlocks,
      },
    ]
  }

  if ((tag === 'section' || tag === 'div') && isHighlightElement(el)) {
    const borderAttr =
      getAttrLower(el, 'data-border-color') ||
      getAttrLower(el, 'data-border') ||
      getAttrLower(el, 'data-color')
    const borderColor = HIGHLIGHT_COLORS.has(borderAttr)
      ? (borderAttr as HighlightBlock['borderColor'])
      : undefined
    if (borderAttr && !borderColor) {
      warnings.push(`Highlight block: unsupported border color "${borderAttr}"`)
    }

    const titleAttr = getAttr(el, 'data-title')
    const titleEl = findFirstDescendant(el, (node) => isHeadingTag(node))
    const title = titleAttr || extractNodeText(titleEl)

    const contentNodes = titleEl ? children.filter((child) => child !== titleEl) : children
    const contentBlocks = convertNodes(
      contentNodes,
      opts,
      warnings,
      listLevel + 1,
      drafts,
      depth + 1,
      state
    )
    const textBlocks = contentBlocks.filter(
      (block): block is PortableTextBlock => (block as PortableTextBlock)._type === 'block'
    )

    if (!textBlocks.length) {
      warnings.push('Highlight block without content')
      return []
    }

    return [
      {
        _type: 'highlightBlock',
        _key: uuidv4(),
        title: title || undefined,
        borderColor,
        content: textBlocks,
      },
    ]
  }

  if ((tag === 'section' || tag === 'div') && isButtonGroupElement(el)) {
    const buttonElements = findDescendants(el, (node) => isButtonLikeElement(node))
    const items = buttonElements.map((buttonEl) => {
      const label = normalizeText(extractText(getChildren(buttonEl))).trim() || 'Button'
      return buildButtonGroupItem(buttonEl, label, warnings)
    })

    if (!items.length) {
      warnings.push('Button group without buttons')
      return []
    }

    return [
      {
        _type: 'buttonGroupBlock',
        _key: uuidv4(),
        items,
      },
    ]
  }

  if ((tag === 'section' || tag === 'div') && isVideoResourceElement(el)) {
    const videoRef =
      getAttr(el, 'data-video-id') ||
      getAttr(el, 'data-video-ref') ||
      getAttr(el, 'data-video-resource-id') ||
      getAttr(el, 'data-video-resource')
    const videoSlug =
      getAttr(el, 'data-video-slug') || getAttr(el, 'data-video-resource-slug')

    const resolvedRef = videoRef || (videoSlug ? `slug:videoResource:${videoSlug}` : '')

    if (!resolvedRef) {
      warnings.push('Video resource block missing data-video-id')
      return []
    }

    const title = getAttr(el, 'data-title') || undefined
    const aspectRatio =
      normalizeAspectRatio(getAttr(el, 'data-aspect-ratio') || getAttr(el, 'data-ratio'))

    return [
      {
        _type: 'videoResourceBlock',
        _key: uuidv4(),
        video: {
          _type: 'reference',
          _ref: resolvedRef,
        },
        title,
        aspectRatio,
      },
    ]
  }

  if ((tag === 'section' || tag === 'div') && isVideoEmbedElement(el)) {
    const urlAttr =
      getAttr(el, 'data-video-url') ||
      getAttr(el, 'data-url') ||
      getAttr(el, 'data-src')
    let src = safeUrl(urlAttr)
    if (!src) {
      const iframe = findFirstDescendant(el, (node) => node.tagName.toLowerCase() === 'iframe')
      src = safeUrl(iframe?.attribs?.src)
    }
    if (!src) {
      warnings.push('Video block missing safe URL')
      return []
    }
    if (!/youtube\.com|youtu\.be/.test(src)) {
      warnings.push(`Video embed is not a YouTube URL: ${src}`)
    }
    const title =
      getAttr(el, 'data-title') ||
      getAttr(el, 'title') ||
      extractNodeText(findFirstDescendant(el, (node) => isHeadingTag(node))) ||
      undefined
    const aspectRatio =
      normalizeAspectRatio(getAttr(el, 'data-aspect-ratio') || getAttr(el, 'data-ratio'))

    return [
      {
        _type: 'videoBlock',
        _key: uuidv4(),
        url: src,
        title,
        aspectRatio,
      },
    ]
  }

  if ((tag === 'section' || tag === 'div') && isSimpleCardsBlockElement(el)) {
    const titleAttr = getAttr(el, 'data-title')
    const eyebrowAttr = getAttr(el, 'data-eyebrow')
    const rawBackgroundColorPreset =
      getAttr(el, 'data-background-preset') || getAttr(el, 'data-bg-preset')
    const backgroundColorPreset = rawBackgroundColorPreset
      ? resolveBrandPreset(rawBackgroundColorPreset, warnings, state, 'feature cards block')
      : undefined
    const isCardElement = (node: Element) =>
      isSimpleCardElement(node) ||
      isLinkCardElement(node) ||
      hasClass(node, 'feature-card') ||
      hasClass(node, 'featured-card') ||
      hasClass(node, 'card-item')

    const eyebrowEl = findFirstDescendantExcluding(
      el,
      (node) =>
        hasClass(node, 'eyebrow') ||
        hasClass(node, 'section-eyebrow') ||
        hasClass(node, 'feature-cards-eyebrow') ||
        hasClass(node, 'featured-cards-eyebrow'),
      isCardElement
    )
    const titleEl = findFirstDescendantExcluding(
      el,
      (node) =>
        hasClass(node, 'feature-cards-title') ||
        hasClass(node, 'featured-cards-title') ||
        isHeadingTag(node),
      isCardElement
    )

    const title = titleAttr || extractNodeText(titleEl) || 'Cards'
    const eyebrow = eyebrowAttr || extractNodeText(eyebrowEl)

    const cardElements = collectCardElements(el)
    const cards = cardElements
      .map((card) => {
        const toPlainTextBlocks = (text: string): PortableTextBlock[] => [
          {
            _type: 'block',
            _key: uuidv4(),
            style: 'normal',
            children: [
              {
                _type: 'span',
                _key: uuidv4(),
                text: normalizeText(text),
              },
            ],
            markDefs: [],
          },
        ]

        const normalizeDescriptionBlocks = (
          nodes: Node[]
        ): PortableTextBlock[] => {
          const blocks = convertNodes(
            nodes,
            opts,
            warnings,
            listLevel + 1,
            drafts,
            depth + 1,
            state
          )
          return blocks
            .filter(
              (block): block is PortableTextBlock =>
                (block as PortableTextBlock)._type === 'block'
            )
            .map((block) => {
              const { listItem, level, ...rest } = block
              return {
                ...rest,
                style: 'normal',
              }
            })
        }

        const cardTitleAttr = getAttr(card, 'data-title')
        const cardDescriptionAttr = getAttr(card, 'data-description')
        const iconName = getAttr(card, 'data-icon-name') || getAttr(card, 'data-icon')
        const iconImageUrlAttr =
          getAttr(card, 'data-icon-image-url') ||
          getAttr(card, 'data-icon-image') ||
          getAttr(card, 'data-icon-url')
        const iconImageAltAttr =
          getAttr(card, 'data-icon-image-alt') || getAttr(card, 'data-icon-alt')
        const hrefAttr =
          card.attribs?.href ||
          card.attribs?.['data-href'] ||
          card.attribs?.['data-url'] ||
          card.attribs?.['data-link']
        const href = safeUrl(hrefAttr) || undefined
        const intentAttr = getAttr(card, 'data-intent') || getAttr(card, 'data-tone')
        const showArrowAttr = parseBooleanAttr(getAttr(card, 'data-show-arrow'))
        const newTabAttr = parseBooleanAttr(
          getAttr(card, 'data-new-tab') || getAttr(card, 'data-open-new-tab')
        )

        const cardTitleEl = findFirstDescendant(card, (node) =>
          hasClass(node, 'card-title') ||
          hasClass(node, 'feature-card-title') ||
          hasClass(node, 'featured-card-title') ||
          isHeadingTag(node)
        )
        const cardDescriptionEl = findFirstDescendant(card, (node) =>
          hasClass(node, 'card-description') ||
          hasClass(node, 'feature-card-description') ||
          hasClass(node, 'featured-card-description') ||
          node.tagName.toLowerCase() === 'p'
        )
        const iconImageEl = findFirstDescendant(card, (node) => {
          if (node.tagName.toLowerCase() !== 'img') return false
          return (
            hasClass(node, 'card-icon') ||
            hasClass(node, 'icon-image') ||
            node.attribs?.['data-icon-image'] === 'true'
          )
        })

        const cardTitle = cardTitleAttr || extractNodeText(cardTitleEl)
        if (!cardTitle) {
          warnings.push('Feature cards block: card missing title')
          return null
        }

        let cardDescription: PortableTextBlock[] | undefined
        if (cardDescriptionAttr) {
          const normalized = normalizeText(cardDescriptionAttr)
          if (normalized) {
            cardDescription = toPlainTextBlocks(normalized)
          }
        } else if (cardDescriptionEl) {
          const tagName = cardDescriptionEl.tagName.toLowerCase()
          const descriptionNodes =
            tagName === 'p' || tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4'
              ? [cardDescriptionEl]
              : getChildren(cardDescriptionEl)
          const blocks = normalizeDescriptionBlocks(descriptionNodes)
          if (blocks.length) {
            cardDescription = blocks
          }
        }
        const iconImageUrl = safeUrl(iconImageUrlAttr || iconImageEl?.attribs?.src) || undefined
        const iconImageAlt =
          (iconImageAltAttr || iconImageEl?.attribs?.alt || '').trim() || undefined
        const iconImage =
          iconImageUrl
            ? {
                _type: '__imageUploadPlaceholder',
                _key: uuidv4(),
                url: iconImageUrl,
                alt: iconImageAlt,
                target: 'imageField' as const,
              }
            : undefined

        if (hrefAttr && !href) {
          warnings.push(`Feature cards block: unsafe link "${hrefAttr}"`)
        }
        if (iconImageUrlAttr && !iconImageUrl) {
          warnings.push(`Feature cards block: unsafe icon image "${iconImageUrlAttr}"`)
        }
        if (iconImageUrl && !iconImageAlt) {
          warnings.push('Feature cards block: icon image missing alt')
        }

        return {
          _key: uuidv4(),
          title: cardTitle,
          description: cardDescription,
          iconName: iconName || undefined,
          iconImage,
          href,
          openInNewTab: card.attribs?.target === '_blank' || newTabAttr || undefined,
          intent: (intentAttr as LinkCardBlock['intent']) || undefined,
          showArrow: showArrowAttr,
        }
      })
      .filter(Boolean) as FeatureCardsBlock['cards']

    if (!cards.length) {
      warnings.push('Feature cards block: no cards found')
      return []
    }

    if (!titleAttr && !titleEl) {
      warnings.push('Feature cards block missing title')
    }

    const block: FeatureCardsBlock = {
      _type: 'featureCardsBlock',
      _key: uuidv4(),
      title,
      cards,
    }

    if (eyebrow) {
      block.eyebrow = eyebrow
    }

    if (backgroundColorPreset) {
      block.backgroundColorPreset = backgroundColorPreset
    }

    return [block]
  }

  if (isLinkCardElement(el)) {
    const titleAttr = getAttr(el, 'data-title')
    const descriptionAttr = getAttr(el, 'data-description')
    const hrefAttr =
      el.attribs?.href ||
      el.attribs?.['data-href'] ||
      el.attribs?.['data-url'] ||
      el.attribs?.['data-link']
    const href = safeUrl(hrefAttr) || '#'
    const intentAttr = getAttr(el, 'data-intent') || getAttr(el, 'data-tone')
    const iconName = getAttr(el, 'data-icon-name') || getAttr(el, 'data-icon')
    const showArrowAttr = parseBooleanAttr(getAttr(el, 'data-show-arrow'))
    const newTabAttr = parseBooleanAttr(getAttr(el, 'data-new-tab') || getAttr(el, 'data-open-new-tab'))

    const titleEl = findFirstDescendant(el, (node) =>
      hasClass(node, 'link-card-title') || hasClass(node, 'card-title') || isHeadingTag(node)
    )
    const descriptionEl = findFirstDescendant(el, (node) =>
      hasClass(node, 'link-card-description') ||
      hasClass(node, 'card-description') ||
      node.tagName.toLowerCase() === 'p'
    )

    const title = titleAttr || extractNodeText(titleEl) || 'Link card'
    const description = descriptionAttr || extractNodeText(descriptionEl)

    if (!hrefAttr) {
      warnings.push(`Link card "${title}" missing href`)
    }

    return [
      {
        _type: 'linkCardBlock',
        _key: uuidv4(),
        title,
        description: description || undefined,
        href,
        openInNewTab: el.attribs?.target === '_blank' || newTabAttr || undefined,
        intent: (intentAttr as LinkCardBlock['intent']) || undefined,
        iconName: iconName || undefined,
        showArrow: showArrowAttr,
      },
    ]
  }

  if (isSimpleCardElement(el)) {
    const contentBlocks = convertNodes(
      children,
      opts,
      warnings,
      listLevel + 1,
      drafts,
      depth + 1,
      state
    )
    const filteredContent = filterNestedContent(
      filterContentBlocks(contentBlocks),
      warnings,
      state.warningsV2,
      `${state.currentPath}.content`
    )
    if (!filteredContent.length) {
      warnings.push('Simple card missing content')
      return []
    }

    const toneAttr = (getAttr(el, 'data-tone') || getAttr(el, 'data-intent')).toLowerCase()
    const tone = VALID_TONES.has(toneAttr)
      ? (toneAttr as CardBlock['tone'])
      : 'clinical'
    const iconName = getAttr(el, 'data-icon-name') || getAttr(el, 'data-icon')
    const className = getAttr(el, 'data-class') || getAttr(el, 'data-class-name')

    const block: CardBlock = {
      _type: 'cardBlock',
      _key: uuidv4(),
      tone,
      content: filteredContent,
    }

    if (toneAttr && !VALID_TONES.has(toneAttr)) {
      pushParserWarning(warnings, state, {
        code: 'INVALID_COLOR',
        message: `Invalid card tone "${toneAttr}" - fallback to clinical`,
        severity: 'warning',
        path: state.currentPath,
      })
    }
    if (iconName) {
      block.iconName = iconName
    }
    if (className) {
      block.className = className
    }

    return [block]
  }

  if (tag === 'img') {
    const src = safeUrl(el.attribs?.src)
    const alt = (el.attribs?.alt || '').trim()

    if (!src) {
      warnings.push('Dropped <img> without safe src')
      return []
    }

    return [
      {
        _type: '__imageUploadPlaceholder',
        _key: uuidv4(),
        url: src,
        alt,
        target: 'imageBlock',
      },
    ]
  }

  if ((tag === 'button' || tag === 'a') && isQuestionnaireButtonElement(el)) {
    const questionnaireBlock = buildQuestionnaireButtonBlock(el, warnings)
    if (questionnaireBlock) {
      return [questionnaireBlock]
    }
  }

  if (tag === 'button') {
    const label = normalizeText(extractText(children)).trim() || 'Button'
    return [
      buildButtonBlock(el, label, warnings),
    ]
  }

  if (tag === 'a') {
    if (isButtonLikeElement(el)) {
      const label = normalizeText(extractText(children)).trim() || 'Button'
      return [
        buildButtonBlock(el, label, warnings),
      ]
    }
  }

  if (tag === 'figure') {
    const imgEl = children.find(
      (node): node is Element => isElementNode(node) && node.tagName.toLowerCase() === 'img'
    )
    const captionEl = children.find(
      (node): node is Element => isElementNode(node) && node.tagName.toLowerCase() === 'figcaption'
    )

    const nodes: PortableTextNode[] = []

    if (imgEl) {
      nodes.push(...convertElement(imgEl, opts, warnings, listLevel, drafts, depth + 1, state))
    } else {
      warnings.push('Figure without image')
    }

    if (captionEl) {
    const captionBlocks = convertNodes(
      [captionEl],
      opts,
      warnings,
      listLevel,
      drafts,
      depth + 1,
      state
    )
      nodes.push(...captionBlocks)
    }

    return nodes
  }

  // Quiz block
  if (tag === 'section' && hasClass(el, 'quiz')) {
    const questionEl = children.find(
      (node): node is Element =>
        isElementNode(node) && ['h1', 'h2', 'h3', 'h4'].includes(node.tagName.toLowerCase())
    )
    const descEl = children.find(
      (node): node is Element => isElementNode(node) && hasClass(node, 'quiz-description')
    )
    const correctEl = children.find(
      (node): node is Element => isElementNode(node) && hasClass(node, 'quiz-correct')
    )
    const incorrectEl = children.find(
      (node): node is Element => isElementNode(node) && hasClass(node, 'quiz-incorrect')
    )
    const takeawayEl = children.find(
      (node): node is Element => isElementNode(node) && hasClass(node, 'quiz-takeaway')
    )
    const learnMoreEl = children.find(
      (node): node is Element =>
        isElementNode(node) && hasClass(node, 'quiz-learn-more') && node.tagName.toLowerCase() === 'a'
    )

    const question = questionEl ? normalizeText(extractText(getChildren(questionEl))).trim() : ''
    if (!question) {
      warnings.push('Quiz without question: <section class="quiz">')
      return []
    }

    const optionsParent = children.find(
      (node): node is Element => isElementNode(node) && hasClass(node, 'quiz-options')
    )
    const optionNodes = optionsParent
      ? getChildren(optionsParent).filter((n): n is Element => isElementNode(n) && n.tagName.toLowerCase() === 'li')
      : children.filter((n): n is Element => isElementNode(n) && n.tagName.toLowerCase() === 'li')

    const options = optionNodes.map((li, idx) => {
      const label = normalizeText(extractText(getChildren(li))).trim() || `Option ${idx + 1}`
      const valueAttr = (li.attribs?.['data-value'] || '').trim()
      const value = valueAttr || slugify(label) || `option-${idx + 1}`
      const isCorrect = ['true', '1', 'yes'].includes((li.attribs?.['data-correct'] || '').trim().toLowerCase())
      return {
        _key: uuidv4(),
        label,
        value,
        isCorrect,
      }
    })

    const correctCount = options.filter((o) => o.isCorrect).length
    if (options.length < 2 || correctCount !== 1) {
      const msg = `Dropped Quiz: Must have at least 2 options and exactly 1 correct answer. Found ${options.length} options, ${correctCount} correct.`
      pushParserWarning(warnings, state, {
        code: 'MIN_ITEMS_NOT_MET',
        message: msg,
        severity: 'error',
        path: state.currentPath,
      })
      return []
    }

    const description = descEl ? normalizeText(extractText(getChildren(descEl))).trim() : ''
    const correctFeedback = correctEl ? normalizeText(extractText(getChildren(correctEl))).trim() : ''
    const incorrectFeedback = incorrectEl ? normalizeText(extractText(getChildren(incorrectEl))).trim() : ''
    const takeaway = takeawayEl ? normalizeText(extractText(getChildren(takeawayEl))).trim() : ''

    const learnMoreHref = learnMoreEl ? safeUrl(learnMoreEl.attribs?.href) : null
    const learnMoreLabel = learnMoreEl ? normalizeText(extractText(getChildren(learnMoreEl))).trim() : ''
    const learnMoreNewTab = learnMoreEl?.attribs?.target === '_blank'

    return [
      {
        _type: 'quizBlock',
        _key: uuidv4(),
        question,
        description: description || undefined,
        options,
        correctFeedback: correctFeedback || 'Correct!',
        incorrectFeedback: incorrectFeedback || 'Incorrect answer.',
        takeaway: takeaway || undefined,
        learnMore: learnMoreHref
          ? {
              label: learnMoreLabel || 'Learn more',
              href: learnMoreHref,
              newTab: learnMoreNewTab,
            }
          : undefined,
      },
    ]
  }

  if (tag === 'section' && isInlineExpandElement(el)) {
    const titleAttr = getAttr(el, 'data-title')
    const summaryAttr = getAttr(el, 'data-summary')
    const toggleLabelAttr = getAttr(el, 'data-toggle-label') || getAttr(el, 'data-toggle')
    const toggleLabelOpenAttr =
      getAttr(el, 'data-toggle-label-open') || getAttr(el, 'data-toggle-open')

    const contentWrapper = children.find(
      (node): node is Element =>
        isElementNode(node) &&
        (hasClass(node, 'inline-expand-content') ||
          hasClass(node, 'inline-expand-body') ||
          hasClass(node, 'inline-expand-panel') ||
          node.attribs?.['data-inline-content'] === 'true')
    )

    const metaNodes = contentWrapper ? children.filter((child) => child !== contentWrapper) : children

    const titleEl = metaNodes.find(
      (node): node is Element =>
        isElementNode(node) && (hasClass(node, 'inline-expand-title') || isHeadingTag(node))
    )

    const toggleEl =
      metaNodes.find(
        (node): node is Element =>
          isElementNode(node) &&
          (hasClass(node, 'inline-expand-toggle') ||
            hasClass(node, 'inline-expand-trigger') ||
            hasClass(node, 'inline-expand-button') ||
            node.attribs?.['data-inline-toggle'] === 'true' ||
            node.attribs?.['data-toggle'] === 'true' ||
            Boolean(node.attribs?.['data-toggle-label']))
      ) ||
      metaNodes.find(
        (node): node is Element =>
          isElementNode(node) &&
          (node.tagName.toLowerCase() === 'button' ||
            (node.tagName.toLowerCase() === 'a' && node.attribs?.role === 'button'))
      )

    const toggleIndex = toggleEl ? metaNodes.indexOf(toggleEl) : -1
    const summaryEl =
      metaNodes.find(
        (node): node is Element =>
          isElementNode(node) &&
          (hasClass(node, 'inline-expand-summary') || hasClass(node, 'inline-expand-intro'))
      ) ||
      metaNodes.find(
        (node, idx): node is Element =>
          isElementNode(node) &&
          node.tagName.toLowerCase() === 'p' &&
          (toggleIndex === -1 || idx < toggleIndex)
      )

    const inlineTitle = titleAttr || extractNodeText(titleEl) || 'Details'
    const summary = summaryAttr || extractNodeText(summaryEl)
    const toggleLabel = toggleLabelAttr || extractNodeText(toggleEl) || 'Read more'

    const contentNodes = contentWrapper
      ? getChildren(contentWrapper)
      : children.filter((child) => child !== titleEl && child !== summaryEl && child !== toggleEl)

    const contentBlocks = convertNodes(
      contentNodes,
      opts,
      warnings,
      listLevel + 1,
      drafts,
      depth + 1,
      state
    )

    if (!titleAttr && !titleEl) {
      warnings.push('Inline expand section missing title')
    }
    if (!contentBlocks.length) {
      warnings.push(`Inline expand "${inlineTitle}" missing content`)
    }

    const filteredContent = filterNestedContent(
      filterContentBlocks(contentBlocks),
      warnings,
      state.warningsV2,
      `${state.currentPath}.content`
    )

    return [
      {
        _type: 'inlineExpandBlock',
        _key: uuidv4(),
        title: inlineTitle,
        summary: summary || undefined,
        toggleLabel,
        toggleLabelOpen: toggleLabelOpenAttr || undefined,
        content: filteredContent,
      },
    ]
  }

  // FAQ group → faqInlineBlock
  const isFaqContainer =
    tag === 'section' || tag === 'div'
      ? hasClass(el, 'faq-group') ||
        (el.attribs?.id && el.attribs.id.toLowerCase().includes('faq')) ||
        hasClass(el, 'faqs')
      : false

  if (isFaqContainer) {
    const titleAttr = (el.attribs?.['data-title'] || '').trim()
    const groupTopics = extractTopics(el)
    const isFaqItem = (node: Element) =>
      hasClass(node, 'faq-item') || node.tagName.toLowerCase() === 'details'
    const titleEl = findFirstDescendantExcluding(
      el,
      (node) => hasClass(node, 'faq-title') || isHeadingTag(node),
      isFaqItem
    )
    const title = titleAttr || extractNodeText(titleEl)
    const faqItems = getChildren(el).filter(
      (node): node is Element =>
        isElementNode(node) &&
        (hasClass(node, 'faq-item') || node.tagName.toLowerCase() === 'details')
    )

    if (!faqItems.length) {
      warnings.push('FAQ group without faq-item')
      return []
    }

    const faqDrafts: FaqDraft[] = []
    const faqObjects = faqItems
      .map((item, idx) => {
        const itemTag = item.tagName.toLowerCase()
        let questionText = ''
        let answerNodes: Node[] = []

        if (itemTag === 'details') {
          const summaryNode = getChildren(item).find(
            (n): n is Element =>
              isElementNode(n) && n.tagName.toLowerCase() === 'summary'
          )
          questionText = summaryNode
            ? normalizeText(extractText(getChildren(summaryNode))).trim()
            : `FAQ ${idx + 1}`
          answerNodes = summaryNode
            ? getChildren(item).filter((child) => child !== summaryNode)
            : getChildren(item)
        } else {
          const questionEl = getChildren(item).find(
            (n): n is Element =>
              isElementNode(n) &&
              (hasClass(n, 'faq-question') ||
                ['h2', 'h3', 'h4', 'h5', 'summary'].includes(n.tagName.toLowerCase()))
          )
          const answerEl = getChildren(item).find(
            (n): n is Element =>
              isElementNode(n) &&
              (hasClass(n, 'faq-answer') ||
                ['div', 'p', 'details'].includes(n.tagName.toLowerCase()))
          )
          questionText = questionEl
            ? normalizeText(extractText(getChildren(questionEl))).trim()
            : `FAQ ${idx + 1}`
          answerNodes = answerEl ? getChildren(answerEl) : []
        }

        const answerText = normalizeText(extractText(answerNodes)).trim()
        const itemTopics = extractTopics(item)
        const topics = mergeTopics(groupTopics, itemTopics)

        if (questionText && answerText) {
          const faqId = uuidv4()
          faqDrafts.push({
            id: faqId,
            question: questionText,
            answer: answerText,
            topics,
          })
          return {
            _key: uuidv4(),
            _type: 'reference',
            _ref: faqId,
            _weak: true,
          }
        }

        return null
      })
      .filter(Boolean) as FaqInlineBlock['faqs']

    if (drafts && faqDrafts.length > 0) {
      if (!drafts.faqEntries) {
        drafts.faqEntries = []
      }
      drafts.faqEntries.push(...faqDrafts)
    }

    if (!faqObjects.length) {
      warnings.push('FAQ group without valid entries')
      return []
    }

    return [
      {
        _type: 'faqInlineBlock',
        _key: uuidv4(),
        title: title || undefined,
        faqs: faqObjects,
      },
    ]
  }

  if (tag === 'table') {
    const headers: string[] = []
    const rows: string[][] = []

    const thead = children.find(
      (node): node is Element => isElementNode(node) && node.tagName.toLowerCase() === 'thead'
    )
    const tbody = children.find(
      (node): node is Element => isElementNode(node) && node.tagName.toLowerCase() === 'tbody'
    )
    const rowNodes =
      (tbody && getChildren(tbody).filter((n): n is Element => isElementNode(n) && n.tagName.toLowerCase() === 'tr')) ||
      children.filter((n): n is Element => isElementNode(n) && n.tagName.toLowerCase() === 'tr')

    if (thead) {
      const headerRow = getChildren(thead).find(
        (n): n is Element => isElementNode(n) && n.tagName.toLowerCase() === 'tr'
      )
      if (headerRow) {
        getChildren(headerRow)
          .filter((n): n is Element => isElementNode(n) && n.tagName.toLowerCase() === 'th')
          .forEach((th) => headers.push(normalizeText(extractText(getChildren(th))).trim()))
      }
    }

    rowNodes.forEach((tr: Element) => {
      const cells = getChildren(tr)
        .filter((n): n is Element => isElementNode(n) && (n.tagName.toLowerCase() === 'td' || n.tagName.toLowerCase() === 'th'))
        .map((cell) => normalizeText(extractText(getChildren(cell))).trim())
      if (cells.length) rows.push(cells)
    })

    const rowTextBlocks: PortableTextNode[] = rows.map((cells) => {
      const text =
        headers.length && headers.length === cells.length
          ? headers.map((h, idx) => `${h}: ${cells[idx]}`).join(' | ')
          : cells.join(' | ')
      return {
        _type: 'block',
        _key: uuidv4(),
        style: 'normal',
        children: [
          {
            _type: 'span',
            _key: uuidv4(),
            text,
          },
        ],
        markDefs: [],
      }
    })

    if (!rowTextBlocks.length) {
      warnings.push('Empty or unsupported table')
    }

    return rowTextBlocks
  }

  if (tag === 'ul' || tag === 'ol') {
    const listType: Exclude<PortableTextBlock['listItem'], undefined> =
      tag === 'ul' ? 'bullet' : 'number'
    const blocks: PortableTextNode[] = []

    children
      .filter((node): node is Element => isElementNode(node) && node.tagName.toLowerCase() === 'li')
      .forEach((li) => {
        const itemBlocks = convertNodes(
          getChildren(li),
          opts,
          warnings,
          listLevel + 1,
          drafts,
          depth + 1,
          state
        )
        let hasBlock = false

        const normalized = itemBlocks.map((node) => {
          if ((node as PortableTextBlock)._type === 'block') {
            hasBlock = true
            const blockNode = node as PortableTextBlock
            return blockNode.listItem
              ? { ...blockNode, level: blockNode.level || listLevel + 1 }
              : { ...blockNode, listItem: listType, level: listLevel + 1 }
          }
          return node
        })

        if (!hasBlock) {
          const inlineContent = convertInlineNodes(getChildren(li), warnings)
          if (inlineContent.spans.length) {
            normalized.push({
              _type: 'block',
              _key: uuidv4(),
              style: 'normal',
              listItem: listType,
              level: listLevel + 1,
              children: inlineContent.spans,
              markDefs: inlineContent.markDefs,
            })
          }
        }

        blocks.push(...normalized)
      })

    return blocks
  }

  if (tag === 'details') {
    const isInlineExpand = isInlineExpandElement(el)
    const toneAttr = (getAttr(el, 'data-tone') || getAttr(el, 'data-intent')).toLowerCase()
    const tone = VALID_TONES.has(toneAttr)
      ? (toneAttr as AccordionBlock['tone'])
      : 'clinical'

    const summaryNode = children.find(
      (node): node is Element => isElementNode(node) && node.tagName.toLowerCase() === 'summary'
    )

    const title = summaryNode ? normalizeText(extractText(getChildren(summaryNode))).trim() : ''
    const contentNodes = summaryNode
      ? children.filter((child) => child !== summaryNode)
      : children

    const contentBlocks = convertNodes(
      contentNodes,
      opts,
      warnings,
      listLevel,
      drafts,
      depth + 1,
      state
    )

    if (!title && !contentBlocks.length) {
      warnings.push('Skipped empty <details> block')
      return []
    }

    if (isInlineExpand) {
      const inlineTitle =
        (el.attribs?.['data-title'] || '').trim() || title || 'Details'
      const summaryText = (el.attribs?.['data-summary'] || '').trim()
      const toggleLabelOpen = (el.attribs?.['data-toggle-open'] || '').trim()
      const toggleLabel = title || 'Read more'
      if (!inlineTitle) {
        warnings.push('Inline expand <details> missing title')
      }
      return [
        {
          _type: 'inlineExpandBlock',
          _key: uuidv4(),
          title: inlineTitle,
          summary: summaryText || undefined,
          toggleLabel,
          toggleLabelOpen: toggleLabelOpen || undefined,
          content: filterNestedContent(
            filterContentBlocks(contentBlocks),
            warnings,
            state.warningsV2,
            `${state.currentPath}.content`
          ),
        },
      ]
    }

    if (toneAttr && !VALID_TONES.has(toneAttr)) {
      pushParserWarning(warnings, state, {
        code: 'INVALID_COLOR',
        message: `Invalid accordion tone "${toneAttr}" - fallback to clinical`,
        severity: 'warning',
        path: state.currentPath,
      })
    }

    return [
      {
        _type: 'accordionBlock',
        _key: uuidv4(),
        accordionType: opts.defaultAccordionType,
        collapsible: opts.collapsible,
        tone,
        items: [
          {
            _key: uuidv4(),
            title: title || 'Details',
            content: filterNestedContent(
              filterContentBlocks(contentBlocks),
              warnings,
              state.warningsV2,
              `${state.currentPath}.items[0].content`
            ),
          },
        ],
      },
    ]
  }

  if (tag === 'div' && hasClass(el, 'accordion')) {
    const toneAttr = (getAttr(el, 'data-tone') || getAttr(el, 'data-intent')).toLowerCase()
    const tone = VALID_TONES.has(toneAttr)
      ? (toneAttr as AccordionBlock['tone'])
      : 'clinical'
    const items = getChildren(el).filter(
      (node): node is Element => isElementNode(node) && hasClass(node, 'accordion-item')
    )

    if (!items.length) {
      warnings.push('Accordion container without items')
      return []
    }

    const accordionItems = items.map((item, itemIndex) => {
      const buttonEl = getChildren(item).find(
        (node): node is Element =>
          isElementNode(node) && node.tagName.toLowerCase() === 'button' && hasClass(node, 'accordion-button')
      )
      const title = buttonEl ? normalizeText(extractText(getChildren(buttonEl))).trim() : ''

      let panelEl: Element | undefined
      const candidatePanels = getChildren(item).filter(
        (node): node is Element =>
          isElementNode(node) &&
          (hasClass(node, 'accordion-panel') || node.attribs?.role === 'region' || node.tagName.toLowerCase() === 'div')
      )
      if (buttonEl?.attribs?.['aria-controls']) {
        panelEl = candidatePanels.find((p) => p.attribs?.id === buttonEl?.attribs?.['aria-controls'])
      }
      if (!panelEl) {
        panelEl = candidatePanels[0]
      }

      const contentNodes = panelEl ? getChildren(panelEl) : []
      const contentBlocks = convertNodes(
        contentNodes,
        opts,
        warnings,
        listLevel + 1,
        drafts,
        depth + 1,
        state
      )

      return {
        _key: uuidv4(),
        title: title || 'Accordion item',
        content: filterNestedContent(
          filterContentBlocks(contentBlocks),
          warnings,
          state.warningsV2,
          `${state.currentPath}.items[${itemIndex}].content`
        ),
      }
    })

    if (toneAttr && !VALID_TONES.has(toneAttr)) {
      pushParserWarning(warnings, state, {
        code: 'INVALID_COLOR',
        message: `Invalid accordion tone "${toneAttr}" - fallback to clinical`,
        severity: 'warning',
        path: state.currentPath,
      })
    }

    return [
      {
        _type: 'accordionBlock',
        _key: uuidv4(),
        accordionType: opts.defaultAccordionType,
        collapsible: opts.collapsible,
        tone,
        items: accordionItems,
      },
    ]
  }

  // Containers: recurse through children, flattening nested content
  if (tag === 'section' || tag === 'div' || tag === 'main' || tag === 'article') {
    return convertNodes(children, opts, warnings, listLevel, drafts, depth + 1, state)
  }

  // Fallback: traverse children and keep whatever can be mapped
  return convertNodes(children, opts, warnings, listLevel, drafts, depth + 1, state)
}

/**
 * Convert an array of nodes to portable text nodes
 */
function convertNodes(
  nodes: Node[],
  opts: Required<Pick<ConvertOptions, 'defaultAccordionType' | 'collapsible'>>,
  warnings: string[],
  listLevel = 0,
  drafts?: ConversionDrafts,
  depth = 0,
  state: ParserState = { nodeCount: 0, warningsV2: [], currentPath: 'root', warnedUnsupportedTags: new Set() }
): PortableTextNode[] {
  if (depth > MAX_TRAVERSAL_DEPTH) {
    pushParserWarning(warnings, state, {
      code: 'NESTING_EXCEEDED',
      message: `Max depth exceeded at ${state.currentPath}`,
      severity: 'error',
      path: state.currentPath,
    })
    return []
  }

  if (state.nodeCount > MAX_TRAVERSAL_NODES) {
    const hasNodeLimitWarning = state.warningsV2.some(
      (warning) => warning.code === 'NODE_LIMIT_EXCEEDED'
    )
    if (!hasNodeLimitWarning) {
      pushParserWarning(warnings, state, {
        code: 'NODE_LIMIT_EXCEEDED',
        message: `Max node limit exceeded at ${state.currentPath}`,
        severity: 'error',
        path: state.currentPath,
      })
    }
    return []
  }

  const result: PortableTextNode[] = []

  nodes.forEach((node, index) => {
    withParserPath(state, `${state.currentPath}[${index}]`, () => {
      state.nodeCount += 1

      if (state.nodeCount > MAX_TRAVERSAL_NODES) {
        const hasNodeLimitWarning = state.warningsV2.some(
          (warning) => warning.code === 'NODE_LIMIT_EXCEEDED'
        )
        if (!hasNodeLimitWarning) {
          pushParserWarning(warnings, state, {
            code: 'NODE_LIMIT_EXCEEDED',
            message: `Max node limit exceeded at ${state.currentPath}`,
            severity: 'error',
            path: state.currentPath,
          })
        }
        return
      }

      if (isTextNode(node)) {
        const text = normalizeText(node.data || '')
        if (text.trim().length === 0) return
        result.push({
          _type: 'block',
          _key: uuidv4(),
          style: 'normal',
          children: [
            {
              _type: 'span',
              _key: uuidv4(),
              text,
            },
          ],
          markDefs: [],
        })
        return
      }

      if (isElementNode(node)) {
        const tag = node.tagName.toLowerCase()

        if (tag === 'a' && isLinkCardElement(node)) {
          result.push(
            ...convertElement(node, opts, warnings, listLevel, drafts, depth, state)
          )
        } else if (BLOCK_TAGS.has(tag)) {
          result.push(
            ...convertElement(node, opts, warnings, listLevel, drafts, depth, state)
          )
        } else if (INLINE_TAGS.has(tag)) {
          // Wrap stray inline elements into a normal block so marks are preserved
          const inline = convertInlineNodes([node], warnings)
          if (inline.spans.length) {
            result.push({
              _type: 'block',
              _key: uuidv4(),
              style: 'normal',
              children: inline.spans,
              markDefs: inline.markDefs,
            })
          }
        } else {
          const nestedChildren = getChildren(node)
          if (nestedChildren.length) {
            if (!state.warnedUnsupportedTags.has(tag)) {
              state.warnedUnsupportedTags.add(tag)
              pushParserWarning(warnings, state, {
                code: 'UNSUPPORTED_TAG',
                message: `Unsupported tag <${tag}> — children preserved`,
                severity: 'warning',
                path: state.currentPath,
              })
            }
            result.push(
              ...convertNodes(
                nestedChildren,
                opts,
                warnings,
                listLevel,
                drafts,
                depth + 1,
                state
              )
            )
          } else {
            pushParserWarning(warnings, state, {
              code: 'UNSUPPORTED_TAG',
              message: `Dropped unsupported tag <${tag}>`,
              severity: 'warning',
              path: state.currentPath,
            })
          }
        }
      }
    })
  })

  return result
}

/**
 * Convert HTML string to Portable Text nodes with warnings
 */
export function htmlToPortableTextWithWarnings(
  html: string,
  options: ConvertOptions = {}
): ConversionResult {
  const warnings: string[] = []
  const state: ParserState = { nodeCount: 0, warningsV2: [], currentPath: 'root', warnedUnsupportedTags: new Set() }

  if (!html || !html.trim()) {
    return {
      blocks: [
        {
          _type: 'block',
          _key: uuidv4(),
          style: 'normal',
          children: [
            {
              _type: 'span',
              _key: uuidv4(),
              text: '',
            },
          ],
          markDefs: [],
        },
      ],
      warnings,
      warningsV2: state.warningsV2,
    }
  }

  const opts = { ...DEFAULT_OPTIONS, ...options }
  const drafts: ConversionDrafts = {}
  const $ = load(html)
  const rootNodes = $('body').length ? $('body').contents().toArray() : $.root().contents().toArray()

  const blocks = convertNodes(rootNodes, opts, warnings, 0, drafts, 0, state)
  const hasDrafts = Boolean(drafts.faqEntries && drafts.faqEntries.length > 0)

  return {
    blocks,
    warnings,
    warningsV2: state.warningsV2,
    ...(hasDrafts ? { drafts } : {}),
  }
}

/**
 * Convert HTML string to Portable Text blocks (compat helper)
 */
export function htmlToPortableText(html: string, options?: ConvertOptions): PortableTextNode[] {
  return htmlToPortableTextWithWarnings(html, options).blocks
}

/**
 * Strip HTML tags and return plain text
 */
export function stripHTML(html: string): string {
  if (!html) return ''
  return load(html).text()
}
