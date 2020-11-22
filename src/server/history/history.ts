import * as dgram from "dgram";
import { DNSMessage } from "../dns/rfc1035/dnsMessage";

const MAXIMUM_DNS_CLIENT_REQUESTS = 1000,
    MAXIMUM_DNS_REQUEST_HISTORY = 200;

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

class ClientHistory {
    private readonly dnsRequests: Array<DNSEvent> = [];

    public AddDnsRequest(source: dgram.RemoteInfo, message: DNSMessage): void {
        message.questions.forEach(q => {
            // Find and existing event in the list
            const idxDnsEvent = this.dnsRequests.findIndex(request => (request.question == q.label) && (request.ipAddress == source.address));
            let dnsEvent: DNSEvent;

            if (idxDnsEvent >= 0) {
                // Remove it from the list if it exists
                dnsEvent = this.dnsRequests.splice(idxDnsEvent, 1)[0];
            } else {
                // Create a new event if it doesn't
                dnsEvent = new DNSEvent();
                dnsEvent.question = q.label;
                dnsEvent.ipAddress = source.address;
            }

            // Track the request
            dnsEvent.requests.push(new Date());
            // Drop the first request if the event list is too long
            if (dnsEvent.requests.length > MAXIMUM_DNS_REQUEST_HISTORY)
                dnsEvent.requests.shift();

            // Place the event at the end of the requests list
            this.dnsRequests.push(dnsEvent);

            // Drop the first item from the request list if it's too long
            if (this.dnsRequests.length > MAXIMUM_DNS_CLIENT_REQUESTS)
                this.dnsRequests.shift();
        });
    }

    public GetDnsByIp(ipAddress: string): Array<DNSEvent> {
        const recordsForIp = this.dnsRequests.filter(req => (req.ipAddress == ipAddress));

        return recordsForIp;
    }
}

export {
    IDNSEventStream,
    DNSEvent,
    ClientHistory,
};
