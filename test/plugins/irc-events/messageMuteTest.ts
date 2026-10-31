import {expect} from "chai";
import {EventEmitter} from "events";

import messageHandler from "../../../server/plugins/irc-events/message.js";
import Chan from "../../../server/models/chan.js";
import User from "../../../server/models/user.js";
import Msg from "../../../server/models/msg.js";
import Client from "../../../server/client.js";
import type {NetworkWithIrcFramework} from "../../../server/models/network.js";
import {ChanType} from "../../../shared/types/chan.js";

type Pushed = {chanId: number; msg: Msg};

function setup({muted}: {muted: boolean}) {
	const pushed: Pushed[] = [];
	const webPushes: unknown[] = [];
	const irc = new EventEmitter() as EventEmitter & {user: {nick: string}};
	irc.user = {nick: "alice"};

	const chan = new Chan({name: "#test", type: ChanType.CHANNEL});
	chan.users.set("bob", new User({nick: "bob"}));
	chan.mutedUsers = muted ? ["bob"] : [];
	const query = new Chan({name: "bob", type: ChanType.QUERY});
	const lobby = new Chan({name: "Lobby", type: ChanType.LOBBY});

	const network = {
		nick: "alice",
		uuid: "test-uuid",
		ignoreList: [] as unknown[],
		highlightRegex: /alice/i,
		resolveEncodingFor: () => "auto",
		channels: [chan, query],
		getChannel(name: string) {
			return network.channels.find((c) => c.name.toLowerCase() === name.toLowerCase());
		},
		getLobby: () => lobby,
		addChannel: () => 0,
	};

	const client = {
		idMsg: 0,
		attachedClients: {},
		messageStorage: [],
		mentions: [],
		save() {},
		highlightRegex: null,
		highlightExceptionRegex: undefined,
		emit(event: string, data: {chanId?: number; msg?: Msg}) {
			if (event === "msg" && data.msg) {
				pushed.push({chanId: data.chanId ?? 0, msg: data.msg});
			}
		},
		manager: {
			webPush: {
				push(...args: unknown[]) {
					webPushes.push(args);
				},
			},
		},
		createChannel(attr: {name: string; type: ChanType}) {
			return new Chan(attr);
		},
	};

	messageHandler.call(
		client as unknown as Client,
		irc as unknown as NetworkWithIrcFramework["irc"],
		network as unknown as NetworkWithIrcFramework
	);

	const say = (data: Record<string, unknown>) => irc.emit("privmsg", data);

	return {chan, query, pushed, webPushes, say, mentions: client.mentions};
}

describe("muted senders are not highlighted", function () {
	it("does not highlight a muted sender's channel message", function () {
		const {chan, pushed, webPushes, mentions, say} = setup({muted: true});

		say({nick: "bob", target: "#test", message: "hi alice"});

		expect(pushed).to.have.lengthOf(1);
		expect(pushed[0].chanId).to.equal(chan.id);
		expect(pushed[0].msg.highlight).to.equal(false);
		expect(webPushes).to.have.lengthOf(0);
		expect(mentions).to.have.lengthOf(0);
	});

	it("still highlights after the user is unmuted", function () {
		const {chan, pushed, say} = setup({muted: true});
		say({nick: "bob", target: "#test", message: "hi alice"});
		chan.mutedUsers.length = 0;

		say({nick: "bob", target: "#test", message: "hi alice again"});

		expect(pushed).to.have.lengthOf(2);
		expect(pushed[1].msg.highlight).to.equal(true);
	});

	it("highlights a muted nick in a different channel", function () {
		const {pushed, say} = setup({muted: false});
		const other = new Chan({name: "#other", type: ChanType.CHANNEL});
		other.users.set("bob", new User({nick: "bob"}));
		other.mutedUsers = ["bob"];

		say({nick: "bob", target: "#test", message: "hi alice"});

		expect(pushed[0].msg.highlight).to.equal(true);
	});

	it("does not highlight a muted sender's reply to our own message", function () {
		const {chan, pushed, say} = setup({muted: true});

		say({nick: "alice", target: "#test", message: "hello", tags: {msgid: "self-1"}});
		chan.messages.push(pushed[0].msg);
		say({
			nick: "bob",
			target: "#test",
			message: "re: hello",
			tags: {msgid: "reply-1", "+reply": "self-1"},
		});

		expect(pushed).to.have.lengthOf(2);
		expect(pushed[0].chanId).to.equal(chan.id);
		expect(pushed[1].msg.highlight).to.equal(false);
	});

	it("highlights an unmuted sender's reply to our own message", function () {
		const {chan, pushed, say} = setup({muted: false});

		say({nick: "alice", target: "#test", message: "hello", tags: {msgid: "self-1"}});
		chan.messages.push(pushed[0].msg);
		say({
			nick: "bob",
			target: "#test",
			message: "re: hello",
			tags: {msgid: "reply-2", "+reply": "self-1"},
		});

		expect(pushed[1].msg.highlight).to.equal(true);
	});

	it("still highlights a query message from a muted sender", function () {
		const {query, pushed, say} = setup({muted: true});

		say({nick: "bob", target: "alice", message: "psst alice"});

		const queryMsg = pushed.find((p) => p.chanId === query.id);
		expect(queryMsg, "message routed to the query window").to.not.equal(undefined);
		expect(queryMsg!.msg.highlight).to.equal(true);
	});

	it("still highlights an unmuted sender mentioning us", function () {
		const {pushed, webPushes, say} = setup({muted: false});

		say({nick: "carol", target: "#test", message: "hi alice"});

		expect(pushed[0].msg.highlight).to.equal(true);
		expect(webPushes).to.have.lengthOf(1);
	});
});
