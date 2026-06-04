const ALLOWED_TAGS = new Set([
  'p','br','b','strong','i','em','u','s','ul','ol','li',
  'h1','h2','h3','h4','h5','h6','blockquote','code','pre',
  'table','thead','tbody','tr','th','td','div','span','section',
])

const DANGEROUS_ATTRS = /^on|^href$|^src$|^action$|^formaction$/i

/**
 * Strips script tags, event handlers and dangerous attributes from HTML string.
 * Uses the browser's DOMParser — no external dependency needed.
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return ''

  const doc = new DOMParser().parseFromString(dirty, 'text/html')

  doc.body.querySelectorAll('script, style, iframe, object, embed, form').forEach((el) => el.remove())

  doc.body.querySelectorAll('*').forEach((el) => {
    if (!ALLOWED_TAGS.has(el.tagName.toLowerCase())) {
      el.replaceWith(...Array.from(el.childNodes))
      return
    }
    Array.from(el.attributes).forEach((attr) => {
      if (DANGEROUS_ATTRS.test(attr.name)) {
        el.removeAttribute(attr.name)
      }
    })
  })

  return doc.body.innerHTML
}
