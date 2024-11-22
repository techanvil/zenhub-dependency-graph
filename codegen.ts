import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  // schema: "https://api.zenhub.com/public/graphql/",
  // schema: "./zenhub-schema.graphql",
  schema: "./zenhub-schema_patched.graphql", // Need to use patched schema to support `epicIssueByInfo` field.
  documents: ["**/*.{ts,tsx}", "!node_modules/**"],
  ignoreNoDocuments: true, // for better experience with the watcher
  generates: {
    "./src/gql/": {
      preset: "client",
    },
  },
};

export default config;
