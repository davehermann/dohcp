module.exports = {
    "env": {
        "browser": true,
        "commonjs": true,
        "es6": true
    },
    "extends": ["eslint:recommended", "plugin:vue/recommended"],
    "rules": {
        /* Copy of base settings as not all rules inherit with eslint-plugin-vue included
        Fall 2018 */
        /* "indent": ["error", 4, { "SwitchCase": 1 }], */
        "linebreak-style": ["error", "unix"],
        "no-extra-boolean-cast": ["off"],
        "no-unused-vars": ["warn"],
        /* "quotes": ["warn", "backtick"], */
        "semi": ["error", "always"],
        /* "no-console": ["off"], */

        "no-console": ["warn"],
        "quotes": ["error", "double"],
        "vue/attributes-order": ["warn"],
        "vue/html-indent": ["error", 4, { "closeBracket": 1 }],
        "vue/html-self-closing": ["warn", { "html": { "void": "any", "normal": "never", "component": "never" } }],
        "vue/max-attributes-per-line": ["error", { "singleline": 4, "multiline": { "max": 1, "allowFirstLine": false } }],
        "vue/mustache-interpolation-spacing": ["warn", "never"],
        "vue/order-in-components": ["warn"],
        "vue/require-v-for-key": ["warn"],
        "vue/script-indent": ["error", 4, { "switchCase": 1, "baseIndent": 1 }]
    },
    "overrides": [
        {
            "files": ["*.vue"],
            "rules": {
                "indent": "off"
            }
        }
    ]
};
