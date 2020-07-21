/** Details about the additional parameters */
interface IDescription {
    /** Parameter that will be accepted */
    arg: string;
    /** Description of what the parameter does */
    detail: string;
}

/** Action definition */
interface IAction {
    /** Number of expected additional parameters for this action */
    additionalArguments?: number;
    /** Alternative parameters that alias this action */
    aliases?: Array<string>;
    /** Details about accepted parameters */
    argumentsDescription?: Array<IDescription>;
    /** Details about this action */
    description: string;
    /** Method to call when executing this parameter */
    method: Function;
    /** Load service configuration and supply to the called method */
    usesConfiguration?: boolean;
}

/** Action that will be processed */
interface IActionToTake {
    /** Name of the IAction */
    name: string;
    /** Additional arguments to pass to the action */
    additionalArguments?: Array<string>;
}

/** Action matched to the parameter */
interface IFoundAction {
    /** IAction that will be taken */
    action: IAction;
    /** Matched name of the IAction */
    argument: string;
}

export {
    IAction,
    IActionToTake,
    IDescription,
    IFoundAction,
};
