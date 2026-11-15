// Type for the embedded binary: the platform package ships a file named `claude` with no extension,
// so TypeScript cannot resolve it. Bun's `with { type: 'file' }` import gives its path as a string.
declare module '@anthropic-ai/claude-agent-sdk-darwin-arm64/claude' {
  const path: string;
  export default path;
}
