interface IDNSEventStream {
    question: string;
    ipAddress: string;
    hardwareAddress: string;
    requests: Array<string>;
}

class DNSEvent {
    public question: string;
    public ipAddress: string;
    public hardwareAddress: string;

    public readonly requests: Array<Date> = [];

    public static fromDataStream(evtData: IDNSEventStream): DNSEvent {
        const newEvent = new DNSEvent();

        newEvent.question = evtData.question;
        newEvent.ipAddress = evtData.ipAddress;
        newEvent.hardwareAddress = evtData.hardwareAddress;
        newEvent.requests.splice(0, 0, ...evtData.requests.map(ts => new Date(ts)));

        return newEvent;
    }
}

export {
    IDNSEventStream,
    DNSEvent,
};
