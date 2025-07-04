import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  // schema: "https://api.zenhub.com/public/graphql/",
  schema: "./zenhub-schema.graphql",
  documents: ["**/*.{ts,tsx}", "!node_modules/**"],
  ignoreNoDocuments: true, // for better experience with the watcher
  generates: {
    "./src/gql/": {
      preset: "client",
    },
  },
};

export default config;
