import * as path from "path";
import { readFileSync } from "fs";

import { encodingTypes, RootOption, Encoding } from "./rootOption";

interface IOptionDefinition {
    byCode: Map<number, RootOption>;
    byProperty: Map<string, RootOption>;
}

/** Generates maps of option data by option code and by property name */
function defineOptions(): IOptionDefinition {
    const options = addOptions();

    const optionDefinition: IOptionDefinition = {
        byCode: new Map(),
        byProperty: new Map(),
    };

    options.forEach(opt => {
        optionDefinition.byCode.set(opt.code, opt);
        optionDefinition.byProperty.set(opt.propertyName, opt);
    });

    return optionDefinition;
}

function addOptions(): Array<RootOption> {
    const options: Array<RootOption> = [];

    const contents = readFileSync(path.join(__dirname, `rfc2132-options.json`), { encoding: `utf8` }),
        rawData = JSON.parse(contents);

    rawData.forEach(rawOpt => {
        const opt = new RootOption(rawOpt.code, rawOpt.name, rawOpt.description);
        if (!!rawOpt.propertyName)
            opt.propertyName = rawOpt.propertyName;
        opt.isPad = rawOpt.isPad;
        opt.isEnd = rawOpt.isEnd;
        opt.length = rawOpt.length;

        if (!!rawOpt.valueMap)
            opt.valueMap = rawOpt.valueMap;

        if (!!rawOpt.encoding) {
            opt.encoding = new Encoding(rawOpt.encoding.method);
            opt.encoding.isArray = rawOpt.encoding.isArray;
            if (!!rawOpt.encoding.args)
                opt.encoding.args.splice(0, 0, ...rawOpt.encoding.args);
        }

        options.push(opt);
    });

    return options;
}

export {
    IOptionDefinition,
    defineOptions as DefineOptions,
};
