import {expect} from "chai";
import {mount, VueWrapper} from "@vue/test-utils";
import sinon from "sinon";

import ChatUserList from "../../../client/components/ChatUserList.vue";
import socket from "../../../client/js/socket";
import {key, store} from "../../../client/js/store";
import storage from "../../../client/js/localStorage";

function pointerEvent(type: string, clientX: number): PointerEvent {
	return new PointerEvent(type, {bubbles: true, button: 0, clientX, pointerId: 1});
}

function mountUserList(): VueWrapper {
	return mount(ChatUserList, {
		props: {channel: {name: "#test", users: [], groups: []}},
		global: {
			provide: {[key as unknown as string]: store},
		},
	});
}

// Dragging the userlist's LEFT edge: a wider list means a smaller clientX
function dragSplitter(wrapper: VueWrapper, ...xs: number[]) {
	const splitter = wrapper.find(".panel-splitter");
	splitter.element.dispatchEvent(pointerEvent("pointerdown", xs[0]));

	for (const x of xs.slice(1, -1)) {
		window.dispatchEvent(pointerEvent("pointermove", x));
	}

	window.dispatchEvent(pointerEvent("pointerup", xs[xs.length - 1]));
}

function storedUserlistWidth(): number {
	const stored = JSON.parse(storage.get("settings") || "{}") as {userlistWidth?: number};
	return stored.userlistWidth ?? 0;
}

describe("Userlist splitter", function () {
	let emitStub: sinon.SinonStub;
	let wrapper: VueWrapper;

	beforeEach(function () {
		storage.remove("settings");
		emitStub = sinon.stub(socket, "emit");
	});

	afterEach(function () {
		wrapper?.unmount();
		emitStub.restore();
		void store.dispatch("settings/update", {name: "userlistWidth", value: 0, sync: true});
		document.documentElement.style.removeProperty("--userlist-width");
		document.documentElement.classList.remove("panel-resizing");
		storage.remove("settings");
	});

	it("resizes the userlist live and persists the width on pointer-up", function () {
		wrapper = mountUserList();
		const splitter = wrapper.find(".panel-splitter");
		// Derive expectations from the actual geometry: the test bundle ships no CSS,
		// so the userlist does not necessarily sit at the right viewport edge
		const {right} = wrapper.find(".userlist").element.getBoundingClientRect();

		splitter.element.dispatchEvent(pointerEvent("pointerdown", 700));
		window.dispatchEvent(pointerEvent("pointermove", 650));

		expect(document.documentElement.style.getPropertyValue("--userlist-width")).to.equal(
			`${right - 650}px`
		);
		expect(storedUserlistWidth()).to.equal(0);

		window.dispatchEvent(pointerEvent("pointermove", 400));
		window.dispatchEvent(pointerEvent("pointerup", 400));

		expect(document.documentElement.style.getPropertyValue("--userlist-width")).to.equal(
			`${right - 400}px`
		);
		expect(storedUserlistWidth()).to.equal(right - 400);
		expect(store.state.settings.userlistWidth).to.equal(right - 400);
	});

	it("never persists a width below the 100px minimum", function () {
		wrapper = mountUserList();
		dragSplitter(wrapper, 700, 4000, 4000);

		expect(document.documentElement.style.getPropertyValue("--userlist-width")).to.equal(
			"100px"
		);
		expect(storedUserlistWidth()).to.equal(100);
	});

	it("double-click resets the userlist to the theme default width", function () {
		wrapper = mountUserList();
		const {right} = wrapper.find(".userlist").element.getBoundingClientRect();
		dragSplitter(wrapper, 700, 400, 400);
		expect(storedUserlistWidth()).to.equal(right - 400);

		wrapper
			.find(".panel-splitter")
			.element.dispatchEvent(new Event("dblclick", {bubbles: true}));

		expect(document.documentElement.style.getPropertyValue("--userlist-width")).to.equal("");
		expect(storedUserlistWidth()).to.equal(0);
	});

	it("persists the width without any server traffic", function () {
		wrapper = mountUserList();
		dragSplitter(wrapper, 700, 500, 500);

		expect(emitStub.called).to.equal(false);
	});
});
