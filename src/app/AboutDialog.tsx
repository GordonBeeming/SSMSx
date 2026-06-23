import { useEffect, useMemo, useRef, useState } from "react";
import { getName, getTauriVersion, getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { Code2, ExternalLink, X } from "lucide-react";
import { isTauriRuntime } from "../shared/utils/tauri";

const REPOSITORY_URL = "https://github.com/GordonBeeming/ssmsx";
const NEW_ISSUE_URL = `${REPOSITORY_URL}/issues/new`;
const RELEASES_URL = `${REPOSITORY_URL}/releases`;

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

interface VersionInfo {
  appName: string;
  appVersion: string;
  tauriVersion: string;
  sidecarVersion: string;
}

interface PingResult {
  message: string;
  version: string;
}

const fallbackVersionInfo: VersionInfo = {
  appName: "SSMSx",
  appVersion: __APP_VERSION__,
  tauriVersion: "unavailable in browser",
  sidecarVersion: "unavailable in browser",
};

export function AboutDialog({ open: isOpen, onClose }: AboutDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [versionInfo, setVersionInfo] = useState<VersionInfo>(fallbackVersionInfo);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isTauriRuntime()) {
      setVersionInfo(fallbackVersionInfo);
      return;
    }

    let cancelled = false;

    async function loadVersionInfo() {
      const [appName, appVersion, tauriVersion, sidecarVersion] =
        await Promise.all([
          getName().catch(() => fallbackVersionInfo.appName),
          getVersion().catch(() => fallbackVersionInfo.appVersion),
          getTauriVersion().catch(() => "unknown"),
          loadSidecarVersion(),
        ]);

      if (!cancelled) {
        setVersionInfo({
          appName,
          appVersion,
          tauriVersion,
          sidecarVersion,
        });
      }
    }

    void loadVersionInfo();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const repositoryLabel = useMemo(
    () => REPOSITORY_URL.replace(/^https?:\/\//, ""),
    []
  );

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      className="fixed left-1/2 top-1/2 m-0 w-[440px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-bg-tertiary bg-bg-primary p-0 text-text-primary shadow-xl backdrop:bg-black/50"
    >
      <section className="relative grid justify-items-center gap-4 px-6 pb-6 pt-7 text-center">
        <button
          type="button"
          aria-label="Close"
          title="Close"
          onClick={onClose}
          className="absolute right-2 top-2 rounded p-1 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
        >
          <X size={14} />
        </button>

        <img
          alt=""
          src="/favicon.svg"
          width={96}
          height={96}
          className="h-24 w-24 rounded-[21px] border border-bg-tertiary"
        />

        <div className="grid justify-items-center gap-1">
          <h2 className="m-0 text-2xl font-semibold leading-none">
            {versionInfo.appName || "SSMSx"}
          </h2>
          <p className="m-0 max-w-[310px] text-sm leading-5 text-text-secondary">
            Fast, cross-platform SQL Server Management Studio for developers
            who are tired of waiting.
          </p>
        </div>

        <div className="grid w-full grid-cols-2 overflow-hidden rounded-md border border-bg-tertiary text-left text-xs">
          <VersionRow label="App" value={versionInfo.appVersion} />
          <VersionRow label="Tauri" value={versionInfo.tauriVersion} />
          <VersionRow label="Sidecar" value={versionInfo.sidecarVersion} />
          <VersionRow label="Channel" value={import.meta.env.DEV ? "Development" : "Release"} />
        </div>

        <button
          type="button"
          onClick={() => openExternal(REPOSITORY_URL)}
          className="inline-flex max-w-full items-center gap-2 text-sm font-medium text-accent hover:underline"
        >
          <Code2 size={15} />
          <span className="truncate">{repositoryLabel}</span>
          <ExternalLink size={13} />
        </button>

        <div className="grid w-full grid-cols-2 gap-2 text-xs">
          <AboutLink
            label="Found a Bug"
            url={buildBugReportUrl(versionInfo)}
          />
          <AboutLink label="Releases" url={RELEASES_URL} />
        </div>
      </section>
    </dialog>
  );
}

function VersionRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <div className="border-b border-r border-bg-tertiary bg-bg-secondary px-3 py-2 font-medium text-text-secondary">
        {label}
      </div>
      <div className="border-b border-bg-tertiary bg-bg-input px-3 py-2 font-mono text-text-primary">
        {value}
      </div>
    </>
  );
}

function AboutLink({ label, url }: { label: string; url: string }) {
  return (
    <button
      type="button"
      onClick={() => openExternal(url)}
      className="rounded border border-bg-tertiary bg-bg-secondary px-3 py-1.5 text-text-primary hover:bg-bg-tertiary"
    >
      {label}
    </button>
  );
}

async function loadSidecarVersion(): Promise<string> {
  try {
    const result = await invoke<string>("ping");
    const parsed = JSON.parse(result) as Partial<PingResult>;
    return parsed.version || "unknown";
  } catch {
    return "unavailable";
  }
}

function buildBugReportUrl(versionInfo: VersionInfo): string {
  const body = [
    "## What happened?",
    "",
    "",
    "## What did you expect?",
    "",
    "",
    "## Steps to reproduce",
    "",
    "1. ",
    "",
    "## Environment",
    "",
    `- App: ${versionInfo.appVersion}`,
    `- Tauri: ${versionInfo.tauriVersion}`,
    `- Sidecar: ${versionInfo.sidecarVersion}`,
    `- Channel: ${import.meta.env.DEV ? "Development" : "Release"}`,
    `- Platform: ${navigator.platform || "unknown"}`,
  ].join("\n");

  const params = new URLSearchParams({
    title: "Bug: ",
    body,
  });

  return `${NEW_ISSUE_URL}?${params.toString()}`;
}

function openExternal(url: string): void {
  if (isTauriRuntime()) {
    void open(url).catch((error) => {
      console.error(`Failed to open external URL '${url}':`, error);
    });
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
