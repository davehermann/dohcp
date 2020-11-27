module.exports = {
    // Don't extend as mount can't be removed
    // instead copy the other settings
    // extends: `@snowpack/app-scripts-vue`,
    mount: {
        [`src/static`]: `/`,
        [`src/app`]: `/_appcode_`
    },
    plugins: [`@snowpack/plugin-vue`, `@snowpack/plugin-dotenv`],
    alias: {
        [`@src`]: `./src`,
    },
    devOptions: {
        open: `none`,
        out: `dist`
    },
};
