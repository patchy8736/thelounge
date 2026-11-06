import {expect} from "chai";
import {mount, VueWrapper} from "@vue/test-utils";
import sinon from "sinon";
import {createMemoryHistory, createRouter} from "vue-router";

import Sidebar from "../../../client/components/Sidebar.vue";
import socket from "../../../client/js/socket";
import {key, store} from "../../../client/js/store";
import storage from "../../../client/js/localStorage";

const router = createRouter({
	history: createMemoryHistory(),
	routes: [],
});

function pointerEvent(type: string, clientX: number): PointerEvent {
	return new PointerEvent(type, {bubbles: true, button: 0, clientX, pointerId: 1});
}

function mountSidebar(): VueWrapper {
	return mount(Sidebar, {
		props: {overlay: null},
		global: {
			plugins: [router],
			provide: {[key as unknown as string]: store},
		},
	});
}

function dragSplitter(wrapper: VueWrapper, ...xs: number[]) {
	const splitter = wrapper.find(".panel-splitter");
	splitter.element.dispatchEvent(pointerEvent("pointerdown", xs[0]));

	for (const x of xs.slice(1, -1)) {
		window.dispatchEvent(pointerEvent("pointermove", x));
	}

	window.dispatchEvent(pointerEvent("pointerup", xs[xs.length - 1]));
}

function storedSidebarWidth(): number {
	const stored = JSON.parse(storage.get("settings") || "{}") as {sidebarWidth?: number};
	return stored.sidebarWidth ?? 0;
}

describe("Sidebar splitter", function () {
	let emitStub: sinon.SinonStub;
	let wrapper: VueWrapper;

	beforeEach(function () {
		storage.remove("settings");
		emitStub = sinon.stub(socket, "emit");
	});

	afterEach(function () {
		wrapper?.unmount();
		emitStub.restore();
		void store.dispatch("settings/update", {name: "sidebarWidth", value: 0, sync: true});
		document.documentElement.style.removeProperty("--sidebar-width");
		document.documentElement.classList.remove("panel-resizing");
		storage.remove("settings");
	});

	it("resizes the sidebar live and persists the width on pointer-up", function () {
		wrapper = mountSidebar();
		const splitter = wrapper.find(".panel-splitter");
		// Derive expectations from the actual geometry: the test bundle ships no CSS,
		// so the sidebar does not necessarily sit at clientX 0
		const {left} = wrapper.find("#sidebar").element.getBoundingClientRect();

		splitter.element.dispatchEvent(pointerEvent("pointerdown", 400));
		window.dispatchEvent(pointerEvent("pointermove", 340));

		expect(document.documentElement.style.getPropertyValue("--sidebar-width")).to.equal(
			`${340 - left}px`
		);
		expect(storedSidebarWidth()).to.equal(0);

		window.dispatchEvent(pointerEvent("pointermove", 500));
		window.dispatchEvent(pointerEvent("pointerup", 500));

		expect(document.documentElement.style.getPropertyValue("--sidebar-width")).to.equal(
			`${500 - left}px`
		);
		expect(storedSidebarWidth()).to.equal(500 - left);
		expect(store.state.settings.sidebarWidth).to.equal(500 - left);
	});

	it("never persists a width below the 100px minimum", function () {
		wrapper = mountSidebar();
		dragSplitter(wrapper, 400, 10, 10);

		expect(document.documentElement.style.getPropertyValue("--sidebar-width")).to.equal(
			"100px"
		);
		expect(storedSidebarWidth()).to.equal(100);
	});

	it("ignores sub-threshold pointer jitter so double-clicks stay on the handle", function () {
		wrapper = mountSidebar();
		const splitter = wrapper.find(".panel-splitter");

		// Click jitter: down at 400, wiggle under 3px, up at 401
		splitter.element.dispatchEvent(pointerEvent("pointerdown", 400));
		window.dispatchEvent(pointerEvent("pointermove", 401));
		window.dispatchEvent(pointerEvent("pointerup", 401));

		expect(document.documentElement.style.getPropertyValue("--sidebar-width")).to.equal("");
		expect(storedSidebarWidth()).to.equal(0);
	});

	it("double-click resets the sidebar to the theme default width", function () {
		wrapper = mountSidebar();
		const {left} = wrapper.find("#sidebar").element.getBoundingClientRect();
		dragSplitter(wrapper, 400, 500, 500);
		expect(storedSidebarWidth()).to.equal(500 - left);

		wrapper
			.find(".panel-splitter")
			.element.dispatchEvent(new Event("dblclick", {bubbles: true}));

		expect(document.documentElement.style.getPropertyValue("--sidebar-width")).to.equal("");
		expect(storedSidebarWidth()).to.equal(0);
	});

	it("persists the width without any server traffic", function () {
		wrapper = mountSidebar();
		dragSplitter(wrapper, 400, 300, 300);

		expect(emitStub.called).to.equal(false);
	});
});
