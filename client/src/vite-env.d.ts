/// <reference types="vite/client" />

declare module '*.png' {
    const value: string; // Defines the import as a string (URL)
    export default value;
}

// Add this declaration for CSS files
declare module '*.css';