// Shared fixtures for Request line / Request pattern tests, used by both the
// executed helper tests (test/tests/requestLine.ts) and the compile-checked
// component tests (test/client/js/requestButtons.ts).

// Site A format: [N] <release> von <nick> (date)
export const siteALine =
	"[1] Haps.2025.MULTI.VFF.1080p.WEB.AC3.5.1.H265-GRP von nick (23.10. 20:11)";
export const siteAPattern = "^\\[\\s*\\d+\\.?\\]\\s+(.+?)\\s+von\\s+";

// Site A lines in the wild may carry a bot prefix before the entry number;
// the pattern keeps it non-capturing so the release name stays group 1.
export const siteAPrefixedLine =
	"[REQUEST] :: [4] Haps.2025.MULTI.VFF.1080p.WEB.AC3.5.1.H265-GRP von nick (24.10. 14:31)";
export const siteAPrefixedPattern =
	"^(?:\\[REQUEST\\]\\s*::\\s*)?\\[\\s*\\d+\\.?\\]\\s+(.+?)\\s+von\\s+";

// Site B format: [N.] <release> by <nick> on <date>
export const siteBLine =
	"[  2.] Some.Release.2015.PAL.FULL.MULTi.DVDR-GRP by nick on 2026-08-03 @ 00:25";
export const siteBPattern = "^\\[\\s*\\d+\\.?\\]\\s+(.+?)\\s+by\\s+";

// The format the feature originally shipped with, removed from the client in
// ADR 0001's contract phase; kept to pin that it no longer matches anything.
export const legacyRequestLine = "[Request] - [1:] Some.Release.2025.1080p ~ by requester";
