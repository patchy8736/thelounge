<template>
	<NetworkForm v-if="networkData" :handle-submit="handleSubmit" :defaults="networkData" />
</template>

<script lang="ts">
import {defineComponent, onMounted, ref, watch} from "vue";
import {useRoute} from "vue-router";
import socket from "../../js/socket";
import {useStore} from "../../js/store";
import NetworkForm, {NetworkFormDefaults} from "../NetworkForm.vue";

export default defineComponent({
	name: "NetworkEdit",
	components: {
		NetworkForm,
	},
	setup() {
		const route = useRoute();
		const store = useStore();

		const networkData = ref<NetworkFormDefaults | null>(null);

		const setNetworkData = () => {
			// shortcut: switching away from the tab abandons unsaved edits, add a dirty guard if users ask
			socket.emit("network:get", String(route.params.uuid || ""));
			networkData.value = store.getters.findNetwork(String(route.params.uuid || ""));
		};

		const handleSubmit = (data: {uuid: string; name: string}) => {
			socket.emit("network:edit", data);

			// Stay on the settings tab; only the sidebar name needs an immediate update
			const network = store.getters.findNetwork(data.uuid);

			if (network) {
				network.name = network.channels[0].name = data.name;
			}
		};

		watch(
			() => route.params.uuid,
			() => {
				setNetworkData();
			}
		);

		onMounted(() => {
			setNetworkData();
		});

		return {
			networkData,
			handleSubmit,
		};
	},
});
</script>
