import type {TypedStore} from "../store";

// Floor of the CSS clamp() in style.css; keep in sync
const PANEL_MIN_WIDTH = 100;

type PanelSplitterOptions = {
	// The panel whose width the splitter controls
	getPanel: () => HTMLElement | null;
	store: TypedStore;
	// Device-local setting (sync: "never") that persists the width; 0 means "theme default"
	settingName: "sidebarWidth" | "userlistWidth";
	cssVar: string;
	// Which edge of the panel the splitter sits on
	side: "left" | "right";
};

// Wire up to `@pointerdown`/`@dblclick` on a .panel-splitter element.
// Live width goes straight to the document root as an inline custom property
// (inline beats stylesheets, including user-specified CSS); the value is
// persisted once, on pointer-up, via the settings store.
export function usePanelSplitter(opts: PanelSplitterOptions) {
	let dragging = false;

	const widthAt = (e: PointerEvent) => {
		const rect = opts.getPanel()?.getBoundingClientRect();

		if (!rect) {
			return null;
		}

		const raw = opts.side === "right" ? e.clientX - rect.left : rect.right - e.clientX;
		return Math.max(PANEL_MIN_WIDTH, Math.round(raw));
	};

	const setWidth = (width: number) => {
		document.documentElement.style.setProperty(opts.cssVar, `${width}px`);
	};

	const onPointerMove = (e: PointerEvent) => {
		if (!dragging) {
			return;
		}

		const width = widthAt(e);

		if (width !== null) {
			setWidth(width);
		}
	};

	const onPointerUp = (e: PointerEvent) => {
		if (!dragging) {
			return;
		}

		dragging = false;
		document.documentElement.classList.remove("panel-resizing");
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);
		window.removeEventListener("pointercancel", onPointerUp);

		const width = widthAt(e);

		if (width !== null) {
			void opts.store.dispatch("settings/update", {
				name: opts.settingName,
				value: width,
				sync: true,
			});
		}
	};

	const onPointerDown = (e: PointerEvent) => {
		if (e.button !== 0 || dragging) {
			return;
		}

		dragging = true;
		// Dragging across the panel must not select its text
		document.documentElement.classList.add("panel-resizing");
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerUp);

		try {
			// Capture so pointer-up outside the window still fires; auto-released on pointer-up.
			// Synthetic test events have no real pointer behind them, hence the try/catch.
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		} catch {
			// window listeners still cover the drag
		}
	};

	const onDoubleClick = () => {
		void opts.store.dispatch("settings/update", {name: opts.settingName, value: 0, sync: true});
	};

	return {onPointerDown, onDoubleClick};
}
