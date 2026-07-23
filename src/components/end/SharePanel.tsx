import {
  AlertCircle,
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Send,
} from "lucide-react";

import { ThreadsIcon, XIcon } from "../icons/BrandIcons";

type CopyState = "idle" | "copied" | "error";

type Props = {
  shareText: string;
  socialUrls: {
    threads: string;
    x: string;
    whatsapp: string;
  };
  canNativeShare: boolean;
  copyState: CopyState;
  isGeneratingImage: boolean;
  onChallengeShare: () => void;
  onCopy: () => void;
  onDownloadImage: () => void;
  onShareImage: () => void;
};

function CopyLabel({ state }: { state: CopyState }) {
  if (state === "copied") {
    return (
      <>
        <Check aria-hidden="true" size={17} /> Copied
      </>
    );
  }
  if (state === "error") {
    return (
      <>
        <AlertCircle aria-hidden="true" size={17} /> Try again
      </>
    );
  }
  return (
    <>
      <Copy aria-hidden="true" size={17} /> Copy result
    </>
  );
}

export function SharePanel({
  shareText,
  socialUrls,
  canNativeShare,
  copyState,
  isGeneratingImage,
  onChallengeShare,
  onCopy,
  onDownloadImage,
  onShareImage,
}: Props) {
  return (
    <section className="share-card share-panel" aria-labelledby="share-title">
      <div className="share-panel-heading">
        <div>
          <p className="eyebrow">Pass the map</p>
          <h2 id="share-title">Challenge a friend</h2>
        </div>
        <p>Spoiler-free tiles keep every figure secret until they play.</p>
      </div>

      <pre className="share-card-text" aria-label="Share preview">
        {shareText}
      </pre>

      <button className="primary-button share-primary" type="button" onClick={onChallengeShare}>
        <Send aria-hidden="true" size={19} />
        {canNativeShare
          ? "Challenge a friend"
          : copyState === "copied"
            ? "Challenge copied"
            : "Copy challenge"}
      </button>

      <div className="share-actions" aria-label="Share your result">
        <button className="share-btn share-btn--copy" type="button" onClick={onCopy}>
          <CopyLabel state={copyState} />
        </button>
        <a
          className="share-btn share-btn--threads"
          href={socialUrls.threads}
          target="_blank"
          rel="noreferrer"
          aria-label="Share to Threads"
        >
          <ThreadsIcon className="brand-icon" aria-hidden="true" />
          Threads
        </a>
        <a
          className="share-btn share-btn--twitter"
          href={socialUrls.x}
          target="_blank"
          rel="noreferrer"
          aria-label="Share to X"
        >
          <XIcon className="brand-icon" aria-hidden="true" />X
        </a>
        <a
          className="share-btn share-btn--whatsapp"
          href={socialUrls.whatsapp}
          target="_blank"
          rel="noreferrer"
          aria-label="Share with WhatsApp"
        >
          <MessageCircle aria-hidden="true" size={17} />
          WhatsApp
        </a>
      </div>

      <details className="share-more">
        <summary>Image sharing options</summary>
        <div className="share-more-actions">
          <button
            className="share-btn share-btn--image"
            type="button"
            onClick={onDownloadImage}
            disabled={isGeneratingImage}
          >
            {isGeneratingImage ? (
              <Loader2 aria-hidden="true" size={17} className="animate-spin" />
            ) : (
              <Download aria-hidden="true" size={17} />
            )}
            Save result image
          </button>
          {canNativeShare ? (
            <button
              className="share-btn share-btn--native"
              type="button"
              onClick={onShareImage}
              disabled={isGeneratingImage}
            >
              {isGeneratingImage ? (
                <Loader2 aria-hidden="true" size={17} className="animate-spin" />
              ) : (
                <ImageIcon aria-hidden="true" size={17} />
              )}
              Share image via apps
            </button>
          ) : null}
        </div>
      </details>
    </section>
  );
}
