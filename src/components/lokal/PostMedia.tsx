import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getImageUrl } from "@/lib/utils";

export function PostMedia({
  url,
  kind,
  alt = "",
  className = "",
  mediaClassName = "",
}: {
  url: string;
  kind: "image" | "video";
  alt?: string;
  className?: string;
  mediaClassName?: string;
}) {
  const resolvedUrl = getImageUrl(url) || url;
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className={`group relative block w-full overflow-hidden rounded-lg bg-secondary text-left ${className}`.trim()}
        aria-label={`Open ${kind} preview`}
      >
        {kind === "video" ? (
          <video
            src={resolvedUrl}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className={`block h-full w-full object-contain ${mediaClassName}`.trim()}
          />
        ) : (
          <img
            src={resolvedUrl}
            alt={alt}
            className={`block h-full w-full object-contain ${mediaClassName}`.trim()}
          />
        )}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end p-2 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="rounded-full bg-background/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground shadow-sm backdrop-blur">
            Preview
          </span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl overflow-hidden p-3 sm:p-4">
          <DialogTitle className="sr-only">Media preview</DialogTitle>
          <div className="max-h-[80vh] overflow-hidden rounded-xl bg-black/90">
            {kind === "video" ? (
              <video
                src={resolvedUrl}
                controls
                playsInline
                autoPlay
                className="max-h-[80vh] w-full object-contain"
              />
            ) : (
              <img src={resolvedUrl} alt={alt} className="max-h-[80vh] w-full object-contain" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
