import * as readline from "readline";

const TABS = `    `;

/**
 * Read a line of input from the CLI
 * @param questionText - Prompt to display to user
 * @param trim - Automatically trim the output *(default: **true**)*
 */
function getLineInput(questionText: string, trim = true): Promise<string> {
    return new Promise(resolve => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        // Always append a space at the end of a question
        if (questionText.substr(questionText.length - 1) !== ` `)
            questionText += ` `;

        rl.question(questionText, response => {
            rl.close();

            if (trim)
                response = response.trim();

            resolve(response);
        });
    });
}

export {
    TABS,
    getLineInput as GetInputLine,
};
