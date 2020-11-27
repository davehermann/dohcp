interface IReadBinaryValue {
    value: number;
    offsetAfterRead: number;
}

interface IReadBinaryValueToString {
    value: string;
    offsetAfterRead: number;
}

export {
    IReadBinaryValue,
    IReadBinaryValueToString,
};
