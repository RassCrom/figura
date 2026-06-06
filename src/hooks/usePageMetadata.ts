import { useEffect } from "react";

const DEFAULT_TITLE = "Figura | Guess historical figures by their journeys";
const DEFAULT_DESCRIPTION =
  "Figura is a geography and history guessing game. Follow a person's journey and identify the historical figure.";
const DEFAULT_IMAGE = "/og-cover.png";
const DEFAULT_IMAGE_ALT = "Figura game route across a world map";

type PageMetadata = {
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
  type?: "website" | "profile";
};

function setMeta(selector: string, attribute: "content", value: string) {
  const element = document.head.querySelector<HTMLMetaElement>(selector);
  element?.setAttribute(attribute, value);
}

function applyMetadata(metadata?: PageMetadata) {
  const title = metadata?.title ?? DEFAULT_TITLE;
  const description = metadata?.description ?? DEFAULT_DESCRIPTION;
  const image = metadata?.image ?? DEFAULT_IMAGE;
  const imageAlt = metadata?.imageAlt ?? DEFAULT_IMAGE_ALT;
  const type = metadata?.type ?? "website";

  document.title = title;
  setMeta('meta[name="description"]', "content", description);
  setMeta('meta[property="og:title"]', "content", title);
  setMeta('meta[property="og:description"]', "content", description);
  setMeta('meta[property="og:image"]', "content", image);
  setMeta('meta[property="og:image:alt"]', "content", imageAlt);
  setMeta('meta[property="og:type"]', "content", type);
  setMeta('meta[name="twitter:title"]', "content", title);
  setMeta('meta[name="twitter:description"]', "content", description);
  setMeta('meta[name="twitter:image"]', "content", image);
  setMeta('meta[name="twitter:image:alt"]', "content", imageAlt);
}

export function usePageMetadata(metadata: PageMetadata | null) {
  useEffect(() => {
    applyMetadata(metadata ?? undefined);
    return () => applyMetadata();
  }, [metadata]);
}
