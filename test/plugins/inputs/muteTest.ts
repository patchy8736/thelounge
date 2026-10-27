/* eslint-disable @typescript-eslint/no-unused-expressions -- Chai expect statements */
import {expect} from "chai";

import muteInput from "../../../server/plugins/inputs/mute.js";
import Chan from "../../../server/models/chan.js";
import User from "../../../server/models/user.js";
import Client from "../../../server/client.js";
import type {NetworkWithIrcFramework} from "../../../server/models/network.js";
import {ChanType} from "../../../shared/types/chan.js";

type Reply = {text?: string};

function setup() {
	const emits: Array<{event: string; [key: string]: unknown}> = [];
	const chan = new Chan({name: "#thelounge", type: ChanType.CHANNEL});
	chan.users.set("bob", new User({nick: "bob"}));
	chan.users.set("alice", new User({nick: "alice"}));
	chan.users.set("carol", new User({nick: "carol"}));

	const network = {
		nick: "alice",
		channels: [chan],
		muteList: [] as string[],
		getChannel: (name: string) => (name === chan.name ? chan : undefined),
	};

	const client = {
		idMsg: 0,
		attachedClients: {},
		save() {},
		emit(event: string, data: unknown) {
			emits.push({event, ...(data as object)});
		},
	};

	const run = (cmd: string, argString: string) =>
		muteInput.input.call(
			client as unknown as Client,
			network as unknown as NetworkWithIrcFramework,
			chan,
			cmd,
			argString.split(" ").filter(Boolean),
			undefined
		);

	const addChannel = (name: string) => {
		const extra = new Chan({name, type: ChanType.CHANNEL});
		network.channels.push(extra);
		return extra;
	};

	const replies = () =>
		emits.filter((e) => e.event === "msg").map((e) => (e as unknown as {msg: Reply}).msg);

	return {chan, network, emits, run, replies, addChannel};
}

describe("mute input command", function () {
	it("adds a nick in the current channel to the user mute list and confirms", function () {
		const {network, run, replies} = setup();

		run("mute", "bob");

		expect(network.muteList).to.deep.equal(["bob"]);
		const last = replies().at(-1);
		expect(last?.text).to.include("bob");
		expect(last?.text).to.include("muted");
	});

	it("removes a muted nick with /unmute and confirms", function () {
		const {network, run, replies} = setup();
		run("mute", "bob");

		run("unmute", "bob");

		expect(network.muteList).to.deep.equal([]);
		expect(replies().at(-1)?.text).to.include("bob");
		expect(replies().at(-1)?.text).to.include("no longer muted");
	});

	it("errors when unmuting a nick that is not muted", function () {
		const {network, run, replies} = setup();

		run("unmute", "bob");

		expect(network.muteList).to.deep.equal([]);
		expect(replies().at(-1)?.text).to.include("not muted");
	});

	it("errors when muting an already muted nick", function () {
		const {network, run, replies} = setup();
		run("mute", "bob");

		run("mute", "bob");

		expect(network.muteList).to.deep.equal(["bob"]);
		expect(replies().at(-1)?.text).to.include("already muted");
	});

	it("lists user mutes with /mute list users", function () {
		const {run, replies} = setup();
		run("mute", "bob");
		run("mute", "carol");

		run("mute", "list users");

		const last = replies().at(-1)?.text;
		expect(last).to.include("bob");
		expect(last).to.include("carol");
	});

	it("reports an empty user mute list", function () {
		const {run, replies} = setup();

		run("mute", "list users");

		expect(replies().at(-1)?.text).to.include("No users are muted");
	});

	it("matches nicks case-insensitively", function () {
		const {network, run} = setup();

		run("mute", "BOB");
		run("unmute", "bOb");

		expect(network.muteList).to.deep.equal([]);
	});

	it("resolves a nick over a channel with the same name", function () {
		const {network, run, addChannel} = setup();
		const nameChan = addChannel("bob");

		run("mute", "bob");

		expect(network.muteList).to.deep.equal(["bob"]);
		expect(nameChan.muted).to.be.false;
	});

	it("still mutes the current channel with no arguments", function () {
		const {chan, network, run} = setup();

		run("mute", "");

		expect(chan.muted).to.be.true;
		expect(network.muteList).to.deep.equal([]);
	});

	it("still mutes a named channel with /mute <channel>", function () {
		const {run, addChannel} = setup();
		const other = addChannel("#other");

		run("mute", "#other");

		expect(other.muted).to.be.true;
	});

	it("refuses to mute your own nick", function () {
		const {network, run, replies} = setup();

		run("mute", "alice");

		expect(network.muteList).to.deep.equal([]);
		expect(replies().at(-1)?.text).to.include("can't mute yourself");
	});
});
