<template>
    <span class="dhcp_message_summary_component">
        [{{ts}}]
        {{messageType}} - ID: {{message.xid}}
        <a href="#" @click.stop.prevent="ToggleModal">View Message</a>

        <div class="modal" :class="{ 'is-active': showModal }">
            <div class="modal-background" @click.stop.prevent="ToggleModal"></div>
            <div class="modal-card">
                <header class="modal-card-head">
                    <p class="modal-card-title">{{messageType}} - {{ts}}</p>
                    <button class="delete" aria-label="close" @click.stop.prevent="ToggleModal"></button>
                </header>
                <section class="modal-card-body">
                    <pre>{{message}}</pre>
                </section>
            </div>
        </div>
    </span>
</template>

<script>
    import { onMounted, ref, computed } from "vue";

    export default {
        props: {
            dhcpMessage: { type: Object, required: true },
            timestamp: { type: Date, required: true },
        },
        setup(props/*, { attrs, slots, emit }*/) {
            const showModal = ref(false);

            const ts = ref(props.timestamp.toLocaleString(undefined, { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" })),
                messageType = ref(props.dhcpMessage.options.options.find(opt => (opt.name == "dhcpMessageType"))?.value);

            const ToggleModal = () => {
                showModal.value = !showModal.value;
            };

            return {
                // props
                message: props.dhcpMessage,
                // data
                showModal,
                // computed
                messageType,
                ts,
                // methods
                ToggleModal,
            };
        },
    };
</script>

<style scoped>
    /* .dhcp_message_summary_component {} */
    /* .dhcp_message_summary_component >>> .class+id {} */
</style>
