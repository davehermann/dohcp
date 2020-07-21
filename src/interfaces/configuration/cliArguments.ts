interface IDescription {
    arg: string;
    detail: string;
}

interface IAction {
    additionalArguments?: number;
    aliases?: Array<string>;
    argumentsDescription?: Array<IDescription>;
    description: string;
    method: Function;
    usesConfiguration?: boolean;
}

interface IActionToTake {
    name: string;
    additionalArguments?: Array<string>;
}

interface IFoundAction {
    action: IAction;
    argument: string;
}

export {
    IAction,
    IActionToTake,
    IDescription,
    IFoundAction,
};
