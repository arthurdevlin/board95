"use client";

import { useId, useRef, useState } from "react";
import { Copy, MessageCircle, Share2, X } from "lucide-react";

export default function ShareListing({ path, title, text }: { path: string; title: string; text: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [nativeShare, setNativeShare] = useState(false);
  const [sharing, setSharing] = useState(false);

  function open() {
    // Build a clean public link; never forward search params or guest tokens.
    setUrl(new URL(path, window.location.origin).href);
    setMessage("");
    setNativeShare(typeof navigator.share === "function");
    dialog.current?.showModal();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copied.");
    } catch {
      input.current?.focus();
      input.current?.select();
      setMessage("Select and copy the link above to share it.");
    }
  }

  async function share() {
    setSharing(true);
    setMessage("");
    try {
      await navigator.share({ title, text, url });
      dialog.current?.close();
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        setMessage("Device sharing is unavailable. Copy the link or share on WhatsApp.");
      }
    } finally {
      setSharing(false);
    }
  }

  return <>
    <button type="button" className="listing-share-button" onClick={open} aria-label={`Share ${title}`} aria-haspopup="dialog"><Share2 size={15} aria-hidden="true"/><span>Share</span></button>
    <dialog ref={dialog} className="listing-share-dialog" aria-labelledby={headingId}>
      <div className="listing-share-heading"><h2 id={headingId}>Share listing</h2><button type="button" className="booking-dialog-close" aria-label="Close sharing" onClick={() => dialog.current?.close()}><X size={18} aria-hidden="true"/></button></div>
      <p>{title}</p>
      <label className="field">Listing link<input ref={input} type="url" readOnly value={url} onFocus={(event) => event.currentTarget.select()}/></label>
      <div className="listing-share-actions">
        <button type="button" className="btn btn-secondary" onClick={copy}><Copy size={16} aria-hidden="true"/>Copy link</button>
        <a className="btn btn-secondary" href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} aria-hidden="true"/>WhatsApp</a>
        {nativeShare && <button type="button" className="btn btn-primary" onClick={share} disabled={sharing}><Share2 size={16} aria-hidden="true"/>{sharing ? "Sharing…" : "More options"}</button>}
      </div>
      <p className="listing-share-status" role="status">{message}</p>
    </dialog>
  </>;
}
