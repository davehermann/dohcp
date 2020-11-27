class RootOption {
    constructor(public readonly code: number, public readonly name: string, public readonly description: string) {
    }

    public isPad = false;
    public isEnd = false;
    public length: number;

    private nameOfProperty: string;
    public set propertyName(val: string) { this.nameOfProperty = val; }
    public get propertyName(): string {
        if (!!this.nameOfProperty)
            return this.nameOfProperty;

        const nameParts = this.name.split(` `);
        nameParts[0] = nameParts[0].toLowerCase();
        return nameParts.join(``);
    }

    private _valueMap: Map<string, string> = new Map();
    public set valueMap(val) {
        for (const prop in val)
            this._valueMap.set(prop, val[prop]);
    }
    public get valueMap() { return this._valueMap; }

    public encoding: Encoding;
}

enum encodingTypes {
    IPAddress,
    String,
    UInt8,
    UInt16,
    UInt32,
}

class Encoding {
    constructor(method: string) {
        this.method = encodingTypes[method];
    }

    public readonly method: encodingTypes;
    public isArray = false;
    public readonly args: Array<string> = [];
}

export {
    encodingTypes,
    Encoding,
    RootOption,
};
