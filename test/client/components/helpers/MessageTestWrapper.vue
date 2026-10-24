<template>
	<div>
		<Message :message="message" :channel="channel" :network="network" />
	</div>
</template>

<script lang="ts">
import Message from "../../../../client/components/Message.vue";
import {defineComponent, PropType} from "vue";
import {ClientChan, ClientMessage, ClientNetwork} from "../../../../client/js/types";

export default defineComponent({
	name: "MessageTestWrapper",
	components: {
		Message,
	},
	props: {
		message: {type: Object as PropType<ClientMessage>, required: true},
		channel: {type: Object as PropType<ClientChan>, required: false},
		network: {type: Object as PropType<ClientNetwork>, required: true},
	},
});
</script>
