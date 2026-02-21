import "server-only";

import sanitizeHtml from "sanitize-html";

const BASIC_ALLOWED_TAGS = [
  "p",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "a"
];

export function sanitizeBasicHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: BASIC_ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title"]
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {},
    transformTags: {
      a: (_tagName, attrs) => ({
        tagName: "a",
        attribs: {
          ...(typeof attrs.href === "string" ? { href: attrs.href } : {}),
          ...(typeof attrs.title === "string" ? { title: attrs.title } : {}),
          rel: "noopener noreferrer nofollow",
          target: "_blank"
        }
      })
    }
  });
}
