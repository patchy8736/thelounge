import {cleanIrcMessage} from "../../../shared/irc";

// Format the feature originally shipped with. Fallback until per-network
// Request patterns land; removed together with its last use.
export const legacyRequestLinePattern =
	/\[Request\]\s*-\s*\[\s*\d+\s*:\]\s*(.+?)(?=\s*~\s*by\b|$)/i;

// Returns the Release name from a Request line matched by the given pattern
// (first capture group), or null when the line is not a request line.
export function extractReleaseName(text: string | undefined, pattern: RegExp): string | null {
	if (!text) {
		return null;
	}

	const cleanText = cleanIrcMessage(text);
	const match = cleanText.match(pattern);

	if (!match?.[1]) {
		return null;
	}

	const releaseName = match[1].trim();

	return releaseName.length > 0 ? releaseName : null;
}

// Release name for a message on a network: the network's stored Request
// pattern is authoritative while it compiles; unset or invalid patterns fall
// back to the legacy format (interim until ticket 04 removes the fallback).
// Compiled per call on purpose: networks are merged in place on the client,
// so caching the compiled pattern could go stale.
export function releaseNameForNetwork(
	text: string | undefined,
	network: {requestPattern?: string}
): string | null {
	let pattern = legacyRequestLinePattern;

	if (network.requestPattern) {
		try {
			pattern = new RegExp(network.requestPattern);
		} catch {
			// Invalid stored pattern: feature silently off (ADR 0001); the
			// legacy fallback keeps working until ticket 04 removes it
			pattern = legacyRequestLinePattern;
		}
	}

	return extractReleaseName(text, pattern);
}
