import {cleanIrcMessage} from "../../../shared/irc";

// Compiles the network's stored Request pattern; null when unset or not a
// valid regular expression (fail-safe: callers treat null as feature off).
export function compileRequestPattern(pattern: string | undefined): RegExp | null {
	if (!pattern) {
		return null;
	}

	try {
		return new RegExp(pattern);
	} catch {
		return null;
	}
}

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

// Release name for a message on a network, using the network's stored
// Request pattern; null (feature off) when no pattern is set or the stored
// pattern does not compile (ADR 0001).
// Compiled per call on purpose: networks are merged in place on the client,
// so caching the compiled pattern could go stale.
export function releaseNameForNetwork(
	text: string | undefined,
	network: {requestPattern?: string}
): string | null {
	const pattern = compileRequestPattern(network.requestPattern);

	if (!pattern) {
		return null;
	}

	return extractReleaseName(text, pattern);
}
