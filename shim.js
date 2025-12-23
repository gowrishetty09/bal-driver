// Polyfill FormData for Hermes engine compatibility with axios
// This must be loaded before any other imports

if (typeof globalThis.FormData === 'undefined') {
    globalThis.FormData = class FormData {
        constructor() {
            this._parts = [];
        }
        append(name, value, filename) {
            this._parts.push([name, value, filename]);
        }
        getParts() {
            return this._parts.map(([name, value, filename]) => {
                if (typeof value === 'string') {
                    return { string: value, fieldName: name };
                }
                return { ...value, fieldName: name };
            });
        }
    };
}

// Also ensure Blob is available if needed
if (typeof globalThis.Blob === 'undefined') {
    globalThis.Blob = class Blob {
        constructor(parts, options) {
            this.parts = parts || [];
            this.options = options || {};
        }
        get type() {
            return this.options.type || '';
        }
    };
}
